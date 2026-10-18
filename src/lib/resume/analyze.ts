import { analyzeDates } from "./date-analyzer";
import { analyzeFormatting } from "./formatting-analyzer";
import { detectSections } from "./section-detector";
import { detectSkills } from "./skills-detector";
import { normalizeText } from "./text-normalizer";
import { analyzeBullets } from "./bullet-analyzer";
import { detectContact } from "./contact-detector";
import type { ParsedResume, SourceDocument } from "./types";

/**
 * Build the normalized resume model from a raw extracted document.
 * Pure and synchronous: no UI, no I/O, fully testable.
 */
export function buildParsedResume(source: SourceDocument): ParsedResume {
  const { normalizedText, lines, lineOffsets, stats } = normalizeText(source.text);

  const sections = detectSections(lines, lineOffsets);
  const contact = detectContact(normalizedText);
  const { bullets, duplicates } = analyzeBullets(normalizedText, lines, lineOffsets, sections);
  const dates = analyzeDates(normalizedText);
  const skills = detectSkills(normalizedText);
  const formattingSignals = analyzeFormatting({
    stats,
    structure: source.structure,
    sections,
    bullets,
  });

  // The warning is written from the findings, never the other way round. It used
  // to be built from a count and then scraped back out of its own sentence by
  // the duplicate rule, so rewording the message silently changed the score.
  const parsingWarnings = [...(source.warnings ?? [])];
  if (duplicates.length > 0) {
    const extraCopies = duplicates.reduce((total, finding) => total + finding.extraCopies, 0);
    parsingWarnings.push({
      code: "duplicate-bullets",
      message: `${duplicates.length} repeated bullet ${duplicates.length === 1 ? "item was" : "items were"} found, ${extraCopies} ${extraCopies === 1 ? "copy" : "copies"} in total.`,
    });
  }

  return {
    fileName: source.fileName,
    fileType: source.fileType,
    pageCount: source.pageCount,
    rawText: source.text,
    normalizedText,
    documentStructure: source.structure,
    sections,
    contact,
    bullets,
    dates: dates.dates,
    dateRanges: dates.ranges,
    skills: skills.skills,
    genericTermMentions: skills.genericMentions,
    duplicateBullets: duplicates,
    formattingSignals,
    parsingWarnings,
    stats,
  };
}