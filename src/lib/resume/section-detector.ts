import { SECTION_DEFINITIONS } from "./constants";
import type { ResumeSection } from "./types";

const MAX_HEADING_LENGTH = 60;
const MAX_HEADING_WORDS = 6;

/** Normalize a heading candidate for comparison against known aliases. */
export function normalizeHeading(line: string): string {
  return line
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9+#./&\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIAS_TO_DEFINITION = new Map<string, (typeof SECTION_DEFINITIONS)[number]>();
for (const definition of SECTION_DEFINITIONS) {
  for (const alias of definition.aliases) {
    ALIAS_TO_DEFINITION.set(normalizeHeading(alias), definition);
  }
}

/**
 * Detect resume sections from normalized lines.
 *
 * Conservative by design: a line is only treated as a heading when it is
 * short and matches a known heading alias (with optional trailing colon or
 * decorative dashes). Inline headings such as "Skills: Python, Java" are not
 * split, because the reason a section cannot be located is itself useful
 * signal for the scoring rules.
 */
export function detectSections(lines: string[], lineOffsets: number[]): ResumeSection[] {
  const headings: Array<{ lineIndex: number; definition: (typeof SECTION_DEFINITIONS)[number] }> = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_HEADING_LENGTH) return;
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount > MAX_HEADING_WORDS) return;

    const stripped = trimmed.replace(/^[\s\p{P}\p{S}]+|[\s:：|-]+$/gu, " ").trim();
    const normalized = normalizeHeading(stripped);
    if (normalized.length === 0) return;

    const definition = ALIAS_TO_DEFINITION.get(normalized);
    if (!definition) return;
    headings.push({ lineIndex: index, definition });
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
