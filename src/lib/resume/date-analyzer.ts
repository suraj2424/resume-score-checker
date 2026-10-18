import { DATE_MONTHS, MONTH_ABBREVIATIONS } from "./constants";
import type { DateFormatFamily, ResumeDate, ResumeDateRange } from "./types";

const MONTH_PATTERN = `(?:${DATE_MONTHS.join("|")}|${MONTH_ABBREVIATIONS.join("|")})`;

interface DatePattern {
  family: DateFormatFamily;
  pattern: RegExp;
}

/**
 * Ordered most-specific first. A span claimed by an earlier pattern is not
 * re-matched by later ones, so "Jan 2020" is not also counted as year-only.
 */
const DATE_PATTERNS: DatePattern[] = [
  {
    family: "month-name-year",
    pattern: new RegExp(`\\b${MONTH_PATTERN}[a-z]*\\.?\\s+\\d{4}\\b`, "gi"),
  },
  { family: "full-date", pattern: /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g },
  { family: "month-year", pattern: /\b\d{1,2}\/\d{4}\b/g },
  { family: "iso-month", pattern: /\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])\b/g },
  { family: "year-only", pattern: /\b(?:19|20)\d{2}\b/g },
];

const PRESENT_PATTERN =
  /\b(?:present|current|currently|now|till date|to date|ongoing|today)\b/i;

/** Month name or abbreviation to its number, for the month the token carried. */
const MONTH_NUMBERS = new Map<string, number>();
const FULL_MONTH_BY_PREFIX = new Map<string, number>();
DATE_MONTHS.forEach((name, index) => {
  MONTH_NUMBERS.set(name, index + 1);
  FULL_MONTH_BY_PREFIX.set(name.slice(0, 3), index + 1);
});
// "sept" and "sep" both resolve through the first three letters of the full
// name; the abbreviations list omits "may" only because the full name covers it.
MONTH_ABBREVIATIONS.forEach((name) => {
  const resolved = FULL_MONTH_BY_PREFIX.get(name.slice(0, 3));
  if (resolved !== undefined) MONTH_NUMBERS.set(name, resolved);
});

function monthFromName(match: string): number | undefined {
  const head = /^([a-z]+)/i.exec(match);
  if (head === null) return undefined;
  const name = (head[1] ?? "").toLowerCase();
  return MONTH_NUMBERS.get(name) ?? MONTH_NUMBERS.get(name.slice(0, 3));
}

/**
 * Month carried by the token, or `undefined` when it carried none. `Jan 2021`
 * and `Dec 2021` are a year apart as spans and a year apart as months; a bare
 * year cannot order itself against anything.
 */
function extractMonth(match: string, family: DateFormatFamily): number | undefined {
  if (family === "year-only") return undefined;
  if (family === "month-name-year") return monthFromName(match);

  if (family === "iso-month") {
    const parts = match.split(/[-/.]/);
    const month = Number(parts[1]);
    return Number.isInteger(month) && month >= 1 && month <= 12 ? month : undefined;
  }

  // full-date and month-year both lead with the calendar month in the shapes
  // this analyzer reads: `03/2021`, `03.2021`, `17/03/2021`.
  const leading = /^\s*(\d{1,2})/.exec(match);
  const month = leading === null ? Number.NaN : Number(leading[1]);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : undefined;
}

export interface DateAnalysis {
  dates: ResumeDate[];
  familyCounts: Record<DateFormatFamily, number>;
  dominantFamily: DateFormatFamily | null;
  dominantShare: number;
  distinctFamilies: number;
  hasPresentMarker: boolean;
  /** Paired employment/education spans, in document order. */
  ranges: ResumeDateRange[];
}

export interface DateFamilySummary {
  dominantFamily: DateFormatFamily | null;
  dominantCount: number;
  dominantShare: number;
  distinctFamilies: number;
  families: DateFormatFamily[];
}

/**
 * Shared summary of date-format families. Used by both the analyzer (which
 * builds `DateAnalysis`) and the readability `date-format` rule, so the two
 * can never drift out of sync.
 */
export function summarizeDateFamilies(dates: ResumeDate[]): DateFamilySummary {
  const counts = new Map<DateFormatFamily, number>();
  for (const date of dates) {
    counts.set(date.family, (counts.get(date.family) ?? 0) + 1);
  }
  let dominantFamily: DateFormatFamily | null = null;
  let dominantCount = 0;
  for (const [family, count] of counts) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantFamily = family;
    }
  }
  return {
    dominantFamily,
    dominantCount,
    dominantShare: dates.length > 0 ? dominantCount / dates.length : 0,
    distinctFamilies: counts.size,
    families: [...counts.keys()],
  };
}

function extractYear(match: string, family: DateFormatFamily): number {
  const yearMatch = match.match(/(?:19|20)\d{2}/);
  if (yearMatch) return Number(yearMatch[0]);
  if (family === "full-date") {
    const digits = match.replace(/\D/g, "");
    if (digits.length === 8) {
      return Number(`20${digits.slice(6)}`);
    }
  }
  return Number.NaN;
}

interface DateCandidate {
  start: number;
  end: number;
  family: DateFormatFamily;
  /** Position in `DATE_PATTERNS`, so a tie on start index keeps family order. */
  rank: number;
  year: number;
}

/**
 * Detect date-like tokens and classify their format family.
 *
 * Tokens come back in document order, not sorted: an earlier sort by raw text
 * threw away the only ordering the document actually asserts, and made `Jan
 * 2021` indistinguishable from `Dec 2021` for anything that compares spans.
 * Date-format consistency is judged by comparing family counts, not by parsing
 * semantics, so unusual-but-consistent formats are never penalized.
 */
export function analyzeDates(text: string): DateAnalysis {
  const candidates: DateCandidate[] = [];

  DATE_PATTERNS.forEach(({ family, pattern }, rank) => {
    // Module-scope regexes are stateful: `.exec` on a global pattern keeps
    // lastIndex between calls, which would make detection depend on call order.
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match[0].length === 0) {
        pattern.lastIndex += 1;
        continue;
      }
      const year = extractYear(match[0], family);
      if (Number.isNaN(year)) continue;
      candidates.push({
        start: match.index,
        end: match.index + match[0].length,
        family,
        rank,
        year,
      });
    }
  });

  // One spatial sweep instead of a per-match scan over every span claimed so far.
  // Accepted spans come out sorted and mutually disjoint, so once candidates are
  // in start order only the most recently accepted span can overlap the next
  // one - the same argument that makes a sorted sweep linear.
  candidates.sort((left, right) => left.start - right.start || left.rank - right.rank);

  const dates: ResumeDate[] = [];
  let acceptedEnd = -1;
  for (const candidate of candidates) {
    if (candidate.start < acceptedEnd) continue;
    acceptedEnd = candidate.end;
    const raw = text.slice(candidate.start, candidate.end);
    const month = extractMonth(raw, candidate.family);
    dates.push({
      raw,
      year: candidate.year,
      family: candidate.family,
      ...(month === undefined ? {} : { month }),
      index: candidate.start,
    });
  }

  const familyCounts: Record<DateFormatFamily, number> = {
    "month-name-year": 0,
    "month-year": 0,
    "iso-month": 0,
    "full-date": 0,
    "year-only": 0,
    other: 0,
  };
  for (const date of dates) {
    familyCounts[date.family] += 1;
  }

  const summary = summarizeDateFamilies(dates);

  return {
    dates,
    familyCounts,
    dominantFamily: summary.dominantFamily,
    dominantShare: summary.dominantShare,
    distinctFamilies: summary.distinctFamilies,
    hasPresentMarker: PRESENT_PATTERN.test(text),
    ranges: parseDateRanges(text),
  };
}

/* ------------------------------------------------------------------ */
/* Date ranges                                                         */
/* ------------------------------------------------------------------ */

const MONTH_NAME_ALTERNATION = [...DATE_MONTHS, ...MONTH_ABBREVIATIONS]
  .sort((left, right) => right.length - left.length)
  .join("|");

/** `Jan 2019`, `January 2019`, `Sept 2019`. */
const MONTH_NAME_YEAR = `(?:${MONTH_NAME_ALTERNATION})[a-z]*\\.?\\s+(?:19|20)\\d{2}`;
/** `01/2020`, `01.2020`, `01-2020`. */
const NUMERIC_MONTH_YEAR = "\\d{1,2}[/.\\-](?:19|20)\\d{2}";
/** `2020-05`, `2020.05`. The month is spelled out so `2019-2021` is not read as one. */
const ISO_MONTH = "(?:19|20)\\d{2}[-/.](?:0?[1-9]|1[0-2])(?!\\d)";
const YEAR = "(?:19|20)\\d{2}";
const CONNECTOR = "(?:\\s*[-\u2013\u2014\u2212]\\s*|\\s+(?:to|until|till)\\s+)";
const PRESENT_WORD = "(?:present|current|currently|now|today|ongoing)";
/** `2019 - 21`: recognised, and reported as an incomplete range. */
const SHORT_YEAR = "['\u2019]?\\d{1,2}(?![\\dxX%])";

/**
 * Three shapes rather than one permissive one. `01/2020 - 03/2021`, `2020-05 to
 * 2021-06` and `2019 - 2021` all pair differently, and a single alternation
 * happily reads the year of one as the month of the next. The shapes are tried
 * in the order they are written and a later, shorter match that starts inside an
 * earlier one is discarded by the sweep below.
 */
const RANGE_PATTERNS: RegExp[] = [
  // Month-granular: a month on either side, or a month and a bare year.
  new RegExp(
    `(${MONTH_NAME_YEAR}|\\b${NUMERIC_MONTH_YEAR})\\b${CONNECTOR}` +
      `(${MONTH_NAME_YEAR}|${NUMERIC_MONTH_YEAR}\\b|${YEAR}\\b|${PRESENT_WORD}\\b)`,
    "gi",
  ),
  // ISO months, full on both sides.
  new RegExp(`(${ISO_MONTH})\\b${CONNECTOR}(${ISO_MONTH})`, "gi"),
  // Bare years, or a year and a present marker.
  new RegExp(
    `(${YEAR})\\b${CONNECTOR}(${YEAR}\\b|${PRESENT_WORD}\\b|${SHORT_YEAR})`,
    "gi",
  ),
];

/**
 * A single date endpoint, used by the same-line fallback that pairs two tokens
 * written without a connector.
 */
const RANGE_ENDPOINT_TOKEN = new RegExp(
  `\\b(?:${MONTH_NAME_YEAR}|${NUMERIC_MONTH_YEAR}|${ISO_MONTH}|${YEAR})\\b`,
  "gi",
);

const PRESENT_ENDPOINT = new RegExp(`^${PRESENT_WORD}$`, "i");
const NAME_ENDPOINT = /^([a-z]+)\.?\s+((?:19|20)\d{2})$/i;
const NUMERIC_MONTH_ENDPOINT = /^(\d{1,2})[/.\-]((?:19|20)\d{2})$/;
const ISO_MONTH_ENDPOINT = /^((?:19|20)\d{2})[-/.](0?[1-9]|1[0-2])$/;
const YEAR_ENDPOINT = /^((?:19|20)\d{2})$/;

/**
 * What may sit between two unconnected date tokens on one line: whitespace and
 * the separators a two-column export inserts between the two halves of a row.
 * A letter or digit in the gap means the tokens are not a pair.
 */
const RANGE_JOINER = /^[\s|,;&/()[\]]*$/;

interface RangeEndpoint {
  year: number | null;
  month: number | null;
  isPresent: boolean;
}

function parseRangeEndpoint(raw: string): RangeEndpoint | null {
  const trimmed = raw.trim();
  if (PRESENT_ENDPOINT.test(trimmed)) return { year: null, month: null, isPresent: true };

  const named = NAME_ENDPOINT.exec(trimmed);
  if (named !== null) {
    const name = (named[1] ?? "").toLowerCase();
    const month = MONTH_NUMBERS.get(name) ?? MONTH_NUMBERS.get(name.slice(0, 3));
    return {
      year: Number(named[2] ?? 0),
      month: month ?? null,
      isPresent: false,
    };
  }

  const numericMonth = NUMERIC_MONTH_ENDPOINT.exec(trimmed);
  if (numericMonth !== null) {
    return { year: Number(numericMonth[2]), month: Number(numericMonth[1]), isPresent: false };
  }

  const isoMonth = ISO_MONTH_ENDPOINT.exec(trimmed);
  if (isoMonth !== null) {
    return { year: Number(isoMonth[1]), month: Number(isoMonth[2]), isPresent: false };
  }

  const year = YEAR_ENDPOINT.exec(trimmed);
  if (year !== null) return { year: Number(year[1]), month: null, isPresent: false };

  // A short year: understood well enough to report, not well enough to compare.
  return { year: null, month: null, isPresent: false };
}

function buildRange(
  raw: string,
  index: number,
  start: RangeEndpoint | null,
  end: RangeEndpoint | null,
): ResumeDateRange | null {
  // `startYear` is required, so a range whose start cannot be read is not a
  // range this tool can report anything useful about.
  if (start === null || start.year === null) return null;

  const isPresent = end !== null && end.isPresent;
  const endYear = isPresent || end === null ? null : end.year;
  const range: ResumeDateRange = {
    raw,
    startYear: start.year,
    endYear,
    isPresent,
    index,
    isComplete: isPresent || endYear !== null,
  };
  if (start.month !== null) range.startMonth = start.month;
  if (end !== null && end.month !== null) range.endMonth = end.month;
  return range;
}

interface RangeCandidate {
  start: number;
  end: number;
  rank: number;
  range: ResumeDateRange;
}

/**
 * Pair date tokens into employment and education spans.
 *
 * Two tokens written side by side (`Jan 2019 - Dec 2024`, `2014 - 2018`,
 * `01/2020 – 03/2021`) pair through the shapes above. Two unconnected tokens on
 * the same line pair as a fallback, because a two-column export routinely writes
 * the start and the end of a span with only whitespace between them.
 */
export function parseDateRanges(text: string): ResumeDateRange[] {
  const candidates: RangeCandidate[] = [];

  RANGE_PATTERNS.forEach((pattern, rank) => {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match[0].length === 0) {
        pattern.lastIndex += 1;
        continue;
      }
      const range = buildRange(
        match[0],
        match.index,
        parseRangeEndpoint(match[1] ?? ""),
        parseRangeEndpoint(match[2] ?? ""),
      );
      if (range === null) continue;
      candidates.push({ start: match.index, end: match.index + match[0].length, rank, range });
    }
  });

  candidates.sort((left, right) => left.start - right.start || left.rank - right.rank);

  const ranges: ResumeDateRange[] = [];
  const claimed: Array<[number, number]> = [];
  let acceptedEnd = -1;
  for (const candidate of candidates) {
    if (candidate.start < acceptedEnd) continue;
    acceptedEnd = candidate.end;
    claimed.push([candidate.start, candidate.end]);
    ranges.push(candidate.range);
  }

  // Same-line, no connector. Only lines holding exactly two date tokens pair, so
  // a three-date line is left to the connector shapes rather than guessed at.
  const claims: ClaimScan = { claimed, cursor: 0 };
  let lineStart = 0;
  while (lineStart <= text.length) {
    const lineEnd = text.indexOf("\n", lineStart);
    const stop = lineEnd === -1 ? text.length : lineEnd;
    pairUnconnectedTokens(text, lineStart, stop, claims, ranges);
    if (lineEnd === -1) break;
    lineStart = lineEnd + 1;
  }

  ranges.sort((left, right) => left.index - right.index);
  return ranges;
}

interface ClaimScan {
  claimed: Array<[number, number]>;
  /** First claim that has not ended before the offset being tested. */
  cursor: number;
}

function pairUnconnectedTokens(
  text: string,
  lineStart: number,
  lineEnd: number,
  claims: ClaimScan,
  ranges: ResumeDateRange[],
): void {
  const tokens: Array<{ start: number; end: number; raw: string }> = [];
  RANGE_ENDPOINT_TOKEN.lastIndex = lineStart;
  let match: RegExpExecArray | null;
  while ((match = RANGE_ENDPOINT_TOKEN.exec(text)) !== null) {
    if (match[0].length === 0) {
      RANGE_ENDPOINT_TOKEN.lastIndex += 1;
      continue;
    }
    if (match.index >= lineEnd) break;
    if (isClaimed(claims, match.index)) continue;
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
    });
  }

  const first = tokens[0];
  const second = tokens[1];
  if (tokens.length !== 2 || first === undefined || second === undefined) return;
  if (!RANGE_JOINER.test(text.slice(first.end, second.start))) return;

  const range = buildRange(
    text.slice(first.start, second.end),
    first.start,
    parseRangeEndpoint(first.raw),
    parseRangeEndpoint(second.raw),
  );
  if (range === null) return;
  claims.claimed.push([first.start, second.end]);
  ranges.push(range);
}

/**
 * Whether an offset falls inside a span a connector shape already claimed.
 *
 * `claimed` is sorted and disjoint, and callers visit offsets in increasing
 * order, so the first span that has not ended before the offset is the only one
 * that can contain it - which is what keeps the line pass linear instead of
 * rescanning every claim for every token.
 */
function isClaimed(claims: ClaimScan, offset: number): boolean {
  while (claims.cursor < claims.claimed.length) {
    const span = claims.claimed[claims.cursor];
    if (span === undefined || span[1] > offset) break;
    claims.cursor += 1;
  }
  const span = claims.claimed[claims.cursor];
  return span !== undefined && span[0] <= offset;
}

export const DATE_FAMILY_LABELS: Record<DateFormatFamily, string> = {
  "month-name-year": "Month YYYY (e.g. Mar 2021)",
  "month-year": "MM/YYYY (e.g. 03/2021)",
  "iso-month": "YYYY-MM (e.g. 2021-03)",
  "full-date": "full dates (e.g. 17/03/2021)",
  "year-only": "year only (e.g. 2021)",
  other: "unrecognized format",
};