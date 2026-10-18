import { ALL_CHECKS } from "./rules";
import {
  SCORING_CATEGORIES,
  SCORING_VERSION,
  SCORE_BANDS,
  TOTAL_SCORE_WEIGHT,
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
import { redactContact } from "./redact";
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
 *   only. The two are counted and disclosed separately, because they are two
 *   different facts about the document.
 * - Identical input plus identical scoring version always produces an
 *   identical score.
 *
 * This is also the display boundary for everything a rule quotes: evidence is
 * redacted as the result object is built, which is the last point before the
 * report leaves this function.
 */
export function scoreResume(resume: ParsedResume): ScoreReport {
  const results: CheckResultWithMetadata[] = ALL_CHECKS.map((check) => {
    const result = check.evaluate(resume);
    const { earned, possible } = statusPoints(check, result);
    const category = getCategoryConfig(check.categoryId);
    return {
      ...result,
      // Redaction lives here rather than in each rule: the privacy promise is a
      // property of the report, not of thirty-odd individual rule authors, and
      // a rule added next month must not be able to leak an email or a phone
      // number by forgetting to call `redactContact` first. Most evidence today
      // is bullet text, and the helpers already redact it — that is defence in
      // depth for the paths that are not bullets (role header lines, glyph
      // samples, heading strings), not the mechanism the promise rests on.
      // Nothing here touches points or status, so redaction stays display-only.
      evidence: result.evidence?.map((line) => redactContact(line).text),
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
    // Counted by status, not by `pointsPossible > 0`. A check with a zero point
    // value still ran and still produced a definite answer, and folding it into
    // the excluded bucket would be the same conflation the not-applicable /
    // unable-to-verify split exists to remove.
    const evaluated = categoryResults.filter(isEvaluated);
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      weight: config.weight,
      earned: round1(evaluated.reduce((sum, result) => sum + result.pointsEarned, 0)),
      possible: round1(evaluated.reduce((sum, result) => sum + result.pointsPossible, 0)),
      checksEvaluated: evaluated.length,
      checksTotal: categoryResults.length,
      notApplicable: countStatus(categoryResults, "not-applicable"),
      unableToVerify: countStatus(categoryResults, "unable-to-verify"),
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
  const notApplicable = categories.reduce((sum, category) => sum + category.notApplicable, 0);
  const unableToVerify = categories.reduce((sum, category) => sum + category.unableToVerify, 0);

  const coverageWarnings: string[] = [];
  // Two sentences, because these are two facts. "Did not apply" means the check
  // had nothing to look at and was out of scope; "could not be evaluated" means
  // the extraction would not support it. Telling a resume with no summary
  // section that a check "could not be evaluated" reads as a defect in the
  // document when the check answered perfectly — it simply had nothing to say.
  if (notApplicable > 0) {
    coverageWarnings.push(
      `${notApplicable} of ${checksTotal} checks did not apply to this document and were left out of the score.`,
    );
  }
  if (unableToVerify > 0) {
    coverageWarnings.push(
      `${unableToVerify} of ${checksTotal} checks could not be evaluated from the extracted text. ` +
        "They were excluded rather than counted as failures, so the score reflects only what could be verified.",
    );
  }
  if (totalPossible < TOTAL_SCORE_WEIGHT) {
    coverageWarnings.push(
      `Only ${totalPossible} of ${TOTAL_SCORE_WEIGHT} possible points could be evaluated for this document.`,
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
      notApplicable,
      unableToVerify,
      warnings: coverageWarnings,
    },
    scoringVersion: SCORING_VERSION,
    fileName: resume.fileName,
  };
}

/** True when the check ran and returned a definite answer about the document. */
function isEvaluated(result: CheckResultWithMetadata): boolean {
  return result.status !== "not-applicable" && result.status !== "unable-to-verify";
}

function countStatus(results: CheckResultWithMetadata[], status: CheckResult["status"]): number {
  return results.filter((result) => result.status === status).length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
