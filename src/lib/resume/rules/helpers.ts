import { RECOGNIZED_SKILLS } from "../constants";
import { redactContact } from "../redact";
import type {
  ResumeBullet,
  ResumeCheck,
  ResumeSection,
} from "../types";
import { SCORING_THRESHOLDS } from "@/config/scoring";

/* ------------------------------------------------------------------ */
/* Shared helpers for the Tech Interview Handbook validations          */
/* ------------------------------------------------------------------ */

/**
 * Glyphs that survive a copy-paste into a plain text file but then render as
 * boxes, or are dropped entirely, once a parser or a recruiter's terminal
 * handles them. Emoji and pictographs are the common case; the handbook's
 * plain-text-file test exists precisely because this is hard to notice in a
 * word processor.
 *
 * This deliberately excludes ordinary typographic punctuation (curly quotes,
 * en dashes, bullet glyphs) which round-trips fine.
 */
export const GLYPH_PATTERN =
  /\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\u2190-\u21FF\u2300-\u27BF\u2B00-\u2BFF]/gu;

/** Count pictographic characters in a string. */
export function countGlyphs(text: string): number {
  return (text.match(GLYPH_PATTERN) ?? []).length;
}

/** First few glyph-bearing snippets, for privacy-safe evidence. */
export function glyphSamples(text: string, max = 3): string[] {
  const lines = text.split("\n");
  const samples: string[] = [];
  for (const line of lines) {
    if (!GLYPH_PATTERN.test(line)) continue;
    GLYPH_PATTERN.lastIndex = 0;
    const found = line.match(GLYPH_PATTERN) ?? [];
    const clean = line.replace(/\s+/g, " ").trim();
    samples.push(
      `"${clean.slice(0, 60)}${clean.length > 60 ? "…" : ""}" — ${found.join(" ")}`,
    );
    if (samples.length >= max) break;
  }
  return samples;
}

/** A role entry is a short, non-bulleted line that carries at least one year. */
const ROLE_YEAR_PATTERN = new RegExp(
  `(?:19|20)\\d{2}`,
  "g",
);
const MAX_ROLE_LINE_LENGTH = 140;

export interface RoleEntry {
  line: string;
  /** Most recent year mentioned, used as the entry's sort position. */
  latestYear: number;
  years: number[];
}

export function findRoleEntries(content: string): RoleEntry[] {
  const entries: RoleEntry[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line.length === 0 || line.length > MAX_ROLE_LINE_LENGTH) continue;
    // Bullets describe work, they are not the role header line.
    if (/^[•▪◦‣∙·*\-–—>+»]/.test(line)) continue;
    const years = [...line.matchAll(ROLE_YEAR_PATTERN)].map((m) => Number(m[0]));
    const plausible = years.filter((year) => year >= SCORING_THRESHOLDS.plausibleYearMin);
    if (plausible.length === 0) continue;
    entries.push({
      line: line.replace(/\s+/g, " ").slice(0, 80),
      years: plausible,
      latestYear: Math.max(...plausible),
    });
  }
  return entries;
}

/** Roles should read newest first. Returns the entries that break that order. */
export function findOutOfOrderEntries(entries: RoleEntry[]): RoleEntry[] {
  const offenders: RoleEntry[] = [];
  for (let index = 1; index < entries.length; index += 1) {
    const previous = entries[index - 1]!;
    const current = entries[index]!;
    if (current.latestYear > previous.latestYear) offenders.push(current);
  }
  return offenders;
}

export function share(part: number, total: number): number {
  if (total <= 0) return 0;
  return part / total;
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Privacy-safe evidence snippet for a bullet.
 *
 * Contact details are redacted before the text is quoted: the privacy policy
 * promises the report never displays an address, number or link, and a bullet
 * can carry one even though the contact line is handled separately.
 *
 * Truncation cuts on a word boundary and never leaves half a redaction label
 * behind — "[link removed…" tells the reader nothing and reads like a bug.
 */
export function bulletEvidence(bullet: ResumeBullet, maxLength = 60): string {
  const { text } = redactContact(bullet.text);
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= maxLength) return `"${flat}"`;

  let cut = flat.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.5) cut = cut.slice(0, lastSpace);
  // Drop a redaction label that the cut ran into the middle of.
  cut = cut.replace(/\[(email|link|phone)[a-z ]*$/i, "").trimEnd();
  return `"${cut}…"`;
}

export function formatHeadingList(sections: ResumeSection[], max = 5): string {
  const headings = sections.slice(0, max).map((section) => section.heading);
  if (sections.length > max) headings.push(`${sections.length - max} more`);
  return headings.join(", ");
}

export function hasAnySection(sections: ResumeSection[], ids: string[]): boolean {
  return sections.some((section) => ids.includes(section.id.replace(/-\d+$/, "")));
}

export function sectionTitles(sections: ResumeSection[], ids: string[]): string[] {
  return sections
    .filter((section) => ids.includes(section.id.replace(/-\d+$/, "")))
    .map((section) => section.heading);
}

export const UNABLE_TO_VERIFY_NOTE =
  "This check could not be evaluated from the text that could be extracted, so it was excluded from the score instead of counted as a failure.";

export const SKILL_COUNT_HINT = `Skill detection compares your document against a fixed list of ${RECOGNIZED_SKILLS.length} common terms. It shows what was recognized, not a complete inventory of everything you know.`;

export const RELEVANCE_LIMIT_NOTE =
  "Relevance cannot be fully assessed without knowing the target role, so this category measures general skills signals rather than job-specific keyword matching.";

export type { ResumeCheck };