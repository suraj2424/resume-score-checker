import { DATE_MONTHS, MONTH_ABBREVIATIONS } from "./constants";
import type { DateFormatFamily, ResumeDate } from "./types";

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

export interface DateAnalysis {
  dates: ResumeDate[];
  familyCounts: Record<DateFormatFamily, number>;
  dominantFamily: DateFormatFamily | null;
  dominantShare: number;
  distinctFamilies: number;
  hasPresentMarker: boolean;
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

/**
 * Detect date-like tokens and classify their format family. Date-format
 * consistency is checked by comparing family counts, not by parsing
 * semantics, so unusual-but-consistent formats are never penalized.
 */
export function analyzeDates(text: string): DateAnalysis {
  const dates: ResumeDate[] = [];
  const consumed: Array<[number, number]> = [];

  const isConsumed = (start: number, end: number) =>
    consumed.some(([from, to]) => start < to && end > from);

  for (const { family, pattern } of DATE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (isConsumed(start, end)) continue;
      consumed.push([start, end]);
      const year = extractYear(match[0], family);
      if (Number.isNaN(year)) continue;
      dates.push({ raw: match[0], year, family });
    }
  }

  dates.sort((a, b) => a.raw.localeCompare(b.raw));

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
  };
}

export const DATE_FAMILY_LABELS: Record<DateFormatFamily, string> = {
  "month-name-year": "Month YYYY (e.g. Mar 2021)",
  "month-year": "MM/YYYY (e.g. 03/2021)",
  "iso-month": "YYYY-MM (e.g. 2021-03)",
  "full-date": "full dates (e.g. 17/03/2021)",
  "year-only": "year only (e.g. 2021)",
  other: "unrecognized format",
};
