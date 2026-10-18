import { SCORING_THRESHOLDS } from "@/config/scoring";
import type { CheckResult, ResumeCheck } from "../types";
import { DATE_FAMILY_LABELS, summarizeDateFamilies } from "../date-analyzer";
import { headingCaseStyle, headingStyleShare } from "../section-detector";
import {
  UNABLE_TO_VERIFY_NOTE,
  bodyText,
  countGlyphs,
  glyphSamples,
  percent,
  share,
} from "./helpers";

/**
 * The column-break sentinel the PDF parser writes when it has to join two
 * side-by-side text bands into one line. Its presence in the extracted text is a
 * direct, unambiguous statement that the reading order was reconstructed rather
 * than observed, which no count of pages or columns can substitute for.
 */
const COLUMN_SENTINEL = "\u2502";

function sentinelLineCount(text: string): number {
  let count = 0;
  for (const line of text.split("\n")) {
    if (line.includes(COLUMN_SENTINEL)) count += 1;
  }
  return count;
}

/** DOCX files have no reliable page count; estimate one from word count. */
function estimatePages(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / SCORING_THRESHOLDS.wordsPerPage));
}

export const readabilityChecks: ResumeCheck[] = [
  {
    id: "readability-extractable-text",
    categoryId: "readability",
    title: "Meaningful text can be extracted",
    description:
      "Whether the document contains enough selectable text to analyze, which is also what an ATS first needs.",
    severity: "high",
    points: 4,
    evaluate: (resume) => {
      const words = resume.stats.wordCount;
      if (words >= SCORING_THRESHOLDS.minimalWords) {
        return {
          status: "pass",
          explanation: `${words} words of selectable text were extracted, which is enough to analyze the resume.`,
          confidence: "high",
        };
      }
      if (words >= SCORING_THRESHOLDS.extractableTextWarningWords) {
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
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      // Format-independent. DOCX files do not store page breaks, so this used to
      // be able to reach `warning` and never `issue`: the same resume scored as a
      // warning as a DOCX and as zero out of three as a PDF. An estimate is still
      // not allowed to be a hard failure, because that would charge the reader for
      // the estimator's error - but it is now the same verdict for the same words.
      const isEstimate = resume.pageCount === undefined;
      const pages = resume.pageCount ?? estimatePages(resume.stats.wordCount);
      const source = isEstimate
        ? ` Estimated at about ${SCORING_THRESHOLDS.wordsPerPage} words per page, because DOCX files do not store page breaks.`
        : "";
      const ideal = SCORING_THRESHOLDS.idealMaxPages;

      if (pages <= ideal) {
        return {
          status: "pass",
          explanation: `The resume is about ${pages} page${pages === 1 ? "" : "s"}, which is within the usual length for most applications.${source}`,
          confidence: isEstimate ? "low" : "high",
        };
      }

      if (pages <= SCORING_THRESHOLDS.typicalMaxPages) {
        return {
          status: "warning",
          explanation: `The resume is about ${pages} pages. Most applications expect ${ideal} pages or fewer, so every line here has to earn its place.${source}`,
          recommendation:
            "Cut the oldest or least relevant roles to their most impressive achievement.",
          confidence: isEstimate ? "low" : "high",
        };
      }

      if (!isEstimate && pages > SCORING_THRESHOLDS.longResumePages) {
        return {
          status: "issue",
          explanation: `The resume is ${pages} pages, past the ${SCORING_THRESHOLDS.longResumePages}-page point where length starts costing you the reader's attention rather than adding evidence.${source}`,
          recommendation:
            "Trim to the most relevant experience, and move older detail into a portfolio or LinkedIn profile.",
          confidence: "high",
        };
      }

      return {
        status: "warning",
        explanation: isEstimate
          ? `The resume is estimated at about ${pages} pages, which is long for most roles.${source} Because this is an estimate, check the real page count in your editor before cutting anything.`
          : `The resume is ${pages} pages, which is long for most roles, though not yet past the ${SCORING_THRESHOLDS.longResumePages}-page point.${source}`,
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
    points: 2,
    evaluate: (resume) => {
      // Both signals are raised every time. Undecodable characters returned
      // `issue` and short-circuited, so a document with both defects never heard
      // about the blank lines, and fixing the encoding left the gap unmentioned.
      const hasReplacementChars = resume.stats.replacementCharCount > 0;
      const hasBlankRuns =
        resume.stats.maxBlankLineRun >= SCORING_THRESHOLDS.maxBlankLineRunWarning;

      if (!hasReplacementChars && !hasBlankRuns) {
        return {
          status: "pass",
          explanation: "No unusual whitespace runs or undecodable characters were detected.",
          confidence: "high",
        };
      }

      const findings: string[] = [];
      if (hasReplacementChars) {
        findings.push(
          `${resume.stats.replacementCharCount} characters could not be decoded and appear as replacement symbols, which usually points to an encoding or export problem`,
        );
      }
      if (hasBlankRuns) {
        findings.push(
          `a run of ${resume.stats.maxBlankLineRun} consecutive empty lines was detected, and large gaps waste space and often come from manual layout`,
        );
      }

      const status: CheckResult["status"] = hasReplacementChars ? "issue" : "warning";
      return {
        status,
        explanation: `${findings.join("; and ")}.`,
        recommendation: hasReplacementChars
          ? "Re-save or re-export the document as PDF or DOCX from the original editor, then replace manual blank lines with consistent paragraph spacing."
          : "Replace manual spacing with consistent paragraph spacing.",
        confidence: hasReplacementChars ? "high" : "medium",
      };
    },
  },
  {
    id: "readability-line-length",
    categoryId: "readability",
    title: "Line lengths look normal",
    description:
      "Whether long lines suggest a multi-column or table layout, which parsers often read in the wrong order.",
    severity: "low",
    points: 1,
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
      const limit = SCORING_THRESHOLDS.longLineCharacters;
      if (ratio >= SCORING_THRESHOLDS.longLineRatioWarning && longest > limit) {
        return {
          status: "warning",
          explanation: `${percent(ratio)} of lines are longer than ${limit} characters. This often happens with tables or multi-column layouts, and content may be read in an unexpected order. The reading-order check reports the same layout from the parser's own measurements.`,
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
      // Year-only tokens are dropped. `2014 - 2018` next to `Mar 2021` is a
      // difference of granularity, not of formatting, and it used to cost a
      // warning. It also fixed the worse half of the problem: `dates` is every
      // 19xx/20xx token in the document, so "presented to 2024 attendees" was
      // counted as a date in a year-only format and pushed the ratio down.
      const dates = resume.dates.filter((date) => date.family !== "year-only");

      if (dates.length < 2) {
        return {
          status: "unable-to-verify",
          explanation:
            `Only ${dates.length} date${dates.length === 1 ? "" : "s"} carrying a month or a day could be detected, so date-format consistency could not be assessed. Years on their own are excluded from this check: a bare year is a difference of precision, not a difference of format.`,
          recommendation:
            'Write dates in a recognizable, consistent format such as "Mar 2021 - Jun 2023".',
          confidence: "low",
        };
      }

      const { dominantFamily, dominantShare: ratio, families } = summarizeDateFamilies(dates);
      // `summarizeDateFamilies` returns null only for an empty list, and the
      // length guard above rules that out; the fallback keeps the lookup total
      // rather than asserting a narrowing the compiler cannot see. The label's
      // example is stripped here because the sentence supplies its own.
      const dominantLabel =
        (dominantFamily === null ? "none" : DATE_FAMILY_LABELS[dominantFamily]).replace(
          /\s*\(.*\)\s*$/,
          "",
        );
      const familyLabels = families.map((family) => DATE_FAMILY_LABELS[family]);

      if (ratio >= SCORING_THRESHOLDS.dateFormatSharePass) {
        return {
          status: "pass",
          explanation: `${dates.length} dated references were detected and ${percent(ratio)} of them follow one format (${dominantLabel}).`,
          confidence: "high",
        };
      }
      if (ratio >= SCORING_THRESHOLDS.dateFormatShareWarning) {
        return {
          status: "warning",
          explanation: `Dates appear in ${families.length} different formats (${familyLabels.join("; ")}). The dominant format covers ${percent(ratio)} of them.`,
          recommendation:
            'Pick one date format, such as "Mar 2021" or "03/2021", and use it everywhere.',
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

      // `headingStyleShare` is the shared measurement, already used by the
      // formatting analyzer; this used to reimplement it and then claimed
      // "all headings follow the same style" on a share of 0.9, which is exactly
      // the case where one heading out of ten does not.
      const ratio = headingStyleShare(resume.sections);
      const counts = new Map<string, number>();
      for (const section of resume.sections) {
        const style = headingCaseStyle(section.heading);
        counts.set(style, (counts.get(style) ?? 0) + 1);
      }
      let dominantStyle = "";
      let dominantCount = 0;
      for (const [style, count] of counts) {
        if (count > dominantCount) {
          dominantStyle = style;
          dominantCount = count;
        }
      }
      const dominantLabel =
        dominantStyle === "upper" ? "ALL CAPS" : dominantStyle === "lower" ? "lowercase" : "title case";
      const styleLabels = [...counts.keys()].map((style) =>
        style === "upper" ? "ALL CAPS" : style === "lower" ? "lowercase" : "title case",
      );

      if (ratio >= SCORING_THRESHOLDS.headingStyleSharePass) {
        return {
          status: "pass",
          explanation: `${dominantCount} of ${resume.sections.length} recognized headings (${percent(ratio)}) are in ${dominantLabel}.`,
          confidence: "medium",
        };
      }
      if (ratio >= SCORING_THRESHOLDS.headingStyleShareWarning) {
        return {
          status: "warning",
          explanation: `Section headings mix capitalization styles (${styleLabels.join(", ")}). ${dominantCount} of ${resume.sections.length} are ${dominantLabel}.`,
          recommendation:
            "Use one heading style throughout, for example Title Case for every section heading.",
          confidence: "medium",
        };
      }
      return {
        status: "issue",
        explanation: `Only ${dominantCount} of ${resume.sections.length} section headings (${percent(ratio)}) share one capitalization style, which makes the document look unpolished.`,
        recommendation: "Reformat every heading in the same style.",
        confidence: "medium",
      };
    },
  },
  {
    id: "readability-character-set",
    categoryId: "readability",
    title: "Body text survives being copied out",
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

      // Headings are excluded, not counted twice. Emoji in a heading are already
      // reported by the plain-headings check, and one set of characters billed as
      // two findings and two points is the exact duplicate the 1.2.0 bump claimed
      // to have removed.
      const text = bodyText(resume);
      const found = countGlyphs(text);

      if (found === 0) {
        return {
          status: "pass",
          explanation:
            "No emoji or pictographic characters were found in the body text, so it should survive being copied into a plain text document unchanged. Emoji in section headings are reported separately by the plain-headings check.",
          confidence: "medium",
        };
      }

      return {
        status: "warning",
        explanation: `${found} emoji or pictograph ${found === 1 ? "character was" : "characters were"} found in the body text, outside the section headings. This is the difference the plain-text-file test catches: everything looks fine on screen, then something is replaced by a box or disappears.`,
        recommendation:
          "Copy the resume into a plain text file and check that nothing turns into a box. Replace decorative symbols with words or remove them.",
        evidence: glyphSamples(text),
        confidence: "medium",
      };
    },
  },
  {
    id: "readability-reading-order",
    categoryId: "readability",
    title: "Text is not interleaved across columns",
    description:
      "Whether the document's reading order can be trusted, which is the failure applicant tracking systems are least able to recover from.",
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      const structure = resume.documentStructure;
      const sentinels = sentinelLineCount(resume.normalizedText);
      if (structure === undefined && sentinels === 0) {
        return {
          status: "unable-to-verify",
          explanation:
            "The parser reported no layout information for this document, so reading order could not be measured. " +
            UNABLE_TO_VERIFY_NOTE,
          confidence: "medium",
        };
      }

      const interleaved = structure?.interleavedLineCount ?? 0;
      const tables = structure?.tableCount ?? 0;
      const columns = structure?.hasColumns === true;
      const limit = SCORING_THRESHOLDS.interleavedLineIssueCount;

      if (sentinels > 0) {
        return {
          status: "issue",
          explanation: `${sentinels} ${sentinels === 1 ? "line was" : "lines were"} assembled by joining two side-by-side blocks of text. Those lines read in an order no one wrote, and anything that reads the document automatically receives them that way.`,
          recommendation:
            "Replace the two-column layout with a single column. There is no reliable fix on the reading side.",
          confidence: "high",
        };
      }

      if (interleaved >= limit || tables > 0) {
        return {
          status: "issue",
          explanation:
            tables > 0
              ? `The document uses ${tables} ${tables === 1 ? "table" : "tables"}. Cells in a table have no inherent reading order, and a two-column export fuses cells from the same visual row into one line.`
              : `${interleaved} ${interleaved === 1 ? "line was" : "lines were"} reconstructed from interleaved columns, at or past the point where the original reading order can no longer be recovered.`,
          recommendation:
            "Replace the table or two-column layout with a single column, one item per line.",
          confidence: "high",
        };
      }

      if (interleaved > 0 || columns) {
        return {
          status: "warning",
          explanation: `The document uses a multi-column layout${
            interleaved > 0
              ? `, and ${interleaved} ${interleaved === 1 ? "line already shows" : "lines already show"} signs of reordering`
              : ""
          }. Nothing observed proves the order is wrong, but a single-column layout removes the question entirely.`,
          recommendation:
            "If you can, lay the resume out in one column. Nothing here is broken, but nothing here is being checked either.",
          confidence: "medium",
        };
      }

      return {
        status: "pass",
        explanation:
          "The document is a single column with no tables, so its text was read in the order it was written.",
        confidence: "high",
      };
    },
  },
  {
    id: "readability-scanned-pages",
    categoryId: "readability",
    title: "No image-only pages",
    description:
      "Whether any page produced no selectable text, which is the one thing this tool cannot read around.",
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      const imageOnlyPages = resume.documentStructure?.imageOnlyPages;
      const totalPages = resume.pageCount ?? 0;

      if (imageOnlyPages === undefined) {
        // DOCX has no pages, so there is no page-level fact to observe. Saying
        // "none found" would claim a measurement that did not happen; the copy
        // names the limit and points at the check that does measure it.
        return {
          status: "pass",
          explanation:
            "This format has no pages to inspect, so no image-only page was reported. A DOCX is a text-flow format; content that is an image rather than text is reported by the text-extraction check instead.",
          confidence: "medium",
        };
      }

      if (imageOnlyPages.length === 0) {
        return {
          status: "pass",
          explanation:
            "Every page produced selectable text. This tool does not perform OCR, so this says the text is there to read, not that a page looks the way you intended.",
          confidence: "high",
        };
      }

      const pageList = imageOnlyPages.join(", ");
      const shareOfPages = totalPages > 0 ? share(imageOnlyPages.length, totalPages) : 0;
      const issue = totalPages > 0 && shareOfPages > SCORING_THRESHOLDS.scannedPageShareIssue;
      const one = imageOnlyPages.length === 1;

      return {
        status: issue ? "issue" : "warning",
        explanation: `${one ? "Page" : "Pages"} ${pageList} produced no selectable text. Content on ${one ? "that page" : "those pages"} cannot be analyzed here, because this tool does not perform OCR, and it cannot be read by a parser either.`,
        recommendation:
          "Export the document as a text-based PDF or DOCX. If a page is intentionally an image, keep the same information as text somewhere in the document too.",
        confidence: "high",
      };
    },
  },
];
