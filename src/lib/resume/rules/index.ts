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

export { contentChecks, contactChecks, readabilityChecks, skillsChecks, structureChecks };
