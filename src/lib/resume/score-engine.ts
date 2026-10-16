import { ALL_CHECKS } from "./rules";
import {
  SCORING_CATEGORIES,
  SCORING_VERSION,
  SCORE_BANDS,
  WARNING_CREDIT,
  getCategoryConfig,
  type ScoreBandId,
} from "@/config/scoring";
import type {
  CheckResultWithMetadata,
  ParsedResume,
  Recommendation,
  ScoreBand,
  ScoreCategory,
  ScoreReport,
} from "./types";
import { buildRecommendations } from "./recommendations";
import type { CheckResult } from "./types";
import type { ResumeCheck } from "./types";

/** Points awarded for each status. "Unable to verify" and "not applicable"
 * are excluded from both earned and possible points (coverage disclosure). */
function statusPoints(check: ResumeCheck, result: CheckResult): {
  earned: number;
  possible: number;
} {
  switch (result.status) {
    case "pass":
      return { earned: check.points, possible: check.points };
    case "warning":
      return { earned: check.points * WARNING_CREDIT, possible: check.points };
    case "issue":
      return { earned: 0, possible: check.points };
    case "unable-to-verify":
    case "not-applicable":
      return { earned: 0, possible: 0 };
  }
}

export function scoreBandFor(score: number): ScoreBand {
  const band = SCORE_BANDS.find((entry) => score >= entry.min);
  const fallback = SCORE_BANDS[SCORE_BANDS.length - 1]!;
  const chosen = band ?? fallback;
  return {
    id: chosen.id as ScoreBandId,
    label: chosen.label,
    summary: chosen.summary,
  };
}

/**
 * Run every check against a parsed resume and aggregate the report.
 *
 * Scoring policy (documented on the methodology page):
 * - Each check has a fixed point value; category weights are enforced by
 *   distributing points so every category awards exactly its weight.
 * - `pass` awards full points, `warning` awards half, `issue` awards none.
 * - `unable-to-verify` and `not-applicable` remove the check's points from
 *   the denominator, and the overall score is computed over available points
 *   only, with the excluded count disclosed in coverage.
 * - Identical input plus identical scoring version always produces an
 *   identical score.
 */
export function scoreResume(resume: ParsedResume): ScoreReport {
  const results: CheckResultWithMetadata[] = ALL_CHECKS.map((check) => {
    const result = check.evaluate(resume);
    const { earned, possible } = statusPoints(check, result);
    const category = getCategoryConfig(check.categoryId);
    return {
      ...result,
      checkId: check.id,
      categoryId: check.categoryId,
      categoryName: category.name,
      title: check.title,
      description: check.description,
      severity: check.severity,
      pointsEarned: earned,
      pointsPossible: possible,
    };
  });

  const categories: ScoreCategory[] = SCORING_CATEGORIES.map((config) => {
    const categoryResults = results.filter((result) => result.categoryId === config.id);
    const evaluated = categoryResults.filter((result) => result.pointsPossible > 0);
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      weight: config.weight,
      earned: round1(evaluated.reduce((sum, result) => sum + result.pointsEarned, 0)),
      possible: round1(evaluated.reduce((sum, result) => sum + result.pointsPossible, 0)),
      checksEvaluated: evaluated.length,
      checksTotal: categoryResults.length,
    };
  });

  const totalEarned = categories.reduce((sum, category) => sum + category.earned, 0);
  const totalPossible = categories.reduce((sum, category) => sum + category.possible, 0);
  const score = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

  const criticalIssues = results
    .filter((result) => result.status === "issue" && (result.severity === "high" || result.severity === "medium"))
    .sort((a, b) => {
      const severityRank = { high: 0, medium: 1, low: 2, info: 3 } as const;
      return (
        severityRank[a.severity] - severityRank[b.severity] ||
        b.pointsPossible - a.pointsPossible
      );
    });

  const checksEvaluated = categories.reduce((sum, category) => sum + category.checksEvaluated, 0);
  const checksTotal = categories.reduce((sum, category) => sum + category.checksTotal, 0);
  const excluded = checksTotal - checksEvaluated;

  const coverageWarnings: string[] = [];
  if (excluded > 0) {
    coverageWarnings.push(
      `${excluded} of ${checksTotal} checks could not be evaluated from the extracted text. ` +
        "They were excluded from the score rather than counted as failures, so the score reflects only what could be verified.",
    );
  }
  if (totalPossible < 100) {
    coverageWarnings.push(
      `Only ${totalPossible} of 100 possible points could be evaluated for this document.`,
    );
  }

  const recommendations: Recommendation[] = buildRecommendations(results);

  return {
    score,
    scoreBand: scoreBandFor(score),
    categories,
    results,
    criticalIssues,
    recommendations,
    coverage: {
      checksEvaluated,
      checksTotal,
      warnings: coverageWarnings,
    },
    scoringVersion: SCORING_VERSION,
    fileName: resume.fileName,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
