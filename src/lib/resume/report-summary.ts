import { siteConfig } from "@/config/site";
import type { ParsedResume, ScoreReport } from "./types";

/**
 * Build a plain-text summary of a report for the clipboard.
 *
 * The summary deliberately contains only the score, category points and the
 * recommendation list. It never includes contact details or raw resume text.
 */
export function buildReportSummary(report: ScoreReport, resume: ParsedResume): string {
  const lines: string[] = [];

  lines.push(`${siteConfig.name} report — ${report.fileName}`);
  lines.push(`Score: ${report.score}/100 (${report.scoreBand.label})`);
  lines.push(`Scoring version: ${report.scoringVersion}`);
  lines.push("");
  lines.push("Categories:");

  for (const category of report.categories) {
    lines.push(
      `- ${category.name}: ${category.earned}/${category.possible} points (${category.checksEvaluated}/${category.checksTotal} checks evaluated)`,
    );
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

  lines.push("");
  lines.push(
    `Document snapshot: ${resume.stats.wordCount} words extracted, ${resume.sections.length} sections identified${resume.pageCount ? `, ${resume.pageCount} pages` : ""}.`,
  );
  lines.push("");
  lines.push(
    `${siteConfig.name} uses its own transparent checklist. Scores are guidance for improving resume quality and parsing readiness, not a prediction of hiring outcomes or a guarantee of compatibility with every ATS.`,
  );

  return lines.join("\n");
}
