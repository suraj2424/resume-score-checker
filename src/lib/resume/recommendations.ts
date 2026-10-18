import type {
  CheckResultWithMetadata,
  CheckSeverity,
  Confidence,
  Recommendation,
  RecommendationPriority,
} from "./types";

const SEVERITY_WEIGHT: Record<CheckSeverity, number> = {
  high: 40,
  medium: 24,
  low: 10,
  info: 4,
};

const CONFIDENCE_WEIGHT: Record<Confidence, number> = {
  low: 0,
  medium: 4,
  high: 6,
};

/**
 * Bucket boundaries, calibrated against the scores this points table can
 * actually produce rather than against round numbers.
 *
 * A recommendation always recovers at least half a point (a `warning` earns
 * half credit, an `issue` earns none), so `severity + confidence + 2 × points`
 * has these reachable bands under the 1.3.0 weights:
 *
 *   high severity    41 – 56   (`readability-extractable-text`, `contact-email`)
 *   medium severity  25 – 40   (`contact-phone`, `content-action-verbs`)
 *   low severity     11 – 32   (`skills-term-breadth` at 8 points)
 *   info severity     7 – 16   (`readability-page-count`)
 *
 * 41 is the floor of the high-severity band and one point above the best any
 * medium-severity check can score, so "Fix first" means a high-severity failure
 * rather than an accident of point values, while points and confidence still
 * order the band from the inside. 24 keeps every medium-severity failure at
 * "Fix soon" or better, still lets a large low-severity item (skills breadth is
 * the only one) earn "Fix soon" because it costs 8 points, and stays above the
 * informational ceiling of 16 so page-count advice never outranks a real gap.
 * The old cut-off of 40 did the opposite: a medium-severity check could reach
 * it, and no low-severity check ever could.
 */
const HIGH_PRIORITY_SCORE = 41;
const MEDIUM_PRIORITY_SCORE = 24;

/**
 * A recommendation next to the score it was ranked by.
 *
 * `priorityScore` is kept off `Recommendation` deliberately: it is a ranking key,
 * not a fact about the resume, and the report is only byte-identical for
 * identical input if the bucket label and the sort key come from one function
 * instead of two expressions that can drift apart. A future field on the public
 * type would also pin an internal ranking detail to the clipboard summary and
 * the report UI for no user-visible gain.
 */
interface RankedRecommendation {
  recommendation: Recommendation;
  priorityScore: number;
}

/**
 * Turn non-passing checks into prioritized recommendations.
 *
 * Priority is a deterministic function of severity, recoverable points and
 * detection confidence, and the list is ordered by that same function, so the
 * order on screen always matches the label on each row. Nothing here hires
 * anyone: a recommendation only describes a change the user can make to their
 * own document.
 */
export function buildRecommendations(
  results: CheckResultWithMetadata[],
): Recommendation[] {
  const ranked: RankedRecommendation[] = [];

  for (const result of results) {
    if (result.status === "pass") continue;
    // Nothing to fix; surfaced in coverage disclosures instead.
    if (result.status === "not-applicable" || result.status === "unable-to-verify") continue;

    const pointsRecoverable = Math.max(
      0,
      Math.round((result.pointsPossible - result.pointsEarned) * 10) / 10,
    );
    const priorityScore = priorityScoreFor(result.severity, result.confidence, pointsRecoverable);

    ranked.push({
      priorityScore,
      recommendation: {
        checkId: result.checkId,
        title: result.title,
        explanation: result.explanation,
        action:
          result.recommendation ??
          "Review this check in the detailed results and decide whether it applies to your situation.",
        priority: priorityFor(priorityScore),
        pointsRecoverable,
        severity: result.severity,
      },
    });
  }

  // Ordering by recoverable points instead put "Fix soon" above "Fix first" and
  // pushed the most severe finding behind the fold, because points outweigh
  // severity at the extremes: skills breadth is worth 8 points and outranked a
  // missing email address. The title tie-break pins the locale because the
  // report has to be byte-identical for identical input on every machine.
  return ranked
    .sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        a.recommendation.title.localeCompare(b.recommendation.title, "en"),
    )
    .map((entry) => entry.recommendation);
}

/** The single definition of a recommendation's ranking score. */
function priorityScoreFor(
  severity: CheckSeverity,
  confidence: Confidence | undefined,
  pointsRecoverable: number,
): number {
  return (
    SEVERITY_WEIGHT[severity] + CONFIDENCE_WEIGHT[confidence ?? "medium"] + pointsRecoverable * 2
  );
}

function priorityFor(score: number): RecommendationPriority {
  if (score >= HIGH_PRIORITY_SCORE) return "high";
  if (score >= MEDIUM_PRIORITY_SCORE) return "medium";
  return "low";
}

/** Human-readable note used by the report to explain estimated point gains. */
export const ESTIMATED_GAINS_NOTE =
  "Points shown are the maximum this specific check could recover if resolved. They are an estimate of the effect of a concrete change, not a predicted score.";
