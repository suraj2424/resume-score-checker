import { SCORING_CATEGORIES } from "@/config/scoring";
import type { ResumeCheck } from "../types";
import { contentChecks } from "./content";
import { contactChecks } from "./contact";
import { readabilityChecks } from "./readability";
import { skillsChecks } from "./skills";
import { structureChecks } from "./structure";

/** All checks, in the order categories are presented. */
export const ALL_CHECKS: ResumeCheck[] = [
  ...structureChecks,
  ...contentChecks,
  ...contactChecks,
  ...readabilityChecks,
  ...skillsChecks,
];

/**
 * The two invariants every page counts from, checked at module load.
 *
 * The methodology, FAQ and report pages all read their numbers from
 * `ALL_CHECKS` and `SCORING_CATEGORIES`, so a check that exists but is not in
 * this array, or a category whose points stop summing to its configured weight,
 * is a silent scoring error rather than a visible one. A module-load throw is the
 * only place it can be caught before a report ships with a total that does not
 * add up; `getCategoryConfig` already throws the same way on a bad category id.
 */
function assertCategoryWeights(): void {
  const seen = new Set<string>();
  for (const check of ALL_CHECKS) {
    if (seen.has(check.id)) throw new Error(`Duplicate check id: ${check.id}`);
    seen.add(check.id);
  }
  for (const category of SCORING_CATEGORIES) {
    const total = ALL_CHECKS.filter((check) => check.categoryId === category.id).reduce(
      (sum, check) => sum + check.points,
      0,
    );
    if (total !== category.weight) {
      throw new Error(
        `Category ${category.id} awards ${total} points but is configured with a weight of ${category.weight}.`,
      );
    }
  }
}

assertCategoryWeights();

export { contentChecks, contactChecks, readabilityChecks, skillsChecks, structureChecks };
