import { ACTION_VERBS, RECOGNIZED_SKILLS } from "../constants";
import { isBulletLine } from "../bullet-analyzer";
import { hasMeasurableOutcome } from "../metric-parser";
import { countWords } from "../text-normalizer";
import { redactContact } from "../redact";
import { parseDateRanges } from "../date-analyzer";
import type {
  ParsedResume,
  ResumeBullet,
  ResumeCheck,
  ResumeDateRange,
  ResumeSection,
} from "../types";
import { SCORING_THRESHOLDS } from "@/config/scoring";

/* ------------------------------------------------------------------ */
/* Shared helpers for the Tech Interview Handbook validations          */
/* ------------------------------------------------------------------ */

/**
 * Blocks of `Extended_Pictographic` code points that are typography, not
 * pictographs. Arrows and the dingbat / technical-symbol blocks round-trip
 * through plain text intact: `Experience → Company` and `Experience ✔ Company`
 * both survive a copy-paste into a .txt file, and Unicode classifies both as
 * Extended_Pictographic. Scoring them as symbol-bearing charged a resume for a
 * character a parser reads perfectly well. Characters that genuinely carry an
 * emoji presentation (U+2705, U+2728, U+1F4E7) are matched by the first branch
 * of the pattern and are unaffected by this exclusion.
 */
const TYPOGRAPHIC_SYMBOL_BLOCKS = "\\u2190-\\u21FF\\u2300-\\u23FF\\u2600-\\u26FF\\u2700-\\u27BF";

/**
 * Glyphs that survive a copy-paste into a plain text file but then render as
 * boxes, or are dropped entirely, once a parser or a recruiter's terminal
 * handles them. Emoji and pictographs are the common case; the handbook's
 * plain-text-file test exists precisely because this is hard to notice in a
 * word processor.
 *
 * This deliberately excludes ordinary typographic punctuation (curly quotes,
 * en dashes, bullet glyphs) which round-trips fine, and - see
 * `TYPOGRAPHIC_SYMBOL_BLOCKS` - the arrows and dingbats that are pictographic
 * only on paper.
 */
export const GLYPH_PATTERN = new RegExp(
  `(?:\\p{Emoji_Presentation}|(?![${TYPOGRAPHIC_SYMBOL_BLOCKS}])\\p{Extended_Pictographic})`,
  "gu",
);

/**
 * Non-global twin of `GLYPH_PATTERN`, because `.test()` on a global pattern is
 * stateful and `glyphSamples` walks thousands of lines: the answer would depend
 * on how many glyphs the previous line happened to contain.
 */
const GLYPH_TEST = new RegExp(GLYPH_PATTERN.source, "u");

/** Count pictographic characters in a string. */
export function countGlyphs(text: string): number {
  return (text.match(GLYPH_PATTERN) ?? []).length;
}

/**
 * Shorten redacted text without leaving half a redaction label behind.
 *
 * "[link removed…" tells the reader nothing and reads like a bug, so a cut that
 * runs into a label is pulled back to the word boundary before it.
 */
function truncateFlat(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  let cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.5) cut = cut.slice(0, lastSpace);
  cut = cut.replace(/\[(email|link|phone)[a-z ]*$/i, "").trimEnd();
  return `${cut}\u2026`;
}

/** First few glyph-bearing snippets, for privacy-safe evidence. */
export function glyphSamples(text: string, max = 3): string[] {
  const lines = text.split("\n");
  const samples: string[] = [];
  for (const line of lines) {
    if (!GLYPH_TEST.test(line)) continue;
    const found = line.match(GLYPH_PATTERN) ?? [];
    const clean = redactContact(line.replace(/\s+/g, " ").trim()).text;
    samples.push(`"${truncateFlat(clean, 60)}" \u2014 ${found.join(" ")}`);
    if (samples.length >= max) break;
  }
  return samples;
}

/** A heading quoted into evidence, with contact details removed. */
export function headingText(section: ResumeSection): string {
  return redactContact(section.heading).text;
}

/* ------------------------------------------------------------------ */
/* Role entries                                                        */
/* ------------------------------------------------------------------ */

const YEAR_PATTERN = /(?:19|20)\d{2}/g;
const PRESENT_MARKER =
  /\b(?:present|current|currently|now|till date|to date|ongoing|today)\b/i;

/**
 * How long a dated line may be and still be read as a role header rather than
 * as prose that happens to mention a year. PDF extraction routinely merges a
 * role header with the first line of its description, and an unbounded length
 * let that merged paragraph in as a role - or, at the other end, the old fixed
 * length limit dropped real headers and silently removed the chronology check's
 * points. Length now comes from config and the year test is backed up by a
 * shape test.
 */
const MAX_ROLE_WORDS = 14;

export interface RoleInterval {
  startYear: number;
  /** `null` when the entry ends in "Present" or the end could not be read. */
  endYear: number | null;
  isPresent: boolean;
  /** Month 1-12 when the endpoint carried one. Absent from a bare-year span. */
  startMonth?: number;
  endMonth?: number;
}

export interface RoleEntry {
  /**
   * Redacted, flattened and truncated role header. Display only: no rule re-reads
   * it for scoring, and a role header is exactly where an email, a phone number
   * and the dates sit on the same line.
   */
  line: string;
  /** Most recent plausible year mentioned. Fallback ordering key only. */
  latestYear: number;
  years: number[];
  interval?: RoleInterval;
}

function isPlausibleYear(year: number): boolean {
  return (
    year >= SCORING_THRESHOLDS.plausibleYearMin &&
    year <= SCORING_THRESHOLDS.plausibleYearMax
  );
}

function intervalFromRanges(ranges: ResumeDateRange[]): RoleInterval | undefined {
  const range = ranges.find((candidate) => isPlausibleYear(candidate.startYear));
  if (range === undefined) return undefined;
  if (range.isPresent) {
    return {
      startYear: range.startYear,
      endYear: null,
      isPresent: true,
      ...(range.startMonth === undefined ? {} : { startMonth: range.startMonth }),
    };
  }
  const endYear = range.endYear !== null && isPlausibleYear(range.endYear) ? range.endYear : null;
  return {
    startYear: range.startYear,
    endYear,
    isPresent: false,
    ...(range.startMonth === undefined ? {} : { startMonth: range.startMonth }),
    ...(range.endMonth === undefined ? {} : { endMonth: range.endMonth }),
  };
}

export function findRoleEntries(content: string): RoleEntry[] {
  const entries: RoleEntry[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line.length === 0 || line.length > SCORING_THRESHOLDS.maxRoleLineLength) continue;
    // Bullets describe work; they are not the role header line. `isBulletLine`
    // reads the same `BULLET_GLYPHS` the parser uses - the rule used to keep a
    // second, shorter list of nine glyphs, so a "●" line was a bullet and a role
    // at the same time, and "+" excluded a role that is not a bullet at all.
    if (isBulletLine(line)) continue;

    const plausible = [...line.matchAll(YEAR_PATTERN)]
      .map((match) => Number(match[0]))
      .filter(isPlausibleYear);
    if (plausible.length === 0) continue;

    const interval = intervalFromRanges(parseDateRanges(line));
    // A sub-line that merely mentions a year ("Led a team of four across three
    // regions in 2021") is prose, not a header. A header either carries a date
    // range, says "Present", or is short enough to be one line of role metadata.
    const isHeader =
      interval !== undefined ||
      PRESENT_MARKER.test(line) ||
      line.split(/\s+/).length <= MAX_ROLE_WORDS;
    if (!isHeader) continue;

    entries.push({
      line: redactContact(line.replace(/\s+/g, " ").slice(0, 80)).text,
      years: plausible,
      // `reduce`, not `Math.max(...years)`: a role block long enough to hold
      // ~130k entries throws RangeError on the spread, and that throw escaped
      // `scoreResume` uncaught.
      latestYear: plausible.reduce((highest, year) => (year > highest ? year : highest), 0),
      ...(interval === undefined ? {} : { interval }),
    });
  }
  return entries;
}

/** The end of an interval as a single comparable number. */
function intervalEnd(interval: RoleInterval): number | null {
  if (interval.isPresent) return Number.POSITIVE_INFINITY;
  return interval.endYear;
}

/**
 * How recent an entry is, for reverse-chronological comparison.
 *
 * A current role is the most recent thing on a resume by definition, so "Present"
 * has to outrank every end year. Using the latest concrete year instead is what
 * made a correct resume read as wrong: `Mar 2022 - Present` scored 2022 while the
 * contract it overlapped, `Jan 2019 - Dec 2024`, scored 2024, and the correctly
 * ordered current role came back as the offender.
 */
function recencyKey(entry: RoleEntry): number {
  const { interval } = entry;
  if (interval === undefined) return entry.latestYear;
  const end = intervalEnd(interval);
  return end ?? interval.startYear;
}

/**
 * Whether two entries were genuinely on the clock at the same time.
 *
 * Concurrent contract and freelance work is legitimate, and in that case the
 * order of the two blocks in the document is not a statement about recency at
 * all. Flagging it would be advice the reader cannot act on.
 */
function intervalsOverlap(previous: RoleInterval, current: RoleInterval): boolean {
  const previousEnd = intervalEnd(previous);
  const currentEnd = intervalEnd(current);
  if (previousEnd === null || currentEnd === null) return false;
  return previous.startYear <= currentEnd && current.startYear <= previousEnd;
}

/** Roles should read newest first. Returns the entries that break that order. */
export function findOutOfOrderEntries(entries: RoleEntry[]): RoleEntry[] {
  const offenders: RoleEntry[] = [];
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1]!;
    const current = entries[index]!;
    const { interval: previousInterval } = previous;
    const { interval: currentInterval } = current;
    if (
      previousInterval !== undefined &&
      currentInterval !== undefined &&
      intervalsOverlap(previousInterval, currentInterval)
    ) {
      continue;
    }
    if (recencyKey(current) > recencyKey(previous)) offenders.push(current);
  }
  return offenders;
}

/* ------------------------------------------------------------------ */
/* Content units                                                       */
/* ------------------------------------------------------------------ */

export interface ContentUnit {
  text: string;
  position: number;
  wordCount: number;
  startsWithActionVerb: boolean;
  hasFirstPerson: boolean;
  containsWeakPhrase: boolean;
  /** A measurement rather than merely a digit somewhere in the line. */
  hasOutcome: boolean;
}

export interface ContentSource {
  units: ContentUnit[];
  /** What the units were built from, so the copy can say what was measured. */
  kind: "bullets" | "paragraphs" | "none";
}

const FIRST_PERSON = /\b(?:i|i'm|i've|i'd|i'll|my|me|myself|mine)\b/i;

/**
 * Passive constructions and contributor verbs.
 *
 * The dictionary in `constants.ts` catches "responsible for" but not "was
 * responsible for", and it cannot tell "Helped deploy the service" from
 * "Deployed the service" without listing both. The dictionary additions belong
 * in `constants.ts`; these two patterns are what lets the check see the same
 * fault whichever way round it is written.
 */
const PASSIVE_VOICE =
  /\b(?:was|were|is|are|been|being|be)\s+(?:\w+ly\s+)?(?:\w+ed|built|made|given|taken|shown|known|held|written|found|chosen|brought|thought|kept|left|overhauled)\b/i;
const CONTRIBUTOR_VERB =
  /^(?:helped|assisted|contributed|participated|involved|worked|supported|aided|assisting|helping)\b/i;

export function hasWeakWording(text: string, detectedByAnalyzer = false): boolean {
  return detectedByAnalyzer || PASSIVE_VOICE.test(text) || CONTRIBUTOR_VERB.test(text);
}

function leadingWord(text: string): string {
  return (text.trimStart().split(/\s+/)[0] ?? "").replace(/[^A-Za-z']/g, "").toLowerCase();
}

function unitFromBullet(bullet: ResumeBullet, position: number): ContentUnit {
  return {
    text: bullet.text,
    position,
    wordCount: bullet.wordCount,
    startsWithActionVerb: bullet.startsWithActionVerb,
    hasFirstPerson: bullet.hasFirstPerson,
    containsWeakPhrase: hasWeakWording(bullet.text, bullet.containsWeakPhrase),
    hasOutcome: hasMeasurableOutcome(bullet.text),
  };
}

function unitFromParagraph(text: string, position: number): ContentUnit {
  return {
    text,
    position,
    wordCount: countWords(text),
    startsWithActionVerb: ACTION_VERBS.has(leadingWord(text)),
    hasFirstPerson: FIRST_PERSON.test(text),
    containsWeakPhrase: hasWeakWording(text),
    hasOutcome: hasMeasurableOutcome(text),
  };
}

/**
 * The units the content checks measure.
 *
 * Only lines carrying a bullet glyph are bullets, so a paragraph-style resume -
 * a legitimate format the parser itself acknowledges - produced zero bullets,
 * every content check returned `not-applicable`, and 21 points left the
 * denominator: a hard ceiling of 95 for a document with nothing wrong with it.
 * The answer is not to invent bullets. The DOCX parser synthesises `• ` for real
 * OOXML lists, so a bullet-free DOCX really has none; it is that each paragraph
 * is the unit the reader also sees, and each one is measured as one.
 */
export function contentUnits(resume: ParsedResume): ContentSource {
  if (resume.bullets.length > 0) {
    return {
      kind: "bullets",
      units: resume.bullets.map((bullet, index) => unitFromBullet(bullet, index + 1)),
    };
  }

  // Section content only: the block above the first heading is a name and a
  // contact line, not content, and measuring it as a paragraph would charge the
  // resume for the contact checks.
  const fromSections = resume.sections.flatMap((section) => section.content.split("\n"));
  const paragraphs = (fromSections.length > 0 ? fromSections : resume.normalizedText.split("\n"))
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (paragraphs.length === 0) return { kind: "none", units: [] };
  return {
    kind: "paragraphs",
    units: paragraphs.map((paragraph, index) => unitFromParagraph(paragraph, index + 1)),
  };
}

/** The document with its recognised section headings removed. */
export function bodyText(resume: ParsedResume): string {
  const headings = new Set(resume.sections.map((section) => section.heading.trim()));
  return resume.normalizedText
    .split("\n")
    .filter((line) => !headings.has(line.trim()))
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Tense                                                               */
/* ------------------------------------------------------------------ */

export type BulletTense = "past" | "present" | "neutral";

/** Past-tense forms with no `-ed` to find. */
const IRREGULAR_PAST = new Set([
  "brought",
  "built",
  "drove",
  "found",
  "grew",
  "heard",
  "held",
  "kept",
  "led",
  "left",
  "lost",
  "made",
  "meant",
  "met",
  "paid",
  "put",
  "ran",
  "read",
  "said",
  "sold",
  "sent",
  "set",
  "spent",
  "taught",
  "told",
  "took",
  "understood",
  "won",
  "wrote",
]);

/** `-ed` words that are not past-tense verbs. */
const NOT_PAST_TENSE = new Set([
  "blessed",
  "breed",
  "deed",
  "embed",
  "exceed",
  "feed",
  "greed",
  "hundred",
  "indeed",
  "kindred",
  "naked",
  "need",
  "proceed",
  "sacred",
  "seed",
  "speed",
  "succeed",
  "wicked",
]);

/**
 * Verbs whose present and past forms differ, so an uninflected lead is present
 * and an `-ed` lead is past with no ambiguity. Forms that are identical in both
 * tenses ("Built", "Designed") are left out: guessing either way would put a
 * false tense claim into the ratio.
 */
const PRESENT_TENSE_VERBS = new Set([
  "lead",
  "own",
  "manage",
  "deliver",
  "maintain",
  "support",
  "handle",
  "coordinate",
  "oversee",
  "advise",
  "ensure",
  "provide",
  "contribute",
  "collaborate",
  "resolve",
  "launch",
  "ship",
  "build",
  "write",
  "run",
  "make",
  "teach",
  "meet",
]);

const FIRST_PERSON_PRESENT = /^i\b\s+(?:am|is|are|'m|'re)\b/i;

/**
 * Base form of a third-person verb, for the `-s` endings.
 *
 * The "es" is only part of the ending after a sibilant: `watches` gives `watch`
 * but `manages` gives `manage`, and reading both as a two-letter ending produced
 * a stem nothing in the dictionary holds.
 */
function thirdPersonStem(token: string): string {
  if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length >= 5 && token.endsWith("es")) {
    const withoutEs = token.slice(0, -2);
    return /(?:s|x|z|ch|sh)$/.test(withoutEs) ? withoutEs : token.slice(0, -1);
  }
  // Four characters is the shortest real form ("owns", "runs"); below it this is
  // not a verb ending at all.
  if (token.length >= 4 && token.endsWith("s")) return token.slice(0, -1);
  return "";
}

/**
 * Which tense a bullet's first verb form claims.
 *
 * `neutral` is a real answer, not a failure. "18% faster checkout conversion" and
 * "Full-stack developer with 6 years in payments" make no grammatical tense
 * claim at all, and counting either as "wrong tense" would punish a resume for a
 * formatting choice the reader has every right to make. A numeric lead, a
 * non-verb lead, and a verb form this closed dictionary cannot place are all
 * `neutral`, and the caller excludes them from the ratio entirely.
 */
export function classifyBulletTense(text: string): BulletTense {
  if (FIRST_PERSON_PRESENT.test(text.trimStart())) return "present";

  const trimmed = text.trimStart();
  const firstToken = trimmed.split(/\s+/)[0] ?? "";
  const token = firstToken.replace(/[^A-Za-z']/g, "").toLowerCase();
  if (token.length === 0) return "neutral";

  if (token === "i") {
    const second = (trimmed.split(/\s+/)[1] ?? "").replace(/[^A-Za-z']/g, "").toLowerCase();
    const stem = thirdPersonStem(second);
    if (PRESENT_TENSE_VERBS.has(second) || PRESENT_TENSE_VERBS.has(stem)) return "present";
    return "neutral";
  }

  if (IRREGULAR_PAST.has(token)) return "past";
  if (token.length >= 5 && token.endsWith("ing")) return "present";
  if (token.length >= 5 && token.endsWith("ed") && !NOT_PAST_TENSE.has(token)) return "past";
  if (PRESENT_TENSE_VERBS.has(token)) return "present";
  const stem = thirdPersonStem(token);
  if (stem.length > 0 && PRESENT_TENSE_VERBS.has(stem)) return "present";
  if (ACTION_VERBS.has(token)) return "past";

  return "neutral";
}

/* ------------------------------------------------------------------ */
/* Shared sections and formatting                                     */
/* ------------------------------------------------------------------ */

/**
 * Section ids that present applied work as well as an employment history does.
 *
 * `structure-experience` and `structure-projects` each carried their own list and
 * they disagreed: an internship-only resume passed the first, earning full marks,
 * and was then told by the second that it had "no employment history to draw on"
 * and lost two points for the internship that had just been accepted. One list,
 * two callers.
 */
export const EQUIVALENT_IDS = ["internships", "projects", "volunteer", "activities"];

export function share(part: number, total: number): number {
  if (total <= 0) return 0;
  return part / total;
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** A quoted snippet for any line: a heading, a role line, a bullet, a paragraph. */
export function quoteRedacted(text: string, maxLength = 60): string {
  const { text: redacted } = redactContact(text);
  return `"${truncateFlat(redacted.replace(/\s+/g, " ").trim(), maxLength)}"`;
}

export function formatHeadingList(sections: ResumeSection[], max = 5): string {
  const headings = sections.slice(0, max).map((section) => headingText(section));
  if (sections.length > max) headings.push(`${sections.length - max} more`);
  return headings.join(", ");
}

export function hasAnySection(sections: ResumeSection[], ids: string[]): boolean {
  return sections.some((section) => ids.includes(section.id.replace(/-\d+$/, "")));
}

export function sectionTitles(sections: ResumeSection[], ids: string[]): string[] {
  return sections
    .filter((section) => ids.includes(section.id.replace(/-\d+$/, "")))
    .map((section) => headingText(section));
}

export const UNABLE_TO_VERIFY_NOTE =
  "This check could not be evaluated from the text that could be extracted, so it was excluded from the score instead of counted as a failure.";

export const SKILL_COUNT_HINT = `Skill detection compares your document against a fixed list of ${RECOGNIZED_SKILLS.length} common terms. It shows what was recognized, not a complete inventory of everything you know.`;

export const RELEVANCE_LIMIT_NOTE =
  "Relevance cannot be fully assessed without knowing the target role, so this category measures general skills signals rather than job-specific keyword matching.";

export type { ResumeCheck };