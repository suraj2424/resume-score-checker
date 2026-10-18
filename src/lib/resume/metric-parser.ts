/**
 * Classify the numbers in a bullet by what they actually measure.
 *
 * `containsNumber: /\d/` cannot tell "grew revenue 30%" from "released in 2020",
 * "Node 18", "v2", "Level 2" or "ISO 9001" - all of them contain digits and none
 * of them is an outcome, yet four points used to rest on that boolean. This
 * module is the replacement: it reports *what* each number measures, so a rule
 * can insist on a measurement without also accepting an identifier.
 *
 * Deterministic by construction: one forward scan, closed dictionaries, no
 * clock, no locale, no network.
 */

import {
  COUNTABLE_NOUNS,
  CURRENCY_CODES,
  CURRENCY_SCALES,
  DURATION_UNITS,
  TECHNICAL_UNITS,
  VERSION_PREFIX_TOKENS,
} from "./constants";
import type { Metric, MetricKind } from "./types";

export type { Metric, MetricKind } from "./types";

/**
 * How much context either side of a number is inspected. A unit is never further
 * away than a couple of characters; a wider window would only cost time across a
 * whole document.
 */
const CONTEXT_WINDOW = 24;

const COUNTABLE_NOUN_SET = new Set(COUNTABLE_NOUNS);
const DURATION_UNIT_SET = new Set(DURATION_UNITS);
const TECHNICAL_UNIT_SET = new Set(TECHNICAL_UNITS);
const CURRENCY_CODE_SET = new Set(CURRENCY_CODES);
const VERSION_PREFIX_SET = new Set(VERSION_PREFIX_TOKENS);

/** A currency symbol directly before the number makes it money. */
const CURRENCY_SYMBOLS = "$€£¥₹₽₩¢";

/**
 * Thousand-separated groups are tried first so "1,200" is one number rather than
 * `1` followed by `200`.
 */
const NUMBER_PATTERN = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

const TRAILING_WORD_PATTERN = /^[A-Za-z][A-Za-z]*/;
const LEADING_WORD_PATTERN = /[A-Za-z]+$/;
/** "k", "2M", "'000s" - the magnitude word that may sit between number and unit. */
const SCALE_WORD_PATTERN = /^['’]?[A-Za-z]+/;
const MULTIPLIER_PATTERN = /^[x×✕]/;

interface NumberContext {
  /** Word immediately before the number, lowercased. */
  beforeWord: string;
  /** Text immediately after the number, separators and all. */
  after: string;
  /** `after` with leading separators stripped, for the `^`-anchored word reads. */
  wordAfter: string;
  /** The magnitude word, if the number was scaled ("1.2 million"). */
  scaleWord: string | null;
  /** Characters the magnitude word occupies in `wordAfter`, for the unit read. */
  scaleWordLength: number;
  /** Characters the magnitude word and its separator occupy in `after`, for the span. */
  scaleWordSpan: number;
  /** `wordAfter` past the magnitude word, so the unit can be read behind it. */
  unitWindow: string;
  /** The multiplier the scale word carries. */
  scale: number;
}

/** Separators between a number and what follows it: space, hyphen, comma, `to`. */
const CONTEXT_SEPARATOR = /^[^\p{L}\p{N}'’.]+/u;

function readContext(text: string, start: number, end: number): NumberContext {
  const beforeWindow = text.slice(Math.max(0, start - CONTEXT_WINDOW), start);
  const beforeMatch = LEADING_WORD_PATTERN.exec(beforeWindow);
  const after = text.slice(end, end + CONTEXT_WINDOW);
  // Every count in a resume is written with a space after the number ("12
  // services"), and the word patterns below are `^`-anchored. Feeding them the
  // raw window made every one of them return null, so the count, scale and
  // currency-code branches were unreachable and four points of
  // `content-quantified-outcomes` could never be earned from a number written
  // the normal way.
  const wordAfter = after.replace(CONTEXT_SEPARATOR, "");
  const scaleMatch = SCALE_WORD_PATTERN.exec(wordAfter);
  const scaleName = scaleMatch === null ? "" : scaleMatch[0].replace(/^['’]/, "").toLowerCase();
  const scale = CURRENCY_SCALES[scaleName];
  // Only a word that actually scales the number may extend the span, and the
  // span is the *matched text* — `match.length` on an exec result is the length
  // of the subject string, not of the match.
  const scaleWordLength = scale === undefined ? 0 : (scaleMatch?.[0].length ?? 0);
  // `scaleWordLength` is measured inside `wordAfter`, but the span is measured
  // in `after`, where the stripped separator still sits in front of it. Without
  // adding those characters back "1.2 million" is reported as "1.2 millio".
  // Only pay for the separator when there is a magnitude word, or every plain
  // "1200 requests" is reported as "1200 " with a trailing space in the evidence.
  const scaleWordSpan =
    scaleWordLength === 0 ? 0 : scaleWordLength + (after.length - wordAfter.length);
  // Strip again *after* slicing: "1.2 million requests" leaves a space where the
  // magnitude word ended, and the unit reader is anchored too.
  const unitWindow = wordAfter.slice(scaleWordLength).replace(CONTEXT_SEPARATOR, "");

  return {
    beforeWord: beforeMatch === null ? "" : beforeMatch[0].toLowerCase(),
    after,
    wordAfter,
    scaleWord: scale === undefined ? null : scaleName,
    scaleWordLength,
    scaleWordSpan,
    unitWindow,
    scale: scale ?? 1,
  };
}

function firstWordOf(window: string): string {
  const match = TRAILING_WORD_PATTERN.exec(window);
  return match === null ? "" : match[0].toLowerCase();
}

/**
 * A four-digit token in the 1900s or 2000s is a calendar year unless something
 * makes it an identifier. "2020" is not a claim a reader can act on.
 */
function looksLikeYear(digits: string): boolean {
  return /^(?:19|20)\d{2}$/.test(digits);
}

function classify(digits: string, context: NumberContext, hasCurrencySymbol: boolean): MetricKind {
  if (hasCurrencySymbol) return "currency";
  if (context.after.startsWith("%")) return "percent";
  if (MULTIPLIER_PATTERN.test(context.after)) return "multiplier";
  if (CURRENCY_CODE_SET.has(firstWordOf(context.wordAfter))) return "currency";

  const unit = firstWordOf(context.unitWindow);
  if (DURATION_UNIT_SET.has(unit)) return "duration";
  if (COUNTABLE_NOUN_SET.has(unit)) return "count";
  if (TECHNICAL_UNIT_SET.has(unit)) return "ambiguous";

  if (VERSION_PREFIX_SET.has(context.beforeWord)) return "ambiguous";
  if (looksLikeYear(digits)) return "ambiguous";

  // A magnitude word only means money next to a currency symbol or code. "3k
  // engineers" is a headcount claim, and inflating it would invent the figure.
  if (context.scaleWord !== null) return "ambiguous";

  return "ambiguous";
}

function parseValue(digits: string, scale: number): number {
  const parsed = Number(digits.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return parsed * scale;
}

/**
 * Every number in `text`, classified. Spans refer to the string that was passed
 * in, so a rule can quote the evidence without searching for it again.
 *
 * The span starts at the currency symbol when there is one, so `$1.2M` is
 * reported as the single piece of evidence the reader sees in their bullet.
 */
export function extractMetrics(text: string): Metric[] {
  const metrics: Metric[] = [];
  NUMBER_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = NUMBER_PATTERN.exec(text)) !== null) {
    if (match[0].length === 0) {
      NUMBER_PATTERN.lastIndex += 1;
      continue;
    }

    const digits = match[0];
    const numberStart = match.index;
    const numberEnd = numberStart + digits.length;
    const context = readContext(text, numberStart, numberEnd);
    const hasCurrencySymbol =
      numberStart > 0 && CURRENCY_SYMBOLS.includes(text.charAt(numberStart - 1));
    const kind = classify(digits, context, hasCurrencySymbol);

    const scaleWordSpan = context.scaleWordSpan;
    const start = hasCurrencySymbol ? numberStart - 1 : numberStart;
    const end = numberEnd + scaleWordSpan;

    metrics.push({
      kind,
      value: parseValue(digits, context.scale),
      raw: text.slice(start, end),
      start,
      end,
    });

    if (scaleWordSpan > 0) NUMBER_PATTERN.lastIndex = end;
  }

  return metrics;
}

/** Whether a bullet contains at least one number that measures something. */
export function hasMeasurableOutcome(text: string): boolean {
  return extractMetrics(text).some((metric) => metric.kind !== "ambiguous");
}