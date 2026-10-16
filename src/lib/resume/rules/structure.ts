import { SCORING_THRESHOLDS } from "@/config/scoring";
import { getSection, getSections, hasSection } from "../section-detector";
import type { ResumeCheck } from "../types";
import {
  UNABLE_TO_VERIFY_NOTE,
  countGlyphs,
  findOutOfOrderEntries,
  findRoleEntries,
  formatHeadingList,
  hasAnySection,
  sectionTitles,
} from "./helpers";

const EXPERIENCE_IDS = ["experience"];
const EQUIVALENT_IDS = ["internships", "projects", "volunteer", "activities"];

export const structureChecks: ResumeCheck[] = [
  {
    id: "structure-experience",
    categoryId: "structure",
    title: "Experience or equivalent practical section",
    description:
      "Whether the resume contains a work experience section, or an equivalent section such as internships or projects.",
    severity: "medium",
    points: 4,
    evaluate: (resume) => {
      if (resume.stats.wordCount < SCORING_THRESHOLDS.minimalWords) {
        return {
          status: "unable-to-verify",
          explanation:
            "Too little text was extracted to tell whether an experience section exists. " +
            UNABLE_TO_VERIFY_NOTE,
          recommendation:
            "Make sure your resume contains selectable text, then run the check again.",
          confidence: "high",
        };
      }

      if (hasSection(resume.sections, "experience")) {
        const section = getSection(resume.sections, "experience");
        const description = section
          ? `A professional experience section was found under "${section.heading}".`
          : "A professional experience section was found.";
        return {
          status: "pass",
          explanation: description,
          confidence: "high",
        };
      }

      if (hasAnySection(resume.sections, EQUIVALENT_IDS)) {
        const equivalents = sectionTitles(resume.sections, EQUIVALENT_IDS).join(", ");
        return {
          status: "pass",
          explanation:
            "No employment-history section was found, but practical experience is presented through " +
            `${equivalents}. Internships, projects and volunteer work are recognized as legitimate experience for students and career switchers.`,
          recommendation:
            "If you also held any part-time, contract or freelance work, add it under an Experience heading.",
          confidence: "high",
        };
      }

      return {
        status: "issue",
        explanation:
          "No experience, internship or projects section could be identified. Recruiters look for evidence of applied work before anything else.",
        recommendation:
          "Add a section titled Experience or Internships. If you have no employment history yet, list academic or personal projects, volunteering or freelance work instead.",
        evidence: resume.sections
          .slice(0, 3)
          .map((section) => `Detected section: "${section.heading}"`),
        confidence: "high",
      };
    },
  },
  {
    id: "structure-education",
    categoryId: "structure",
    title: "Education section",
    description: "Whether the resume includes an education section.",
    severity: "medium",
    points: 3,
    evaluate: (resume) => {
      if (resume.stats.wordCount < SCORING_THRESHOLDS.minimalWords) {
        return {
          status: "unable-to-verify",
          explanation:
            "Too little text was extracted to tell whether an education section exists. " +
            UNABLE_TO_VERIFY_NOTE,
          confidence: "high",
        };
      }
      if (hasSection(resume.sections, "education")) {
        return {
          status: "pass",
          explanation: 'An education section was found under "Education".',
          confidence: "high",
        };
      }
      return {
        status: "issue",
        explanation:
          "No education section was identified. Most resumes include one, even briefly, once work experience has started.",
        recommendation:
          'Add an "Education" heading with your degree, institution and graduation year.',
        confidence: "high",
      };
    },
  },
  {
    id: "structure-skills-section",
    categoryId: "structure",
    title: "Skills section",
    description:
      "Whether skills are grouped into a dedicated section, which makes them easy to find and parse. This is the single presence check for a skills section; the skills category measures breadth and specificity separately.",
    severity: "medium",
    points: 3,
    evaluate: (resume) => {
      if (resume.stats.wordCount < SCORING_THRESHOLDS.minimalWords) {
        return {
          status: "unable-to-verify",
          explanation:
            "Too little text was extracted to tell whether a skills section exists. " +
            UNABLE_TO_VERIFY_NOTE,
          confidence: "high",
        };
      }
      if (hasSection(resume.sections, "skills")) {
        return {
          status: "pass",
          explanation:
            'A dedicated skills section was found. Grouped skills are easy for recruiters and parsers to locate.',
          confidence: "high",
        };
      }
      if (resume.skills.length >= SCORING_THRESHOLDS.minimumSkillTermCount) {
        return {
          status: "warning",
          explanation: `Skills are mentioned throughout the resume (${resume.skills.length} recognized terms), but there is no dedicated skills section.`,
          recommendation:
            'Add a short "Skills" section that groups your strongest tools and technologies in one place.',
          confidence: "medium",
        };
      }
      return {
        status: "issue",
        explanation:
          "No skills section was found and few recognizable skill terms were detected.",
        recommendation:
          'Add a "Skills" section listing the tools and technologies you actually use.',
        confidence: "high",
      };
    },
  },
  {
    id: "structure-projects",
    categoryId: "structure",
    title: "Projects section where relevant",
    description:
      "Whether the resume includes projects. Not required for candidates with substantial employment history.",
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      if (resume.stats.wordCount < SCORING_THRESHOLDS.minimalWords) {
        return {
          status: "unable-to-verify",
          explanation:
            "Too little text was extracted to tell whether a projects section exists. " +
            UNABLE_TO_VERIFY_NOTE,
          confidence: "high",
        };
      }
      if (hasSection(resume.sections, "projects")) {
        return {
          status: "pass",
          explanation:
            "A projects section was found. Projects are the strongest evidence of applied skill for early-career candidates.",
          confidence: "high",
        };
      }
      if (hasAnySection(resume.sections, EXPERIENCE_IDS)) {
        return {
          status: "not-applicable",
          explanation:
            "No projects section was found. Projects are optional for candidates with a substantial experience section, so this check was excluded rather than penalized.",
          confidence: "medium",
        };
      }
      return {
        status: "issue",
        explanation:
          "No projects section was found, and there is no employment history to draw on. Projects are the main alternative evidence for freshers and students.",
        recommendation:
          'Add a "Projects" section with 2-3 projects: what you built, the tools you used and the outcome.',
        confidence: "high",
      };
    },
  },
  {
    id: "structure-recognizable-headings",
    categoryId: "structure",
    title: "Recognizable section headings",
    description:
      "Whether the document uses clear, standard section headings that recruiters and parsers can find.",
    severity: "medium",
    points: 2,
    evaluate: (resume) => {
      if (resume.stats.wordCount < SCORING_THRESHOLDS.minimalWords) {
        return {
          status: "unable-to-verify",
          explanation:
            "Too little text was extracted to identify section headings. " + UNABLE_TO_VERIFY_NOTE,
          confidence: "high",
        };
      }
      const count = resume.sections.length;
      if (count >= 3) {
        return {
          status: "pass",
          explanation: `${count} standard sections were identified: ${formatHeadingList(resume.sections)}.`,
          confidence: "high",
        };
      }
      if (count >= 1) {
        return {
          status: "warning",
          explanation: `Only ${count} standard section ${count === 1 ? "heading was" : "headings were"} identified: ${formatHeadingList(resume.sections)}.`,
          recommendation:
            "Use clear single-line headings such as Experience, Education, Skills and Projects.",
          evidence: [`Found: ${formatHeadingList(resume.sections)}`],
          confidence: "medium",
        };
      }
      return {
        status: "issue",
        explanation:
          "No standard section headings were recognized. Without them, parsers and recruiters have to guess where each kind of information lives.",
        recommendation:
          "Add clear headings on their own lines: Experience, Education, Skills, Projects.",
        confidence: "medium",
      };
    },
  },
  {
    id: "structure-role-chronology",
    categoryId: "structure",
    title: "Roles listed newest first",
    description:
      "Whether dated roles appear in reverse chronological order, the convention recruiters scan with.",
    severity: "medium",
    points: 3,
    evaluate: (resume) => {
      if (resume.stats.wordCount < SCORING_THRESHOLDS.minimalWords) {
        return {
          status: "unable-to-verify",
          explanation:
            "Too little text was extracted to read role order. " + UNABLE_TO_VERIFY_NOTE,
          confidence: "high",
        };
      }

      const sections = [
        ...getSections(resume.sections, "experience"),
        ...getSections(resume.sections, "internships"),
      ];
      const entries = sections.flatMap((section) => findRoleEntries(section.content));

      if (entries.length < 2) {
        return {
          status: "unable-to-verify",
          explanation:
            `Only ${entries.length} dated role ${entries.length === 1 ? "entry was" : "entries were"} found, so their order could not be compared. ` +
            UNABLE_TO_VERIFY_NOTE,
          recommendation:
            "Write each role as its own line: company, job title, then the dates, for example “Northwind Payments | Engineer | 03/2021 - Present”.",
          confidence: "medium",
        };
      }

      const offenders = findOutOfOrderEntries(entries);

      if (offenders.length === 0) {
        return {
          status: "pass",
          explanation: `${entries.length} dated roles were found and they run newest first, from ${Math.max(...entries.map((e) => e.latestYear))} back to ${Math.min(...entries.map((e) => e.latestYear))}.`,
          confidence: "medium",
        };
      }

      return {
        status: "warning",
        explanation: `${offenders.length} of ${entries.length} dated roles appear to be listed out of order. Recruiters expect the most recent role first and stop reading when order breaks down.`,
        recommendation:
          "Reorder the roles so the most recent start or end year comes first, and keep a current role at the top.",
        evidence: offenders.slice(0, 3).map((entry) => `Appears after a more recent role: ${entry.line}`),
        confidence: "medium",
      };
    },
  },
  {
    id: "structure-plain-headings",
    categoryId: "structure",
    title: "Section headings are plain text",
    description:
      "Whether section headings avoid emoji and symbols, which parsers can mangle even when they look fine on screen.",
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      if (resume.sections.length === 0) {
        return {
          status: "unable-to-verify",
          explanation:
            "No section headings were identified to inspect. " + UNABLE_TO_VERIFY_NOTE,
          confidence: "medium",
        };
      }

      const decorated = resume.sections.filter((section) => countGlyphs(section.heading) > 0);

      if (decorated.length === 0) {
        return {
          status: "pass",
          explanation: `All ${resume.sections.length} section headings are plain text.`,
          confidence: "high",
        };
      }

      return {
        status: "warning",
        explanation: `${decorated.length} of ${resume.sections.length} section headings contain symbols or emoji. They survive a screenshot but can be mangled or dropped once the text is extracted.`,
        recommendation:
          'Use the plain heading alone, for example "Experience" rather than "Experience ✨".',
        evidence: decorated
          .slice(0, 3)
          .map((section) => `Heading contains a symbol: ${section.heading}`),
        confidence: "high",
      };
    },
  },
  {
    id: "structure-summary-length",
    categoryId: "structure",
    title: "Professional summary is short",
    description:
      "Whether a summary section, if present, stays short enough to be read rather than skimmed past.",
    severity: "low",
    points: 1,
    evaluate: (resume) => {
      const summary =
        getSection(resume.sections, "summary") ??
        resume.sections.find((section) => section.normalizedHeading.includes("summary"));

      if (!summary) {
        return {
          status: "not-applicable",
          explanation:
            "No summary section was found. A summary is optional, so this check was excluded rather than penalized.",
          recommendation:
            "If you do add one, keep it under 50 words and lead with your role and years of experience.",
          confidence: "medium",
        };
      }

      const words = summary.content.split(/\s+/).filter(Boolean).length;

      if (words === 0) {
        return {
          status: "unable-to-verify",
          explanation:
            "A summary heading was found but no text followed it. " + UNABLE_TO_VERIFY_NOTE,
          confidence: "medium",
        };
      }

      if (words <= SCORING_THRESHOLDS.summaryWordLimit) {
        return {
          status: "pass",
          explanation: `The summary is ${words} ${words === 1 ? "word" : "words"}, which is short enough to be read in a few seconds.`,
          confidence: "high",
        };
      }

      const severe = words > SCORING_THRESHOLDS.summaryWordWarning;
      return {
        status: severe ? "issue" : "warning",
        explanation: `The summary is ${words} words. A summary is meant to be the one part a reader is guaranteed to read, and past about ${SCORING_THRESHOLDS.summaryWordWarning} words it becomes another section to skip.`,
        recommendation: `Cut the summary to under ${SCORING_THRESHOLDS.summaryWordLimit} words: name your role, your years of experience, and the one or two things you are best at.`,
        confidence: "medium",
      };
    },
  },
];

export const STRUCTURE_POINTS = structureChecks.reduce((sum, check) => sum + check.points, 0);