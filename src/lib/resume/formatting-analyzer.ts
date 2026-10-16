import {
  SCORING_THRESHOLDS,
} from "@/config/scoring";
import type {
  DocumentStructure,
  FormattingSignal,
  ResumeSection,
  ResumeTextStats,
} from "./types";
import type { DateAnalysis } from "./date-analyzer";
import type { ResumeBullet } from "./types";
import { headingStyleShare } from "./section-detector";

export interface FormattingInput {
  normalizedText: string;
  stats: ResumeTextStats;
  structure?: DocumentStructure;
  pageCount?: number;
  sections: ResumeSection[];
  dates: DateAnalysis;
  bullets: ResumeBullet[];
}

/**
 * Convert observable document traits into formatting signals. Signals are
 * always phrased as observations ("may be read in an unexpected order"), never
 * as claims of ATS compatibility.
 */
export function analyzeFormatting(input: FormattingInput): FormattingSignal[] {
  const signals: FormattingSignal[] = [];
  const { stats, structure, pageCount, sections, dates, bullets } = input;

  if (stats.wordCount === 0) {
    signals.push({
      type: "no-text-extracted",
      severity: "critical",
      confidence: "high",
      explanation:
        "No selectable text could be extracted from this document. Scanned or image-only pages cannot be read without OCR, which this tool does not perform.",
    });
    return signals;
  }

  if (stats.wordCount < SCORING_THRESHOLDS.minimalWords) {
    signals.push({
      type: "very-little-text",
      severity: "warning",
      confidence: "high",
      explanation: `Only ${stats.wordCount} words of text could be extracted, which is too little to assess a full resume.`,
    });
  }

  if (stats.replacementCharCount > 0) {
    signals.push({
      type: "replacement-characters",
      severity: "critical",
      confidence: "high",
      explanation:
        "Some characters could not be decoded and appear as replacement symbols. This usually indicates a corrupted or unusual text encoding.",
    });
  }

  if (stats.maxBlankLineRun >= 3) {
    signals.push({
      type: "excessive-blank-lines",
      severity: "warning",
      confidence: "medium",
      explanation:
        "Large runs of empty lines were detected. Excessive whitespace can push content onto extra pages and suggests manual layout work.",
    });
  }

  if (
    stats.longestLineRatio >= SCORING_THRESHOLDS.longLineRatioWarning &&
    stats.longestLineLength > SCORING_THRESHOLDS.longLineCharacters
  ) {
    signals.push({
      type: "long-lines",
      severity: "warning",
      confidence: "medium",
      explanation:
        "Many lines are far longer than a normal sentence. This often happens with tables or multi-column layouts, where content may be read in an unexpected order.",
    });
  }

  const imageOnlyPages = structure?.imageOnlyPages ?? [];
  if (imageOnlyPages.length > 0) {
    signals.push({
      type: "image-only-pages",
      severity: "critical",
      confidence: "high",
      explanation: `${
        imageOnlyPages.length === 1 ? "Page" : "Pages"
      } ${imageOnlyPages.join(", ")} contain no selectable text. This tool does not perform OCR, so that content cannot be analyzed.`,
    });
  }

  if ((structure?.tableCount ?? 0) > 0) {
    signals.push({
      type: "tables-detected",
      severity: "warning",
      confidence: "medium",
      explanation:
        "Tables were detected in the document. Content in tables can be read in an unexpected order by resume parsers, so review the extracted text preview.",
    });
  }

  if (structure?.hasColumns) {
    signals.push({
      type: "columns-detected",
      severity: "warning",
      confidence: "low",
      explanation:
        "The document uses multiple text columns. Some parsers may read the content in an unexpected order, so verify the extracted text matches your intended layout.",
    });
  }

  if (structure?.hasHeaderFooter) {
    signals.push({
      type: "header-footer",
      severity: "info",
      confidence: "medium",
      explanation:
        "The document contains headers or footers. Some parsers include this text in the main content, and some ignore it.",
    });
  }

  if (pageCount !== undefined && pageCount > SCORING_THRESHOLDS.longResumePages) {
    signals.push({
      type: "many-pages",
      severity: "info",
      confidence: "high",
      explanation: `The document has ${pageCount} pages. Single-page resumes are the norm for most early-career roles; ${SCORING_THRESHOLDS.longResumePages + 1} or more pages is unusual.`,
    });
  }

  if (sections.length >= 2 && headingStyleShare(sections) < SCORING_THRESHOLDS.headingStyleSharePass) {
    signals.push({
      type: "mixed-heading-styles",
      severity: "warning",
      confidence: "low",
      explanation:
        "Section headings use inconsistent capitalization styles. Consistent headings make a resume easier to scan and to parse.",
    });
  }

  if (bullets.length === 0 && stats.wordCount >= SCORING_THRESHOLDS.minimalWords) {
    signals.push({
      type: "no-bullet-markers",
      severity: "info",
      confidence: "high",
      explanation:
        "No bullet markers were detected. Paragraph formatting can work, but bullet points make achievements easier to scan.",
    });
  }

  const nearEmptyBullets = bullets.filter((bullet) => bullet.wordCount <= 1).length;
  if (nearEmptyBullets > 0) {
    signals.push({
      type: "near-empty-bullets",
      severity: "warning",
      confidence: "high",
      explanation: `${nearEmptyBullets} bullet ${nearEmptyBullets === 1 ? "item has" : "items have"} almost no content.`,
    });
  }

  if (dates.dates.length >= 3 && dates.distinctFamilies >= 2) {
    signals.push({
      type: "inconsistent-date-formats",
      severity: "warning",
      confidence: "medium",
      explanation:
        "Dates appear in more than one format. Consistent date formats are easier for recruiters and parsers to interpret.",
    });
  }

  return signals;
}
