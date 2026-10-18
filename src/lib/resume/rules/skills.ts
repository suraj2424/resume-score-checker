import { SCORING_THRESHOLDS } from "@/config/scoring";
import { isBulletLine } from "../bullet-analyzer";
import { getSection } from "../section-detector";
import type { ParsedResume, ResumeCheck } from "../types";
import { SKILL_COUNT_HINT, percent, share } from "./helpers";

/**
 * Vocabulary that only appears in a technology or digital document.
 *
 * The breadth check can only say "few recognized terms" when the document is
 * written in words the dictionary knows. A nursing or legal resume matched
 * nothing at all and lost fourteen of twenty points in this category for the
 * dictionary's blind spot, with the second of the two failures labelled "generic
 * overuse" when the real fault was that nothing specific had been recognized.
 * Detecting the dictionary's own domain is the only way to tell an out-of-domain
 * resume from a genuinely thin one.
 *
 * Deliberately narrow. "engineer", "analyst", "manager", "technical", "systems",
 * "platform", "network" and "development" are all excluded because they read just
 * as often on a civil-engineering or logistics resume, and a false positive here
 * charges the reader for the tool's guess. Programming-language names are absent
 * for the same reason: they are in `RECOGNIZED_SKILLS`, so a document that uses
 * one has already matched a term and never reaches this test.
 */
const DIGITAL_DOMAIN_TERMS = [
  "software",
  "web",
  "website",
  "webpage",
  "app",
  "api",
  "code",
  "codebase",
  "coding",
  "programmer",
  "programming",
  "developer",
  "frontend",
  "front-end",
  "backend",
  "back-end",
  "full stack",
  "devops",
  "database",
  "cloud",
  "server",
  "git",
  "javascript",
  "java",
  "python",
  "sql",
  "machine learning",
  "artificial intelligence",
  "data science",
  "cybersecurity",
  "ios",
  "android",
  "saas",
  "tech",
  "digital",
  "algorithm",
  "repository",
  "source code",
  "deployment",
  "erp",
  "crm",
];

const DIGITAL_DOCUMENT = new RegExp(
  `(?<![A-Za-z0-9+#.])(?:${DIGITAL_DOMAIN_TERMS.map((term) =>
    term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|")})(?![A-Za-z0-9+#])`,
  "i",
);

/**
 * Whether this document is written outside the term dictionary's coverage.
 *
 * Zero recognized terms plus no sign of a technology document is the shape of a
 * resume whose field this tool does not cover. Returning `issue` there is not a
 * finding about the reader; it is the tool saying it looked and found nothing it
 * knows, which is what `unable-to-verify` is for.
 */
function isOutsideRecognizedDomain(resume: ParsedResume): boolean {
  if (resume.skills.length > 0) return false;
  return !DIGITAL_DOCUMENT.test(resume.normalizedText);
}

/** `Languages: ...`, `Tools: ...` - a label turns a line into a group. */
const CATEGORY_LABEL = /^[A-Za-z][A-Za-z0-9 /&+]{1,30}:/;

/** Separators that make a list a list. The bullet glyph is deliberately absent. */
const LIST_SEPARATOR = /,|;|\||\u00B7/;

export const skillsChecks: ResumeCheck[] = [
  {
    id: "skills-term-breadth",
    categoryId: "skills",
    title: "Breadth of recognized terms",
    description:
      "How many terms from a standard list of common skills were recognized in the document.",
    severity: "high",
    points: 8,
    evaluate: (resume) => {
      if (isOutsideRecognizedDomain(resume)) {
        return {
          status: "unable-to-verify",
          explanation:
            "No term from the recognized skill list was found, and nothing in the document suggests it is written in the vocabulary that list covers. A short count here would describe the dictionary, not your resume, so this check was excluded rather than counted as a failure.",
          recommendation:
            "If your field uses terms from this list, naming them makes the resume easier to match. Skills the list does not know about cannot be measured here.",
          confidence: "medium",
        };
      }

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
        explanation: `Only ${count} recognized skill term${count === 1 ? " was" : "s were"} found. ${SKILL_COUNT_HINT}`,
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
    severity: "high",
    points: 6,
    evaluate: (resume) => {
      if (isOutsideRecognizedDomain(resume)) {
        return {
          status: "unable-to-verify",
          explanation:
            "Nothing this tool recognizes could be weighed against the generic terms in this document, so the balance between them cannot be judged. This was excluded rather than counted as a failure.",
          recommendation:
            "Pair general strengths with the specific tools, methods and standards your field uses, since generic terms alone do not distinguish one candidate from another.",
          confidence: "medium",
        };
      }

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
      if (ratio <= SCORING_THRESHOLDS.genericTermSharePass) {
        return {
          status: "pass",
          explanation: `Only ${percent(ratio)} of recognized skill mentions are generic terms such as "teamwork" or "leadership".`,
          confidence: "medium",
        };
      }
      if (ratio <= SCORING_THRESHOLDS.genericTermShareWarning) {
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
      "Whether the skills section presents terms in a scannable list rather than a block of prose.",
    severity: "high",
    points: 6,
    evaluate: (resume) => {
      // A missing section is a finding about the document, not a reason to remove
      // points: with the heading deleted, this check used to score zero of zero
      // while the presence check also fell, and the deletion raised the total.
      const section = getSection(resume.sections, "skills");
      if (section === undefined) {
        if (resume.skills.length >= SCORING_THRESHOLDS.minimumSkillTermCount) {
          return {
            status: "warning",
            explanation: `No skills section was found, so there is no list to scan. Skills are mentioned throughout the document (${resume.skills.length} recognized terms).`,
            recommendation:
              'Group them under a "Skills" heading as a comma-separated list or one short line per category.',
            confidence: "medium",
          };
        }
        return {
          status: "issue",
          explanation:
            "No skills section was found and few recognizable skill terms were detected, so there is nothing that can be scanned.",
          recommendation:
            'Add a "Skills" section as a comma-separated list, or one short line per category.',
          confidence: "high",
        };
      }

      const lines = section.content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length === 0) {
        return {
          status: "warning",
          explanation: "The skills section heading was found, but no content follows it.",
          recommendation: "Add your skills under the heading.",
          confidence: "medium",
        };
      }

      // The bullet glyph used to sit in the separator class, which made any
      // bulleted skills list pass without ever being measured. It is now
      // recognised as the list it is and read as such.
      const isBulleted = lines.some((line) => isBulletLine(line));
      const hasSeparator = LIST_SEPARATOR.test(section.content);
      const hasLabels = lines.some((line) => CATEGORY_LABEL.test(line));
      const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);

      if (isBulleted) {
        return {
          status: "pass",
          explanation: `Skills are presented as ${lines.length} separate ${lines.length === 1 ? "line" : "lines"}, which is the easiest form to scan and to parse.`,
          confidence: "medium",
        };
      }
      if (hasSeparator || hasLabels || longest <= SCORING_THRESHOLDS.skillsLineLengthPass) {
        return {
          status: "pass",
          explanation:
            "Skills are presented as a short list, which is easy to scan and easy to parse.",
          confidence: "medium",
        };
      }

      if (lines.length === 1) {
        return {
          status: "issue",
          explanation: `The skills section is a single line of ${longest} characters with no separators, grouping or line breaks. A reader has to parse it as prose to find one skill, and so does anything that reads the document automatically.`,
          recommendation:
            "Turn it into a comma-separated list, or into one line per category such as \"Languages: ...\".",
          confidence: "high",
        };
      }

      return {
        status: "warning",
        explanation: `The skills section runs to ${lines.length} long lines with no separators or category labels. Comma-separated or bulleted lists scan faster than sentences.`,
        recommendation:
          "Group skills into a comma-separated list, or into short category lines such as \"Languages: ...\".",
        confidence: "medium",
      };
    },
  },
];
