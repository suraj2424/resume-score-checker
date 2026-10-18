import { BULLET_GLYPHS, SECTION_DEFINITIONS } from "./constants";
import type { SectionDefinition } from "./constants";
import type { ResumeSection } from "./types";

const MAX_HEADING_LENGTH = 60;
const MAX_HEADING_WORDS = 6;

const BULLET_GLYPH_SET = new Set(BULLET_GLYPHS);

/**
 * Filler words dropped before the second pass at a heading.
 *
 * `&` and `/` survive `normalizeHeading` on purpose - they are legitimate
 * characters inside a technology name - which means "Skills & Tools" and
 * "Skills/Technologies" reach the alias table as themselves and match nothing.
 */
const FILLER_WORDS = new Set([
  "and",
  "or",
  "the",
  "a",
  "an",
  "of",
  "for",
  "to",
  "in",
  "my",
  "our",
]);

/**
 * Punctuation that means the line carries its own content rather than naming a
 * section. "Skills: Python, Java" is a list with a label on it, and the reason a
 * section cannot be located is itself useful signal, so an inline list is not
 * promoted into a heading at any tier.
 */
const INLINE_LIST_SEPARATOR = /[,;]/;
const INLINE_COLON = /\S\s*:|\s:/;

/** Decorative characters a heading is routinely wrapped in. */
const HEADING_DECORATION = /^[\s\p{P}\p{S}]+|[\s:：|-]+$/gu;

/** Normalize a heading candidate for comparison against known aliases. */
export function normalizeHeading(line: string): string {
  return line
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9+#./&\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface AliasEntry {
  definition: SectionDefinition;
  tokens: string[];
  /** Position in `SECTION_DEFINITIONS`, so ties resolve the same way every run. */
  definitionIndex: number;
}

/** Tier 1: an alias exactly as written. */
const ALIAS_TO_DEFINITION = new Map<string, AliasEntry>();

/** Tier 2: an alias once separators and filler words are removed. */
const FILLER_TO_DEFINITION = new Map<string, AliasEntry>();

/** Tier 3: the alias token set, for matching a superset of it. */
const TOKEN_SET_TO_DEFINITION = new Map<string, AliasEntry>();

/** Sorted, locale-independent key for a set of words. */
function tokenKey(tokens: string[]): string {
  // `sort()` without a comparator orders by code unit, which does not depend on
  // the host locale - the byte-identical determinism guarantee rests on that.
  return [...tokens].sort().join(" ");
}

function withoutFiller(normalized: string): string[] {
  return normalized
    .replace(/[#+/&]/g, " ")
    .split(" ")
    .filter((token) => token.length > 0 && !FILLER_WORDS.has(token));
}

SECTION_DEFINITIONS.forEach((definition, definitionIndex) => {
  for (const alias of definition.aliases) {
    const normalized = normalizeHeading(alias);
    const tokens = normalized.split(" ").filter((token) => token.length > 0);
    if (tokens.length === 0) continue;

    const entry: AliasEntry = { definition, tokens, definitionIndex };
    if (!ALIAS_TO_DEFINITION.has(normalized)) ALIAS_TO_DEFINITION.set(normalized, entry);

    const setKey = tokenKey(tokens);
    const existing = TOKEN_SET_TO_DEFINITION.get(setKey);
    if (
      existing === undefined ||
      entry.tokens.length > existing.tokens.length ||
      (entry.tokens.length === existing.tokens.length && definitionIndex < existing.definitionIndex)
    ) {
      TOKEN_SET_TO_DEFINITION.set(setKey, entry);
    }

    const stripped = withoutFiller(normalized);
    if (stripped.length === 0 || stripped.length === tokens.length) continue;
    const fillerKey = stripped.join(" ");
    const filler = FILLER_TO_DEFINITION.get(fillerKey);
    if (
      filler === undefined ||
      entry.tokens.length > filler.tokens.length ||
      (entry.tokens.length === filler.tokens.length && definitionIndex < filler.definitionIndex)
    ) {
      FILLER_TO_DEFINITION.set(fillerKey, entry);
    }
  }
});

/** A definition paired with the alias it was matched by. */
export interface HeadingMatch {
  definition: SectionDefinition;
  /** The alias that matched, after normalization. */
  alias: string;
  /** How much work the match needed: 0 exact, 1 filler-stripped, 2 superset. */
  rank: 0 | 1 | 2;
}

/**
 * A line cannot be a heading when it is a bullet. Without this, "Community
 * outreach programme" under a bullet glyph becomes a volunteer section, because
 * "community" is a real alias and the third tier accepts a superset of it.
 */
function startsWithBulletMarker(line: string): boolean {
  const first = line.charAt(0);
  if (first.length === 0) return false;
  if (BULLET_GLYPH_SET.has(first)) return true;
  return (
    (first === "-" || first === "*" || first === "\u2013") && line.charAt(1) === " "
  );
}

/**
 * Resolve a heading line to the section it names.
 *
 * Exact alias matching missed every heading a candidate decorates in passing -
 * "Skills & Tools", "Technical Skills & Tools", "Key Competencies",
 * "Skills/Technologies", "Career Summary", "Executive Summary",
 * "Awards & Honors" - and a section that is not found is not merely unreported:
 * it fails presence, it makes dependent checks not-applicable, and it drops out
 * of the heading count. One unrecognised heading is worth up to nine points.
 *
 * Still conservative. "Skills: Python, Java" carries its own content and is not
 * a heading, and "Experienced in project management" does not contain
 * `experience` as a token, so it is not one either. A single-word alias only
 * matches a heading of at most two words, which is what stops a bullet that
 * happens to contain "community" from becoming a section.
 *
 * Takes raw heading text; `normalizeHeading` is idempotent, so passing an
 * already-normalized value is safe.
 */
export function matchSectionHeading(line: string): HeadingMatch | undefined {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_HEADING_LENGTH) return undefined;
  if (trimmed.split(/\s+/).length > MAX_HEADING_WORDS) return undefined;
  if (startsWithBulletMarker(trimmed)) return undefined;

  const bare = trimmed.replace(HEADING_DECORATION, " ").trim();
  if (bare.length === 0) return undefined;
  if (INLINE_LIST_SEPARATOR.test(bare) || INLINE_COLON.test(bare)) return undefined;

  const normalized = normalizeHeading(bare);
  if (normalized.length === 0) return undefined;

  const exact = ALIAS_TO_DEFINITION.get(normalized);
  if (exact !== undefined) return { definition: exact.definition, alias: normalized, rank: 0 };

  const stripped = withoutFiller(normalized);
  const fillerKey = stripped.join(" ");
  if (fillerKey.length > 0) {
    const filler = FILLER_TO_DEFINITION.get(fillerKey);
    if (filler !== undefined) return { definition: filler.definition, alias: fillerKey, rank: 1 };
  }

  return matchSuperset(stripped);
}

/**
 * Tier 3: the candidate contains every word of some alias.
 *
 * Subsets are enumerated rather than the alias list scanned, so a six-word
 * candidate costs at most 63 map lookups and never grows with the dictionary.
 * The longest alias wins and ties go to the earlier definition, so the result
 * does not depend on iteration order.
 */
function matchSuperset(tokens: string[]): HeadingMatch | undefined {
  if (tokens.length === 0) return undefined;

  let bestEntry: AliasEntry | undefined;
  let bestAlias = "";
  const size = tokens.length;

  for (let mask = 1; mask < 1 << size; mask += 1) {
    const subset: string[] = [];
    for (let bit = 0; bit < size; bit += 1) {
      if ((mask & (1 << bit)) === 0) continue;
      const token = tokens[bit];
      if (token !== undefined) subset.push(token);
    }
    const entry = TOKEN_SET_TO_DEFINITION.get(tokenKey(subset));
    if (entry === undefined) continue;
    // A one-word alias needs a one- or two-word candidate. "Skills & Tools"
    // matches "skills"; "led community outreach programme" does not.
    if (entry.tokens.length === 1 && size > 2) continue;
    if (
      bestEntry === undefined ||
      entry.tokens.length > bestEntry.tokens.length ||
      (entry.tokens.length === bestEntry.tokens.length &&
        entry.definitionIndex < bestEntry.definitionIndex)
    ) {
      bestEntry = entry;
      bestAlias = subset.join(" ");
    }
  }

  if (bestEntry === undefined) return undefined;
  return { definition: bestEntry.definition, alias: bestAlias, rank: 2 };
}

/**
 * Detect resume sections from normalized lines.
 *
 * Conservative by design: a line is only treated as a heading when it is short,
 * is not a bullet, carries no content of its own, and names a known section.
 */
export function detectSections(lines: string[], lineOffsets: number[]): ResumeSection[] {
  const headings: Array<{ lineIndex: number; definition: SectionDefinition }> = [];

  lines.forEach((line, index) => {
    const match = matchSectionHeading(line);
    if (match === undefined) return;
    headings.push({ lineIndex: index, definition: match.definition });
  });

  const sections: ResumeSection[] = [];
  const usedIds = new Map<string, number>();

  headings.forEach((heading, position) => {
    const lineIndex = heading.lineIndex;
    const startIndex = lineOffsets[lineIndex] ?? 0;
    const lineLength = (lines[lineIndex] ?? "").length;
    let endIndex: number;
    const nextHeading = headings[position + 1];
    if (nextHeading) {
      endIndex = lineOffsets[nextHeading.lineIndex] ?? startIndex + lineLength;
    } else {
      endIndex = lineOffsets[lineOffsets.length - 1] ?? startIndex;
      const lastLineLength = lines[lines.length - 1]?.length ?? 0;
      endIndex += lastLineLength;
    }

    let id = heading.definition.id;
    const seen = usedIds.get(id) ?? 0;
    usedIds.set(id, seen + 1);
    if (seen > 0) id = `${id}-${seen + 1}`;

    const contentLines = lines.slice(lineIndex + 1, nextHeading?.lineIndex ?? lines.length);
    const content = contentLines.join("\n").trim();

    sections.push({
      id,
      heading: (lines[lineIndex] ?? "").trim(),
      normalizedHeading: normalizeHeading((lines[lineIndex] ?? "").trim()),
      content,
      startIndex,
      endIndex,
      order: position,
    });
  });

  return sections;
}

/** Case style of a heading line, used for the heading-consistency check. */
export function headingCaseStyle(heading: string): "upper" | "lower" | "title" {
  const letters = heading.replace(/[^A-Za-z]/g, "");
  if (letters.length === 0) return "title";
  if (letters === letters.toUpperCase()) return "upper";
  if (letters === letters.toLowerCase()) return "lower";
  return "title";
}

/** Share (0..1) of headings that follow the dominant casing style. */
export function headingStyleShare(sections: ResumeSection[]): number {
  if (sections.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const section of sections) {
    const style = headingCaseStyle(section.heading);
    counts.set(style, (counts.get(style) ?? 0) + 1);
  }
  const dominant = Math.max(...counts.values());
  return dominant / sections.length;
}

export function hasSection(sections: ResumeSection[], id: string): boolean {
  return sections.some((section) => section.id === id || section.id.startsWith(`${id}-`));
}

export function getSection(sections: ResumeSection[], id: string): ResumeSection | undefined {
  return sections.find((section) => section.id === id || section.id.startsWith(`${id}-`));
}

export function getSections(sections: ResumeSection[], id: string): ResumeSection[] {
  return sections.filter((section) => section.id === id || section.id.startsWith(`${id}-`));
}

/** Section ids that demonstrate practical work beyond a summary block. */
export function hasEquivalentExperience(sections: ResumeSection[]): boolean {
  return sections.some((section) =>
    ["internships", "projects", "volunteer", "activities"].includes(section.id.replace(/-\d+$/, "")),
  );
}