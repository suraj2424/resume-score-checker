import { SCORING_THRESHOLDS } from "@/config/scoring";
import type { ResumeCheck } from "../types";
import { DATE_FAMILY_LABELS, summarizeDateFamilies } from "../date-analyzer";
import { headingCaseStyle } from "../section-detector";
import {
  UNABLE_TO_VERIFY_NOTE,
  countGlyphs,
  glyphSamples,
  percent,
} from "./helpers";

const WORDS_PER_PAGE = 550;

/** DOCX files have no reliable page count; estimate one from word count. */
function estimatePages(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_PAGE));
}

export const readabilityChecks: ResumeCheck[] = [
  {
    id: "readability-extractable-text",
    categoryId: "readability",
    title: "Meaningful text can be extracted",
    description:
      "Whether the document contains enough selectable text to analyze, which is also what an ATS first needs.",
    severity: "high",
    points: 5,
    evaluate: (resume) => {
      const words = resume.stats.wordCount;
      if (words >= SCORING_THRESHOLDS.minimalWords) {
        return {
          status: "pass",
          explanation: `${words} words of selectable text were extracted, which is enough to analyze the resume.`,
          confidence: "high",
        };
      }
      if (words >= 20) {
        return {
          status: "warning",
          explanation: `Only ${words} words of selectable text were extracted. A resume of this length is unusual.`,
          recommendation:
            "Check whether the file is a scanned document or exported as images. If the resume is genuinely this short, add more detail.",
          confidence: "high",
        };
      }
      return {
        status: "issue",
        explanation:
          "Almost no selectable text could be extracted. Parsers, including applicant tracking systems, cannot read images of text.",
        recommendation:
          "Export or save the resume as a text-based PDF or DOCX. This tool does not perform OCR on scanned pages.",
        confidence: "high",
      };
    },
  },
  {
    id: "readability-page-count",
    categoryId: "readability",
    title: "Approximate document length",
    description:
      "Whether the resume length is in the typical range for most applications.",
    severity: "info",
    points: 3,
    evaluate: (resume) => {
      const isEstimate = resume.pageCount === undefined;
      const pages = resume.pageCount ?? estimatePages(resume.stats.wordCount);
      const estimateNote = isEstimate
        ? " Page count is estimated from the word count because DOCX files do not store page breaks."
        : "";

      if (pages <= 2) {
        return {
          status: "pass",
          explanation: `The resume is about ${pages} page${pages === 1 ? "" : "s"}, which is the usual length for most applications.${estimateNote}`,
          confidence: isEstimate ? "low" : "high",
        };
      }
      if (pages === SCORING_THRESHOLDS.typicalMaxPages) {
        return {
          status: "warning",
          explanation: `The resume is about ${pages} pages. Two pages is acceptable for experienced candidates, but only if every line earns its place.${estimateNote}`,
          recommendation:
            "Cut the oldest or least relevant roles to their most impressive achievement.",
          confidence: isEstimate ? "low" : "high",
        };
      }
      // DOCX page counts are a 550-words-per-page estimate, so a long estimate
      // is capped at a warning: penalizing an approximation as a hard failure
      // would punish users for the estimator's error, not their resume.
      if (isEstimate) {
        return {
          status: "warning",
          explanation: `The resume is estimated at about ${pages} pages, which is unusually long for most roles.${estimateNote} Because this is an estimate, verify the real page count in your editor.`,
          recommendation:
            "Trim to the most relevant experience, and move older detail into a portfolio or LinkedIn profile.",
          confidence: "low",
        };
      }
      return {
        status: "issue",
        explanation: `The resume is about ${pages} pages, which is unusually long for most roles.${estimateNote}`,
        recommendation:
          "Trim to the most relevant experience, and move older detail into a portfolio or LinkedIn profile.",
        confidence: isEstimate ? "low" : "high",
      };
    },
  },
  {
    id: "readability-whitespace-encoding",
    categoryId: "readability",
    title: "No whitespace or encoding artifacts",
    description:
      "Whether the text contains artifacts such as long empty gaps or undecodable characters.",
    severity: "low",
    points: 3,
    evaluate: (resume) => {
      const hasReplacementChars = resume.stats.replacementCharCount > 0;
      const hasBlankRuns = resume.stats.maxBlankLineRun >= 3;

      if (hasReplacementChars) {
        return {
          status: "issue",
          explanation: `${resume.stats.replacementCharCount} characters could not be decoded and appear as replacement symbols. This usually points to an encoding or export problem.`,
          recommendation:
            "Re-save or re-export the document as PDF or DOCX from the original editor.",
          confidence: "high",
        };
      }
      if (hasBlankRuns) {
        return {
          status: "warning",
          explanation: `A run of ${resume.stats.maxBlankLineRun} consecutive empty lines was detected. Large gaps waste space and often come from manual layout.`,
          recommendation:
            "Replace manual spacing with consistent paragraph spacing.",
          confidence: "medium",
        };
      }
      return {
        status: "pass",
        explanation:
          "No unusual whitespace runs or undecodable characters were detected.",
        confidence: "high",
      };
    },
  },
  {
    id: "readability-line-length",
    categoryId: "readability",
title: "Line lengths look normal",
    description:
      "Whether long lines suggest a multi-column or table layout, which parsers often read in the wrong order.",
    severity: "medium",
    points: 2,
    evaluate: (resume) => {
      if (resume.stats.longestLineLength === 0) {
        return {
          status: "unable-to-verify",
          explanation:
            "No lines were available to measure, so this check was excluded from the score.",
          confidence: "high",
        };
      }
      const ratio = resume.stats.longestLineRatio;
      const longest = resume.stats.longestLineLength;
      if (ratio >= SCORING_THRESHOLDS.longLineRatioWarning && longest > SCORING_THRESHOLDS.longLineCharacters) {
        return {
          status: "warning",
          explanation: `${percent(ratio)} of lines are longer than ${SCORING_THRESHOLDS.longLineCharacters} characters. This often happens with tables or multi-column layouts, and content may be read in an unexpected order.`,
          recommendation:
            "Review how the extracted text is ordered in the snapshot below, and consider a single-column layout to be safe.",
          confidence: "medium",
        };
      }
      return {
        status: "pass",
        explanation:
          "Line lengths look normal, so the document is unlikely to rely on unusual layout.",
        confidence: "medium",
      };
    },
  },
  {
    id: "readability-date-format",
    categoryId: "readability",
    title: "Consistent date formats",
    description:
      "Whether dates throughout the resume follow one consistent format.",
    severity: "medium",
    points: 3,
    evaluate: (resume) => {
      if (resume.dates.length < 2) {
        return {
          status: "unable-to-verify",
          explanation:
            `Only ${resume.dates.length} date${resume.dates.length === 1 ? "" : "s"} could be detected, so date-format consistency could not be assessed. If your roles include date ranges, check that they are written in a recognizable format such as "Mar 2021 - Jun 2023".`,
          recommendation:
            "Write dates in a recognizable, consistent format so recruiters and parsers can read them.",
          confidence: "low",
        };
      }
      const { dominantFamily, dominantShare: ratio, families } = summarizeDateFamilies(resume.dates);
      const dominantLabel =
        dominantFamily !== null ? DATE_FAMILY_LABELS[dominantFamily] : "none";
      const familyLabels = families.map((family) => DATE_FAMILY_LABELS[family]);

      if (ratio >= 0.9) {
        return {
          status: "pass",
          explanation: `${resume.dates.length} dates were detected and they follow one dominant format (${dominantLabel}).`,
          confidence: "high",
        };
      }
      if (ratio >= 0.6) {
        return {
          status: "warning",
          explanation: `Dates appear in ${families.length} different formats (${familyLabels.join("; ")}). The dominant format covers ${percent(ratio)} of dates.`,
          recommendation:
            "Pick one date format, such as \"Mar 2021\" or \"03/2021\", and use it everywhere.",
          confidence: "medium",
        };
      }
      return {
        status: "issue",
        explanation: `Dates are split across ${families.length} different formats (${familyLabels.join("; ")}), which makes timelines harder to read and can confuse parsers.`,
        recommendation:
          "Standardize every date to a single format, including education and certification dates.",
        confidence: "medium",
      };
    },
  },
  {
    id: "readability-heading-consistency",
    categoryId: "readability",
    title: "Consistent heading style",
    description:
      "Whether section headings use a consistent capitalization style.",
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      if (resume.sections.length < 2) {
        return {
          status: "unable-to-verify",
          explanation:
            "Fewer than two section headings were recognized, so heading consistency could not be assessed.",
          confidence: "high",
        };
      }
      const styles = new Map<string, number>();
      for (const section of resume.sections) {
        const style = headingCaseStyle(section.heading);
        styles.set(style, (styles.get(style) ?? 0) + 1);
      }
      const [dominant, count = 0] = [...styles.entries()].sort((a, b) => b[1] - a[1])[0] ?? [
        "title",
        0,
      ];
      const ratio = count / resume.sections.length;
      if (ratio >= SCORING_THRESHOLDS.headingStyleSharePass) {
        return {
          status: "pass",
          explanation: `All ${resume.sections.length} recognized headings follow the same style (${dominant === "upper" ? "ALL CAPS" : dominant === "lower" ? "lowercase" : "title case"}).`,
          confidence: "medium",
        };
      }
      if (ratio >= 0.6) {
        return {
          status: "warning",
          explanation: `Section headings mix capitalization styles (${[...styles.keys()].join(", ")}).`,
          recommendation:
            "Use one heading style throughout, for example Title Case for every section heading.",
          confidence: "medium",
        };
      }
      return {
        status: "issue",
        explanation:
          "Section headings use several different capitalization styles, which makes the document look unpolished.",
        recommendation:
          "Reformat every heading in the same style.",
        confidence: "medium",
      };
    },
  },
  {
    id: "readability-character-set",
    categoryId: "readability",
    title: "Text survives being copied out",
    description:
      "Whether the body text avoids emoji and pictographs, which render correctly in a word processor but can be dropped or replaced once the text is extracted.",
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      if (resume.stats.wordCount < SCORING_THRESHOLDS.minimalWords) {
        return {
          status: "unable-to-verify",
          explanation:
            "Too little text was extracted to inspect the character set. " +
            UNABLE_TO_VERIFY_NOTE,
          confidence: "high",
        };
      }

      const found = countGlyphs(resume.normalizedText);

      if (found === 0) {
        return {
          status: "pass",
          explanation:
            "No emoji or pictographic characters were found, so the text should survive being copied into a plain text document unchanged.",
          confidence: "medium",
        };
      }

      return {
        status: "warning",
        explanation: `${found} emoji or symbol ${found === 1 ? "character was" : "characters were"} found in the body text. This is the difference the plain-text-file test catches: everything looks fine on screen, then something is replaced by a box or disappears.`,
        recommendation:
          "Copy the resume into a plain text file and check that nothing turns into a box. Replace decorative symbols with words or remove them.",
        evidence: glyphSamples(resume.normalizedText),
        confidence: "medium",
      };
    },
  },
];

export const READABILITY_POINTS = readabilityChecks.reduce(
  (sum, check) => sum + check.points,
  0,
);
