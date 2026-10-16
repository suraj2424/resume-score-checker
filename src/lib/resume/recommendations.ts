import type { CheckResultWithMetadata, Recommendation, RecommendationPriority } from "./types";

const SEVERITY_WEIGHT: Record<CheckResultWithMetadata["severity"], number> = {
  high: 40,
  medium: 24,
  low: 10,
  info: 4,
};

const CONFIDENCE_WEIGHT = {
  low: 0,
  medium: 4,
  high: 6,
} as const;

/**
 * Turn non-passing checks into prioritized recommendations.
 *
 * Priority is a deterministic function of severity, recoverable points and
 * detection confidence. Nothing here hires anyone: a recommendation only
 * describes a change the user can make to their own document.
 */
export function buildRecommendations(
  results: CheckResultWithMetadata[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const result of results) {
    if (result.status === "pass") continue;

    const pointsRecoverable = Math.max(
      0,
      Math.round(
        (result.pointsPossible === 0
          ? 0
          : result.pointsPossible - result.pointsEarned) * 10,
      ) / 10,
    );

    if (result.status === "not-applicable" || result.status === "unable-to-verify") {
      // Nothing to fix; surfaced in coverage disclosures instead.
      continue;
    }

    const priorityScore =
      SEVERITY_WEIGHT[result.severity] +
      CONFIDENCE_WEIGHT[result.confidence ?? "medium"] +
      pointsRecoverable * 2;

    recommendations.push({
      checkId: result.checkId,
      title: result.title,
      explanation: result.explanation,
      action:
        result.recommendation ??
        "Review this check in the detailed results and decide whether it applies to your situation.",
      priority: priorityFor(priorityScore),
      pointsRecoverable,
      severity: result.severity,
    });
  }

  return recommendations.sort(
    (a, b) =>
      b.pointsRecoverable - a.pointsRecoverable ||
      SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] ||
      a.title.localeCompare(b.title),
  );
}

function priorityFor(score: number): RecommendationPriority {
  if (score >= 40) return "high";
  if (score >= 16) return "medium";
  return "low";
}

/** Human-readable note used by the report to explain estimated point gains. */
export const ESTIMATED_GAINS_NOTE =
  "Points shown are the maximum this specific check could recover if resolved. They are an estimate of the effect of a concrete change, not a predicted score.";
