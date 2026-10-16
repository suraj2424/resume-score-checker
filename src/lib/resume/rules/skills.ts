import { SCORING_THRESHOLDS } from "@/config/scoring";
import { getSection, hasSection } from "../section-detector";
import type { ResumeCheck } from "../types";
import { SKILL_COUNT_HINT, percent, share } from "./helpers";

export const skillsChecks: ResumeCheck[] = [
  {
    id: "skills-term-breadth",
    categoryId: "skills",
    title: "Breadth of recognized terms",
    description:
      "How many terms from a standard list of common skills were recognized in the document.",
    severity: "low",
    points: 8,
    evaluate: (resume) => {
      const count = resume.skills.length;
      if (count >= SCORING_THRESHOLDS.strongSkillTermCount) {
        return {
          status: "pass",
          explanation: `${count} recognized skill terms were found, which gives a reasonable picture of your toolkit.`,
          confidence: "medium",
        };
      }
      if (count >= SCORING_THRESHOLDS.minimumSkillTermCount) {
        return {
          status: "warning",
          explanation: `${count} recognized skill terms were found. ${SKILL_COUNT_HINT}`,
          recommendation:
            "Name the specific tools you use rather than describing them generically.",
          confidence: "medium",
        };
      }
      return {
        status: "issue",
        explanation: `Only ${count} recognized skill terms were found. ${SKILL_COUNT_HINT}`,
        recommendation:
          "List concrete tools and technologies where you have genuinely used them.",
        confidence: "medium",
      };
    },
  },
  {
    id: "skills-generic-overuse",
    categoryId: "skills",
    title: "Skills are specific, not only generic",
    description:
      "Whether the resume leans mostly on generic buzzwords rather than specific, verifiable terms.",
    severity: "low",
    points: 6,
    evaluate: (resume) => {
      const specific = resume.skills.reduce((sum, skill) => sum + skill.count, 0);
      const generic = resume.genericTermMentions;
      const total = specific + generic;
      if (total === 0) {
        return {
          status: "unable-to-verify",
          explanation:
            "No recognizable skill or generic terms were found, so overuse could not be assessed.",
          confidence: "medium",
        };
      }
      const ratio = share(generic, total);
      if (ratio <= 0.25) {
        return {
          status: "pass",
          explanation: `Only ${percent(ratio)} of recognized skill mentions are generic terms such as "teamwork" or "leadership".`,
          confidence: "medium",
        };
      }
      if (ratio <= 0.45) {
        return {
          status: "warning",
          explanation: `${percent(ratio)} of recognized skill mentions are generic terms.`,
          recommendation:
            "Keep a few generic strengths, but pair them with specific tools and evidence.",
          confidence: "medium",
        };
      }
      return {
        status: "issue",
        explanation: `${percent(ratio)} of recognized skill mentions are generic buzzwords that do not distinguish you from other candidates.`,
        recommendation:
          "Replace generic claims with specific tools, methods and evidence of use.",
        confidence: "medium",
      };
    },
  },
  {
    id: "skills-listed-clearly",
    categoryId: "skills",
    title: "Skills are easy to scan",
    description:
      "Whether the skills section presents terms in a scannable list rather than a long sentence.",
    severity: "low",
    points: 6,
    evaluate: (resume) => {
      if (!hasSection(resume.sections, "skills")) {
        return {
          status: "not-applicable",
          explanation:
            "No skills section was found, so its formatting could not be assessed.",
          confidence: "high",
        };
      }
      const section = getSection(resume.sections, "skills");
      const content = section?.content ?? "";
      const lines = content.split("\n").filter((line) => line.trim().length > 0);
      const hasSeparators = /,|;|•|\||·/.test(content);
      const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);

      if (lines.length === 0) {
        return {
          status: "warning",
          explanation: "The skills section heading was found, but no content follows it.",
          recommendation: "Add your skills under the heading.",
          confidence: "medium",
        };
      }
      if (hasSeparators || longestLine <= 80) {
        return {
          status: "pass",
          explanation:
            "Skills are presented as a short list, which is easy to scan and easy to parse.",
          confidence: "medium",
        };
      }
      return {
        status: "warning",
        explanation:
          "The skills section reads as long lines. Comma-separated or bulleted lists scan faster than sentences.",
        recommendation:
          "Group skills into a comma-separated list, or into short category lines such as \"Languages: ...\".",
        confidence: "medium",
      };
    },
  },
];

export const SKILLS_POINTS = skillsChecks.reduce((sum, check) => sum + check.points, 0);
