import { describe, expect, it } from "vitest";
import { buildParsedResume } from "@/lib/resume/analyze";
import { scoreResume, scoreBandFor } from "@/lib/resume/score-engine";
import { buildRecommendations } from "@/lib/resume/recommendations";
import { ALL_CHECKS } from "@/lib/resume/rules";
import { SCORING_CATEGORIES, SCORING_VERSION } from "@/config/scoring";
import { sourceFromText } from "./resume-fixtures";
import {
  EMPTY_RESUME,
  EXPERIENCED_RESUME,
  FRESHER_RESUME,
  LONG_RESUME,
  MINIMAL_RESUME,
  NO_SECTIONS_RESUME,
  WEAK_WORDING_RESUME,
} from "./resume-fixtures";
import type { ScoreReport } from "@/lib/resume/types";

function reportFor(text: string): ScoreReport {
  return scoreResume(buildParsedResume(sourceFromText(text)));
}

describe("score aggregation", () => {
  it("evaluates every check for a complete document (100 possible points)", () => {
    const report = reportFor(EXPERIENCED_RESUME);
    const totalPossible = report.categories.reduce((sum, category) => sum + category.possible, 0);
    expect(totalPossible).toBe(100);
    expect(report.coverage.checksEvaluated).toBe(ALL_CHECKS.length);
    expect(report.coverage.checksTotal).toBe(ALL_CHECKS.length);
    expect(report.coverage.warnings).toHaveLength(0);
  });

  it("scores a complete resume highly and a weak resume much lower", () => {
    const strong = reportFor(EXPERIENCED_RESUME);
    const weak = reportFor(NO_SECTIONS_RESUME);
    expect(strong.score).toBeGreaterThanOrEqual(85);
    expect(weak.score).toBeLessThan(strong.score);
  });

  it("keeps fresher scores in a fair, non-punishing range", () => {
    const report = reportFor(FRESHER_RESUME);
    expect(report.score).toBeGreaterThanOrEqual(50);
    expect(report.score).toBeLessThanOrEqual(95);
    expect(resultById(report, "structure-experience").status).toBe("pass");
  });

  it("is deterministic: identical input produces an identical report", () => {
    const first = reportFor(EXPERIENCED_RESUME);
    const second = reportFor(EXPERIENCED_RESUME);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("produces a valid score for empty and tiny documents", () => {
    for (const text of [EMPTY_RESUME, MINIMAL_RESUME, "Hi"]) {
      const report = reportFor(text);
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(Number.isInteger(report.score)).toBe(true);
    }
  });

  it("handles a long document without failing", () => {
    const report = reportFor(LONG_RESUME);
    expect(report.score).toBeGreaterThan(0);
    expect(report.categories).toHaveLength(SCORING_CATEGORIES.length);
  });

  it("distributes category points so each category awards exactly its weight", () => {
    for (const category of SCORING_CATEGORIES) {
      const categoryPoints = ALL_CHECKS.filter((check) => check.categoryId === category.id).reduce(
        (sum, check) => sum + check.points,
        0,
      );
      expect(categoryPoints).toBe(category.weight);
    }
    expect(ALL_CHECKS.reduce((sum, check) => sum + check.points, 0)).toBe(100);
  });

  it("discloses coverage when checks cannot be evaluated", () => {
    const report = reportFor(MINIMAL_RESUME);
    expect(report.coverage.checksEvaluated).toBeLessThan(report.coverage.checksTotal);
    expect(report.coverage.warnings.length).toBeGreaterThan(0);
    expect(report.coverage.warnings.join(" ")).toContain("could not be evaluated");
  });

  it("reports the scoring version", () => {
    expect(reportFor(EXPERIENCED_RESUME).scoringVersion).toBe(SCORING_VERSION);
  });

  it("derives score bands monotonically", () => {
    expect(scoreBandFor(95).id).toBe("excellent");
    expect(scoreBandFor(80).id).toBe("strong");
    expect(scoreBandFor(65).id).toBe("good");
    expect(scoreBandFor(45).id).toBe("fair");
    expect(scoreBandFor(10).id).toBe("needs-work");
    expect(scoreBandFor(0).id).toBe("needs-work");
    expect(scoreBandFor(100).id).toBe("excellent");
  });

  it("orders categories exactly as configured", () => {
    const report = reportFor(EXPERIENCED_RESUME);
    expect(report.categories.map((category) => category.id)).toEqual(
      SCORING_CATEGORIES.map((category) => category.id),
    );
  });

  it("never promises hiring outcomes or guaranteed ATS passes", () => {
    for (const text of [EXPERIENCED_RESUME, FRESHER_RESUME, WEAK_WORDING_RESUME]) {
      const serialized = JSON.stringify(reportFor(text)).toLowerCase();
      expect(serialized).not.toContain("guarantee");
      expect(serialized).not.toContain("will get you hired");
      expect(serialized).not.toContain("88+");
    }
  });

  it("sorts critical issues by severity, then by points at stake", () => {
    const report = reportFor(NO_SECTIONS_RESUME);
    const severities = report.criticalIssues.map((issue) => issue.severity);
    const rank = { high: 0, medium: 1, low: 2, info: 3 } as const;
    for (let index = 1; index < severities.length; index += 1) {
      expect(rank[severities[index]!]).toBeGreaterThanOrEqual(rank[severities[index - 1]!]);
    }
  });
});

describe("recommendations", () => {
  it("creates recommendations for every failing check, ordered by recoverable points", () => {
    const report = reportFor(WEAK_WORDING_RESUME);
    expect(report.recommendations.length).toBeGreaterThan(0);
    for (let index = 1; index < report.recommendations.length; index += 1) {
      expect(report.recommendations[index]!.pointsRecoverable).toBeLessThanOrEqual(
        report.recommendations[index - 1]!.pointsRecoverable,
      );
    }
  });

  it("excludes not-applicable and unable-to-verify checks from recommendations", () => {
    const report = reportFor(MINIMAL_RESUME);
    const excluded = report.results.filter(
      (result) => result.status === "not-applicable" || result.status === "unable-to-verify",
    );
    for (const result of excluded) {
      expect(report.recommendations.some((entry) => entry.checkId === result.checkId)).toBe(false);
    }
  });

  it("gives every recommendation a title, explanation and action", () => {
    const report = reportFor(WEAK_WORDING_RESUME);
    for (const recommendation of report.recommendations) {
      expect(recommendation.title.length).toBeGreaterThan(0);
      expect(recommendation.explanation.length).toBeGreaterThan(0);
      expect(recommendation.action.length).toBeGreaterThan(0);
      expect(["high", "medium", "low"]).toContain(recommendation.priority);
    }
  });

  it("never invents achievements, metrics or rewrites", () => {
    const report = reportFor(WEAK_WORDING_RESUME);
    const serialized = JSON.stringify(report.recommendations).toLowerCase();
    expect(serialized).not.toContain("improved api performance");
    expect(serialized).not.toContain("rewritten:");
  });

  it("returns an empty list when everything passes", () => {
    const report = reportFor(EXPERIENCED_RESUME);
    expect(report.recommendations).toHaveLength(0);
  });

  it("is deterministic for the same input", () => {
    const first = scoreResume(buildParsedResume(sourceFromText(WEAK_WORDING_RESUME)));
    const second = scoreResume(buildParsedResume(sourceFromText(WEAK_WORDING_RESUME)));
    expect(buildRecommendations(first.results)).toEqual(buildRecommendations(second.results));
  });
});

function resultById(report: ScoreReport, checkId: string) {
  const result = report.results.find((entry) => entry.checkId === checkId);
  if (!result) throw new Error(`Missing check: ${checkId}`);
  return result;
}
