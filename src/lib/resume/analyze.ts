import { analyzeDates } from "./date-analyzer";
import { analyzeFormatting } from "./formatting-analyzer";
import { detectSections } from "./section-detector";
import { detectSkills } from "./skills-detector";
import { normalizeText } from "./text-normalizer";
import { analyzeBullets } from "./bullet-analyzer";
import { detectContact } from "./contact-detector";
import type { ParsedResume, SourceDocument } from "./types";
import { scoreResume } from "./score-engine";
import type { ScoreReport } from "./types";

/**
 * Build the normalized resume model from a raw extracted document.
 * Pure and synchronous: no UI, no I/O, fully testable.
 */
export function buildParsedResume(source: SourceDocument): ParsedResume {
  const { normalizedText, lines, lineOffsets, stats } = normalizeText(source.text);

  const sections = detectSections(lines, lineOffsets);
  const contact = detectContact(normalizedText);
  const { bullets, duplicateTexts } = analyzeBullets(normalizedText, lines, lineOffsets, sections);
  const dates = analyzeDates(normalizedText);
  const skills = detectSkills(normalizedText);
  const formattingSignals = analyzeFormatting({
    normalizedText,
    stats,
    structure: source.structure,
    pageCount: source.pageCount,
    sections,
    dates,
    bullets,
  });

  const parsingWarnings = [...(source.warnings ?? [])];
  if (duplicateTexts.length > 0) {
    parsingWarnings.push({
      code: "duplicate-bullets",
      message: `${duplicateTexts.length} repeated bullet ${duplicateTexts.length === 1 ? "item was" : "items were"} found.`,
    });
  }

  return {
    fileName: source.fileName,
    fileType: source.fileType,
    pageCount: source.pageCount,
    rawText: source.text,
    normalizedText,
    sections,
    contact,
    bullets,
    dates: dates.dates,
    skills: skills.skills,
    genericTermMentions: skills.genericMentions,
    formattingSignals,
    parsingWarnings,
    stats,
  };
}

export interface AnalysisResult {
  resume: ParsedResume;
  report: ScoreReport;
}

/** Full deterministic pipeline: document -> normalized model -> score report. */
export function analyzeSourceDocument(source: SourceDocument): AnalysisResult {
  const resume = buildParsedResume(source);
  const report = scoreResume(resume);
  return { resume, report };
}
