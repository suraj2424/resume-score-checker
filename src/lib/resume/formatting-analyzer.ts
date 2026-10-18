import { SCORING_THRESHOLDS } from "@/config/scoring";
import type {
  DocumentStructure,
  FormattingSignal,
  ResumeBullet,
  ResumeSection,
  ResumeTextStats,
} from "./types";

export interface FormattingInput {
  stats: ResumeTextStats;
  structure?: DocumentStructure;
  sections: ResumeSection[];
  bullets: ResumeBullet[];
}

/**
 * Convert observable document traits into formatting signals.
 *
 * One rule decides what belongs here: a fact a scored check already reports does
 * not also appear as a signal. The report renders checks and signals in two
 * different visual systems side by side, so a duplicate is not repetition a
 * reader can skim past - it is the same sentence twice, with no way to tell
 * which of the two to act on. Signals are therefore reserved for what no check
 * measures: structural facts only the parser can observe.
 *
 * That removes the old `replacement-characters`, `excessive-blank-lines`,
 * `long-lines`, `mixed-heading-styles`, `inconsistent-date-formats`,
 * `many-pages`, `very-little-text` and `no-bullet-markers` signals, all of which
 * restated a readability, structure or content check with the same threshold.
 * `image-only-pages` went for a different reason: the PDF parser already emits a
 * parsing warning under that exact code, and the snapshot renders warnings and
 * signals in the same list, so it appeared twice by construction.
 *
 * Signals are always phrased as observations ("may be read in an unexpected
 * order"), never as claims of ATS compatibility.
 */
export function analyzeFormatting(input: FormattingInput): FormattingSignal[] {
  const signals: FormattingSignal[] = [];
  const { stats, structure, sections, bullets } = input;

  if (stats.wordCount === 0) {
    // The one early return kept: with no text there is nothing for the checks to
    // measure either, and this is the analyzer's bail-out rather than a second
    // copy of `readability-extractable-text`.
    signals.push({
      type: "no-text-extracted",
      severity: "critical",
      confidence: "high",
      explanation:
        "No selectable text could be extracted from this document. Scanned or image-only pages cannot be read without OCR, which this tool does not perform.",
    });
    return signals;
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

  // `interleavedLineCount` and `ambiguousPageCount` are deliberately not
  // signalled here: the reading-order and scanned-page checks measure them, and
  // a signal would put the same evidence in front of the reader a second time.

  // The one duplicated predicate kept, because the check that already measures
  // it says how many bullets and quotes them, while this says nothing the reader
  // can act on - and it is the only place the two definitions of "too short"
  // (`<= 1` word here, `< 5` there) have to agree. Unifying them to one
  // threshold is worth more than the duplicate sentence.
  const shortBulletLimit = SCORING_THRESHOLDS.shortBulletWords;
  const shortBullets = bullets.filter((bullet) => bullet.wordCount < shortBulletLimit).length;
  if (shortBullets > 0) {
    signals.push({
      type: "short-bullets",
      severity: "warning",
      confidence: "high",
      explanation: `${shortBullets} bullet ${shortBullets === 1 ? "item is" : "items are"} shorter than ${shortBulletLimit} words and may not explain the work.`,
    });
  }

  const hasSections = sections.length >= SCORING_THRESHOLDS.minimumRoleEntries;
  if (hasSections && bullets.length === 0 && stats.wordCount >= SCORING_THRESHOLDS.minimalWords) {
    // Kept where the scored bullet check cannot reach: with no bullets at all the
    // content checks return `not-applicable`, so nothing downstream reports that
    // this document has no bullet structure to inspect.
    signals.push({
      type: "no-bullets-in-sectioned-document",
      severity: "info",
      confidence: "medium",
      explanation:
        "No bullet markers were found anywhere in a document that does have section headings. The content may be written as paragraphs, which recruiters find slower to scan.",
    });
  }

  return signals;
}