/**
 * Keep contact details out of anything the report displays.
 *
 * The privacy policy promises that the report never shows an address, number or
 * link. Until now that was easy to honour, because the report only ever quoted
 * truncated bullet text as evidence. The marked-up bullet ledger shows whole
 * lines, so a bullet could carry an email or a phone number into the report.
 * Redacting at the display boundary keeps the promise true rather than
 * aspirational.
 *
 * This runs on the way out, never on the way in: the scoring engine still reads
 * the real text, because an email redacted before the contact checks ran would
 * look like a missing one.
 */

import { isLikelyPhoneNumber } from "./contact-detector";

/** Separators that can appear between two numbers and look like one run. */
const PHONE_RUN_EDGE = " \t().-";
const PHONE_RUN_CHARACTER = "0123456789 \t().-+";

const YEAR_RANGE_SOURCE =
  "\\b(?:19|20)\\d{2}\\s*(?:[-\u2013\u2014\u2212]|\\bto\\b)\\s*" +
  "(?:(?:19|20)\\d{2}|present|current|now|today|ongoing)\\b";
const YEAR_PAIR_SOURCE = "\\b(?:19|20)\\d{2}[\\s,]+(?:19|20)\\d{2}\\b";

/**
 * `\w` is ASCII-only, so `jаne@example.com` written with a Cyrillic `а` slipped
 * through untouched. `\p{L}`/`\p{N}` cover the scripts an address is actually
 * written in, and the lookbehind keeps the local part from starting mid-token.
 */
const EMAIL_SOURCE =
  "(?<![\\p{L}\\p{N}._%+-])[\\p{L}\\p{N}._%+-]+@[\\p{L}\\p{N}-]+(?:\\.[\\p{L}\\p{N}-]+)+";

const LINKEDIN_SOURCE = "linkedin\\.com/[\\w/-]+";
const GITHUB_SOURCE = "github\\.com/[\\w/-]+";
const URL_SOURCE = "(?:https?://|www\\.)\\S+";

/** Formatted numbers: `617-555-0142`, `(555) 123 4567`, `+1 617 555 0142`. */
const PHONE_FORMATTED_SOURCE =
  "(?:\\+?\\d{1,3}[\\s.-]?)?(?:\\(\\d{2,4}\\)[\\s.-]?)?\\d{3,4}[\\s.-]\\d{3,4}(?:[\\s.-]\\d{2,4})?";
/** A bare digit run the detector would accept: `5551234567`. */
const PHONE_BARE_SOURCE = "(?<![\\d+])\\+?\\d{8,15}(?!\\d)";

const PATTERN = new RegExp(
  [
    // Year pairs and year ranges are matched first and passed through verbatim.
    // Redacting inside one is how "Worked on 2018-2020 roadmap" came back as
    // "Worked on [[2018-2020]] roadmap" - the text looked broken rather than
    // private, and the year was the one thing in it that was not contact
    // information to begin with.
    `(?<keep>${YEAR_RANGE_SOURCE})`,
    `(?<keepPair>${YEAR_PAIR_SOURCE})`,
    EMAIL_SOURCE,
    LINKEDIN_SOURCE,
    GITHUB_SOURCE,
    URL_SOURCE,
    `(?<phone>${PHONE_FORMATTED_SOURCE}|${PHONE_BARE_SOURCE})`,
  ].join("|"),
  "giu",
);

const EMAIL_LABEL = "[email removed]";
const LINK_LABEL = "[link removed]";
const PHONE_LABEL = "[phone removed]";

function labelFor(match: string): string {
  if (match.includes("@")) return EMAIL_LABEL;
  if (/linkedin\.com|github\.com|:\/\/|^www\./i.test(match)) return LINK_LABEL;
  return PHONE_LABEL;
}

export interface RedactedText {
  /** The text with contact details replaced by labels. */
  text: string;
  /** Offsets into `text` that were redacted. Nothing may be highlighted across one. */
  spans: Array<{ start: number; end: number }>;
  redacted: boolean;
  /**
   * Translates an offset in the original text to the redacted text. Marks are
   * found against the original, so they have to be moved before they can be
   * drawn — otherwise a highlight drifts off the words it refers to.
   */
  map: (offset: number) => number;
}

/**
 * The whole run of number-and-separator characters a phone match sits in.
 *
 * A phone pattern stops as soon as it has a plausible-looking group, so
 * `issue 1234 5678 9012 3456` used to redact the first three groups and leave
 * the fourth. Widening to the full run and then asking the detector whether that
 * run is a phone means the redactor can only ever hide a whole run, and can
 * never hide one while the report claims there was nothing to hide.
 */
function phoneRun(input: string, start: number, end: number): { start: number; end: number } | null {
  let from = start;
  let to = end;
  while (from > 0 && PHONE_RUN_CHARACTER.includes(input.charAt(from - 1))) from -= 1;
  while (to < input.length && PHONE_RUN_CHARACTER.includes(input.charAt(to))) to += 1;
  while (from < to && PHONE_RUN_EDGE.includes(input.charAt(from))) from += 1;
  while (to > from && PHONE_RUN_EDGE.includes(input.charAt(to - 1))) to -= 1;

  const run = input.slice(from, to);
  if (run.length === 0) return null;
  return isLikelyPhoneNumber(run) ? { start: from, end: to } : null;
}

/**
 * Replace contact details with a short label, keeping an offset map so callers
 * can still position marks against the original text.
 */
export function redactContact(input: string): RedactedText {
  // Segments of original text copied verbatim, with where they landed.
  const copied: Array<{ origStart: number; origEnd: number; newStart: number }> = [];
  const spans: Array<{ start: number; end: number }> = [];

  let out = "";
  let cursor = 0;
  let redacted = false;

  const copyChunk = (from: number, to: number) => {
    if (to <= from) return;
    copied.push({ origStart: from, origEnd: to, newStart: out.length });
    out += input.slice(from, to);
  };

  // `PATTERN` is module-scoped and global, so its lastIndex survives between
  // calls. Clearing it first keeps the result independent of call order.
  PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PATTERN.exec(input)) !== null) {
    if (match[0].length === 0) {
      PATTERN.lastIndex += 1;
      continue;
    }
    const groups = match.groups ?? {};
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;

    if (groups.keep !== undefined || groups.keepPair !== undefined) {
      copyChunk(cursor, matchEnd);
      cursor = matchEnd;
      continue;
    }

    let redactStart = matchStart;
    let redactEnd = matchEnd;
    if (groups.phone !== undefined) {
      const run = phoneRun(input, matchStart, matchEnd);
      if (run === null) {
        copyChunk(cursor, matchEnd);
        cursor = matchEnd;
        continue;
      }
      redactStart = run.start;
      redactEnd = run.end;
    }

    copyChunk(cursor, redactStart);
    const label = labelFor(input.slice(redactStart, redactEnd));
    spans.push({ start: out.length, end: out.length + label.length });
    out += label;
    cursor = redactEnd;
    redacted = true;
  }
  copyChunk(cursor, input.length);

  const map = (offset: number): number => {
    for (const segment of copied) {
      if (offset >= segment.origStart && offset <= segment.origEnd) {
        return segment.newStart + (offset - segment.origStart);
      }
    }
    // Offset fell inside a redaction: clamp to the start of the label.
    const fallback = copied.find((segment) => offset < segment.origStart);
    return fallback ? fallback.newStart : out.length;
  };

  return { text: out, spans, redacted, map };
}

/** True when any part of [start, end) overlaps a redacted span. */
export function overlapsRedaction(
  spans: Array<{ start: number; end: number }>,
  start: number,
  end: number,
): boolean {
  return spans.some((span) => start < span.end && end > span.start);
}