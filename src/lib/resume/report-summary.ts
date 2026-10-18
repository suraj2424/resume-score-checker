import { siteConfig } from "@/config/site";
import type { ParsedResume, ScoreReport } from "./types";

/**
 * Build the plain-text summary that leaves the app.
 *
 * This is the one artefact a user pastes somewhere that outlives the tab — a
 * mail body, an application form, a chat — so its guarantee has to stand on its
 * own: score, category points, recommendation titles and actions, nothing else.
 * No resume text, and no file name either. The name is user-supplied and
 * routinely *is* their identity (`Jane_Doe_Resume.pdf`, `Resume_FINAL_v3.pdf`),
 * so putting it here would hand the string the one piece of personal data the
 * report spent its whole architecture avoiding. The document is identified by
 * format, page count and extracted volume instead, which is what a reader of a
 * pasted summary actually needs to know about it.
 *
 * The coverage disclosures are reused verbatim from the report rather than
 * rewritten here: a summary that explained a smaller denominator differently
 * from the page behind it would be the same contradiction the not-applicable /
 * unable-to-verify split was added to remove.
 */
export function buildReportSummary(report: ScoreReport, resume: ParsedResume): string {
  const lines: string[] = [];

  lines.push(`${siteConfig.name} report`);
  lines.push(`Score: ${report.score}/100 (${report.scoreBand.label})`);
  lines.push(`Scoring version: ${report.scoringVersion}`);
  lines.push("");
  lines.push("Categories:");

  for (const category of report.categories) {
    const coverage: string[] = [
      `${category.checksEvaluated}/${category.checksTotal} checks examined`,
    ];
    // Named separately instead of as one "set aside" count, and worded exactly
    // as the coverage disclosures word them: a check that had nothing to look at
    // is not a check the extraction failed to support.
    if (category.notApplicable > 0) {
      coverage.push(`${category.notApplicable} did not apply`);
    }
    if (category.unableToVerify > 0) {
      coverage.push(`${category.unableToVerify} could not be evaluated`);
    }
    lines.push(
      `- ${category.name}: ${category.earned}/${category.possible} points (${coverage.join(", ")})`,
    );
  }

  if (report.coverage.warnings.length > 0) {
    lines.push("");
    lines.push("Coverage:");
    for (const warning of report.coverage.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push("");
  lines.push(`Priority fixes (${report.recommendations.length}):`);
  if (report.recommendations.length === 0) {
    lines.push("- None. Every check passed.");
  }
  report.recommendations.forEach((recommendation, index) => {
    lines.push(
      `${index + 1}. [${recommendation.priority.toUpperCase()}] ${recommendation.title} — ${recommendation.action}`,
    );
  });

  const snapshot: string[] = [
    resume.fileType.toUpperCase(),
    ...(resume.pageCount
      ? [`${resume.pageCount} ${resume.pageCount === 1 ? "page" : "pages"}`]
      : []),
    `${resume.stats.wordCount} words extracted`,
    `${resume.sections.length} sections identified`,
  ];
  lines.push("");
  lines.push(`Document snapshot: ${snapshot.join(" · ")}.`);
  lines.push("");
  lines.push(
    `${siteConfig.name} uses its own transparent checklist. Scores are guidance for improving resume quality and parsing readiness, not a prediction of hiring outcomes or a guarantee of compatibility with every ATS.`,
  );

  return lines.join("\n");
}
