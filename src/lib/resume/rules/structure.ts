import { SCORING_THRESHOLDS } from "@/config/scoring";
import { getSection, getSections, matchSectionHeading } from "../section-detector";
import { isBulletLine } from "../bullet-analyzer";
import { redactContact } from "../redact";
import type { ParsedResume, ResumeCheck } from "../types";
import type { RoleEntry } from "./helpers";
import {
  EQUIVALENT_IDS,
  UNABLE_TO_VERIFY_NOTE,
  countGlyphs,
  findOutOfOrderEntries,
  findRoleEntries,
  formatHeadingList,
  hasAnySection,
  headingText,
  sectionTitles,
  share,
} from "./helpers";

/**
 * Sections a recruiter scans for, in the order they are conventionally written.
 *
 * Anything outside this list is ignored rather than counted as a swap: a resume
 * with Publications before Education has not made a statement about how it reads,
 * and penalising the order of sections it never claimed to be following is a
 * finding about the tool's expectations, not about the document.
 */
const CONVENTIONAL_ORDER = [
  "summary",
  "experience",
  "projects",
  "education",
  "skills",
  "certifications",
  "languages",
] as const;

const SECTION_ORDER_LABELS: Record<string, string> = {
  summary: "Summary",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  languages: "Languages",
};

/**
 * Sections that show the candidate has done the work, whether or not an
 * employer paid them for it. `structure-experience` accepts these as proof, so
 * `structure-projects` has to accept them too - see the note on the check below.
 */
const EXPERIENCE_OR_EQUIVALENT = ["experience", ...EQUIVALENT_IDS];

/** Dated role headers, in document order, from every section that lists roles. */
function datedRoleEntries(resume: ParsedResume): RoleEntry[] {
  const sections = [
    ...getSections(resume.sections, "experience"),
    ...getSections(resume.sections, "internships"),
  ];
  return sections.flatMap((section) => findRoleEntries(section.content));
}

/**
 * The year an entry is filed under: when it ended, or when it started if it is
 * still open. Derived from the document, never from the clock - scoring has to
 * return the same report for the same bytes tomorrow.
 */
function entryYear(entry: RoleEntry): number {
  const { interval } = entry;
  if (interval === undefined) return entry.latestYear;
  return interval.endYear ?? interval.startYear;
}

/** Whether a role was on the clock within the window before the newest date here. */
function isRecent(entry: RoleEntry, newestYear: number): boolean {
  return (
    Math.max(entryYear(entry), entry.latestYear) >=
    newestYear - SCORING_THRESHOLDS.recentRoleWindowYears
  );
}

interface IntervalDefect {
  entry: RoleEntry;
  reason: string;
}

/**
 * Date ranges that cannot be true.
 *
 * Overlap is deliberately absent: two roles genuinely on the clock at once is
 * legitimate work, and the chronology check is where that question belongs.
 */
function intervalDefects(entries: RoleEntry[]): IntervalDefect[] {
  const defects: IntervalDefect[] = [];
  for (const entry of entries) {
    const { interval } = entry;
    if (interval === undefined) continue;
    if (interval.startYear > SCORING_THRESHOLDS.plausibleYearMax) {
      defects.push({ entry, reason: `starts in ${interval.startYear}, beyond ${SCORING_THRESHOLDS.plausibleYearMax}` });
      continue;
    }
    const { endYear } = interval;
    if (endYear === null) continue;
    if (endYear < interval.startYear) {
      defects.push({ entry, reason: `ends in ${endYear} but starts in ${interval.startYear}` });
      continue;
    }
    if (
      endYear === interval.startYear &&
      interval.endMonth !== undefined &&
      interval.startMonth !== undefined &&
      interval.endMonth < interval.startMonth
    ) {
      defects.push({ entry, reason: "ends in an earlier month than it starts in the same year" });
    }
  }
  return defects;
}

/**
 * Earliest and latest year written anywhere in the role headers.
 *
 * `latestYear` rather than the interval's end: a current role's end is the
 * present moment, which has no year, so mixing the two produced copy claiming a
 * resume "runs newest first, from 2024 back to 2022" when the 2024 role was the
 * one further down the page.
 *
 * `reduce` rather than `Math.max(...entries.map(...))`: the spread throws
 * RangeError past roughly 130k arguments, a role block can hold that many
 * entries under the extraction cap, and the throw escaped `scoreResume` uncaught.
 */
function yearExtremes(entries: RoleEntry[]): { newest: number; oldest: number } {
  let newest = 0;
  let oldest = Number.MAX_SAFE_INTEGER;
  for (const entry of entries) {
    const year = entry.latestYear;
    if (year > newest) newest = year;
    if (year < oldest) oldest = year;
  }
  return { newest, oldest };
}

export const structureChecks: ResumeCheck[] = [
  {
    id: "structure-experience",
    categoryId: "structure",
    title: "Experience or equivalent practical section",
    description:
      "Whether the resume contains a work experience section, or an equivalent section such as internships or projects.",
    severity: "medium",
    points: 3,
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

      const experience = getSection(resume.sections, "experience");
      if (experience !== undefined) {
        return {
          status: "pass",
          explanation: `A professional experience section was found under "${headingText(experience)}".`,
          confidence: "high",
        };
      }

      // The same list `structure-projects` reads. The two had separate copies and
      // disagreed, so an internship-only resume earned full marks here and was
      // then told a few lines later that it had no employment history to draw on.
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

      const detected = resume.sections.slice(0, 3).map((section) => {
        return `Detected section: "${headingText(section)}"`;
      });
      return {
        status: "issue",
        explanation:
          "No experience, internship or projects section could be identified. Recruiters look for evidence of applied work before anything else.",
        recommendation:
          "Add a section titled Experience or Internships. If you have no employment history yet, list academic or personal projects, volunteering or freelance work instead.",
        // An empty evidence array reads as "we looked and found nothing", which
        // is a different claim from "there was nothing to list".
        ...(detected.length > 0 ? { evidence: detected } : {}),
        confidence: "high",
      };
    },
  },
  {
    id: "structure-education",
    categoryId: "structure",
    title: "Education section",
    description: "Whether the resume includes an education section.",
    severity: "low",
    points: 2,
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
      if (getSection(resume.sections, "education") !== undefined) {
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
    severity: "low",
    points: 2,
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
      if (getSection(resume.sections, "skills") !== undefined) {
        return {
          status: "pass",
          explanation:
            "A dedicated skills section was found. Grouped skills are easy for recruiters and parsers to locate.",
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
    points: 1,
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
      if (getSection(resume.sections, "projects") !== undefined) {
        return {
          status: "pass",
          explanation:
            "A projects section was found. Projects are the strongest evidence of applied skill for early-career candidates.",
          confidence: "high",
        };
      }
      if (hasAnySection(resume.sections, EXPERIENCE_OR_EQUIVALENT)) {
        // A missing section is a finding about the document, not a reason to
        // remove points. `not-applicable` had this returning zero of zero, so
        // deleting a projects section from a resume with a full work history
        // raised the score.
        //
        // `experience` is in this list for the same reason it is in
        // `structure-experience`'s: the two checks shared one list and then
        // disagreed, and an experienced profile with no projects section was
        // told it had "no employment history to draw on" - the `issue` copy,
        // for a resume whose employment history was the thing being scanned.
        return {
          status: "warning",
          explanation:
            "No projects section was found. Projects are optional once there is an employment history, so this costs a little rather than a lot, but they are the section that shows applied work without a job title attached to it.",
          recommendation:
            'If you have built anything you can describe in a sentence or two, add it under a "Projects" heading.',
          confidence: "medium",
        };
      }
      return {
        status: "issue",
        explanation:
          "No projects section was found, and no internship, volunteer or activities section stands in for one. Projects are the main alternative evidence for freshers and students.",
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
    severity: "low",
    points: 1,
    evaluate: (resume) => {
      if (resume.stats.wordCount < SCORING_THRESHOLDS.minimalWords) {
        return {
          status: "unable-to-verify",
          explanation:
            "Too little text was extracted to identify section headings. " + UNABLE_TO_VERIFY_NOTE,
          confidence: "high",
        };
      }

      // Distinct section ids, not headings. `EXPERIENCE / ... / EXPERIENCE / ...`
      // used to push this check toward a pass by repeating one fact, which is the
      // opposite of what a navigable document looks like.
      const distinct = new Set(resume.sections.map((section) => section.id.replace(/-\d+$/, "")));
      const count = distinct.size;
      const headings = formatHeadingList(resume.sections);

      if (count >= SCORING_THRESHOLDS.strongHeadingCount) {
        return {
          status: "pass",
          explanation: `${count} distinct standard sections were identified: ${headings}. Headings written as "Skills & Tools", "Key Competencies" or "Executive Summary" are recognised as the sections they name, not missed.`,
          confidence: "high",
        };
      }

      const unresolved = unresolvedHeadingLines(resume);
      const evidence = [
        ...(headings.length > 0 ? [`Found: ${headings}`] : []),
        ...unresolved.map(
          (line) => `Line that did not resolve to a standard section: "${line}"`,
        ),
      ];

      if (count >= 1) {
        return {
          status: "warning",
          explanation: `Only ${count} distinct standard section ${count === 1 ? "heading was" : "headings were"} identified: ${headings}.`,
          recommendation:
            "Use clear single-line headings such as Experience, Education, Skills and Projects.",
          ...(evidence.length > 0 ? { evidence } : {}),
          confidence: "medium",
        };
      }
      return {
        status: "issue",
        explanation:
          "No standard section headings were recognized. Without them, parsers and recruiters have to guess where each kind of information lives.",
        recommendation:
          "Add clear headings on their own lines: Experience, Education, Skills, Projects.",
        ...(evidence.length > 0 ? { evidence } : {}),
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
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      if (resume.stats.wordCount < SCORING_THRESHOLDS.minimalWords) {
        return {
          status: "unable-to-verify",
          explanation:
            "Too little text was extracted to read role order. " + UNABLE_TO_VERIFY_NOTE,
          confidence: "high",
        };
      }

      const entries = datedRoleEntries(resume);

      if (entries.length < SCORING_THRESHOLDS.minimumRoleEntries) {
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
        const { newest, oldest } = yearExtremes(entries);
        return {
          status: "pass",
          explanation: `${entries.length} dated roles were found and they run newest first; the dates in them span ${oldest} to ${newest}. Roles written as spans were compared as spans, so a current role counts as the most recent entry and two genuinely overlapping contracts are not treated as out of order.`,
          confidence: "medium",
        };
      }

      return {
        status: "warning",
        explanation: `${offenders.length} of ${entries.length} dated roles read as older than the role above them. Recruiters expect the most recent role first and stop reading when order breaks down.`,
        recommendation:
          "Move the current role to the top, then order the rest by how recently they ended.",
        evidence: offenders
          .slice(0, 3)
          .map((entry) => `Reads as older than the entry above it: ${entry.line}`),
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
    points: 1,
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
          explanation: `All ${resume.sections.length} section headings are plain text. Emoji elsewhere in the document are reported separately, by the character-set check.`,
          confidence: "high",
        };
      }

      return {
        status: "warning",
        explanation: `${decorated.length} of ${resume.sections.length} section headings contain an emoji or pictograph. They survive a screenshot but can be mangled or dropped once the text is extracted. Emoji in the rest of the document are counted by the character-set check instead of here, so the two findings never describe the same characters.`,
        recommendation:
          'Use the plain heading alone, for example "Experience" rather than "Experience ✨".',
        evidence: decorated
          .slice(0, 3)
          .map((section) => `Heading contains a pictograph: ${headingText(section)}`),
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

      if (summary === undefined) {
        // Absence is a finding, not an exemption. Returning `not-applicable`
        // scored the check zero of zero, so a resume gained points by leaving a
        // section out - the opposite of what a check that reads a summary is for.
        return {
          status: "warning",
          explanation:
            "No summary section was found. A summary is optional, so this costs a little, but the opening of a resume is the part a reader is most likely to finish first.",
          recommendation:
            "If you do add one, keep it short and lead with your role and years of experience.",
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
  {
    id: "structure-role-dates",
    categoryId: "structure",
    title: "Role dates are consistent and ordered",
    description:
      "Whether every dated role reads as a plausible span: an end that is not before its start, a month that is not after the end month, and a year that could have happened.",
    severity: "medium",
    points: 3,
    evaluate: (resume) => {
      if (resume.stats.wordCount < SCORING_THRESHOLDS.minimalWords) {
        return {
          status: "unable-to-verify",
          explanation:
            "Too little text was extracted to read role dates. " + UNABLE_TO_VERIFY_NOTE,
          confidence: "high",
        };
      }

      const entries = datedRoleEntries(resume);
      if (entries.length === 0) {
        return {
          status: "unable-to-verify",
          explanation:
            "No dated role lines were found, so there were no date spans to check. " +
            UNABLE_TO_VERIFY_NOTE,
          recommendation:
            "Give each role one line with its dates, for example “Engineer | Acme | Mar 2021 - Present”.",
          confidence: "medium",
        };
      }

      const defects = intervalDefects(entries);
      const unreadable = entries.filter((entry) => entry.interval === undefined);
      const unreadableShare = share(unreadable.length, entries.length);

      if (defects.length === 0 && unreadableShare < SCORING_THRESHOLDS.roleDateRangeWarningRate) {
        return {
          status: "pass",
          explanation: `${entries.length} dated ${entries.length === 1 ? "role carries" : "roles carry"} a readable, ordered date range. Overlapping spans are left alone: two roles genuinely on the clock at the same time is legitimate.`,
          confidence: "medium",
        };
      }

      const parts: string[] = [];
      if (defects.length > 0) {
        parts.push(
          `${defects.length} ${defects.length === 1 ? "role has" : "roles have"} a date range that cannot be true`,
        );
      }
      if (unreadable.length > 0) {
        parts.push(
          `${unreadable.length} of ${entries.length} role ${unreadable.length === 1 ? "line carries" : "lines carry"} a year but no readable start and end`,
        );
      }

      const status =
        defects.length <= 1 && unreadableShare <= SCORING_THRESHOLDS.roleDateRangeWarningRate
          ? "warning"
          : "issue";

      return {
        status,
        explanation: `${parts.join(", and ")}. A span that ends before it starts, or a month that runs backwards inside one year, is read by a parser as a different timeline than the one a reader sees.`,
        recommendation:
          "Write each role's dates as one span on the same line, earliest month first, and use “Present” for the role you are in.",
        evidence: defects
          .slice(0, 3)
          .map((defect) => `Date range ${defect.reason}: ${defect.entry.line}`),
        confidence: "medium",
      };
    },
  },
  {
    id: "structure-date-granularity",
    categoryId: "structure",
    title: "Recent roles give a month, not just a year",
    description:
      "Whether roles from the last few years carry a month as well as a year, which is what makes a timeline readable.",
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      if (resume.stats.wordCount < SCORING_THRESHOLDS.minimalWords) {
        return {
          status: "unable-to-verify",
          explanation:
            "Too little text was extracted to read role dates. " + UNABLE_TO_VERIFY_NOTE,
          confidence: "high",
        };
      }

      const entries = datedRoleEntries(resume);
      if (entries.length === 0) {
        return {
          status: "unable-to-verify",
          explanation:
            "No dated role lines were found, so there was no recent history to judge. " +
            UNABLE_TO_VERIFY_NOTE,
          confidence: "medium",
        };
      }

      const newest = yearExtremes(entries).newest;
      const recent = entries.filter((entry) => isRecent(entry, newest));
      if (recent.length === 0) {
        return {
          status: "unable-to-verify",
          explanation: `No role falls within the last ${SCORING_THRESHOLDS.recentRoleWindowYears} years of the dates in this resume, so there was no recent role to judge. ${UNABLE_TO_VERIFY_NOTE}`,
          confidence: "medium",
        };
      }

      const withMonth = recent.filter((entry) => {
        const { interval } = entry;
        return interval !== undefined && (interval.startMonth !== undefined || interval.endMonth !== undefined);
      });
      const ratio = share(withMonth.length, recent.length);
      const bare = recent.filter((entry) => !withMonth.includes(entry));

      if (ratio >= SCORING_THRESHOLDS.monthPrecisionSharePass) {
        return {
          status: "pass",
          explanation: `${withMonth.length} of the ${recent.length} roles from the last ${SCORING_THRESHOLDS.recentRoleWindowYears} years give a month as well as a year, which is what makes the gaps between roles readable.`,
          confidence: "medium",
        };
      }

      return {
        status: ratio >= SCORING_THRESHOLDS.monthPrecisionShareWarning ? "warning" : "issue",
        explanation:
          `${bare.length} of the ${recent.length} roles from the last ${SCORING_THRESHOLDS.recentRoleWindowYears} years give only a year. ` +
          "A bare year cannot show how long a role lasted or whether two roles overlapped, which is exactly what a reader is checking in the recent part of a timeline.",
        recommendation:
          'Write recent dates as "Mar 2021 - Jun 2023". Older history can stay at year precision.',
        evidence: bare.slice(0, 3).map((entry) => `Year only: ${entry.line}`),
        confidence: "medium",
      };
    },
  },
  {
    id: "structure-section-order",
    categoryId: "structure",
    title: "Sections follow the usual order",
    description:
      "Whether the sections a recruiter expects appear in the conventional order: summary, experience, projects, education, skills.",
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      const ordered: string[] = [];
      const seen = new Set<string>();
      const byOrder = [...resume.sections].sort((left, right) => left.order - right.order);
      for (const section of byOrder) {
        const base = section.id.replace(/-\d+$/, "");
        if (!CONVENTIONAL_ORDER.includes(base as (typeof CONVENTIONAL_ORDER)[number])) continue;
        if (seen.has(base)) continue;
        seen.add(base);
        ordered.push(base);
      }

      if (ordered.length < 3) {
        return {
          status: "unable-to-verify",
          explanation: `Only ${ordered.length} of the conventional sections ${ordered.length === 1 ? "was" : "were"} found, so there was not enough structure to compare an order. ${UNABLE_TO_VERIFY_NOTE}`,
          confidence: "medium",
        };
      }

      const swaps: string[] = [];
      for (let index = 1; index < ordered.length; index += 1) {
        const previous = CONVENTIONAL_ORDER.indexOf(ordered[index - 1] as (typeof CONVENTIONAL_ORDER)[number]);
        const current = CONVENTIONAL_ORDER.indexOf(ordered[index] as (typeof CONVENTIONAL_ORDER)[number]);
        if (current < previous) {
          swaps.push(
            `${SECTION_ORDER_LABELS[ordered[index] ?? ""] ?? ordered[index]} appears before ${SECTION_ORDER_LABELS[ordered[index - 1] ?? ""] ?? ordered[index - 1]}`,
          );
        }
      }

      const sequence = ordered.map((id) => SECTION_ORDER_LABELS[id] ?? id).join(", ");

      if (swaps.length === 0) {
        return {
          status: "pass",
          explanation: `The sections run in the conventional order: ${sequence}.`,
          confidence: "high",
        };
      }

      const status = swaps.length <= SCORING_THRESHOLDS.sectionOrderSwapWarning ? "warning" : "issue";
      return {
        status,
        explanation: `${swaps.length} ${swaps.length === 1 ? "pair of sections is" : "pairs of sections are"} out of the conventional order: ${sequence}. A reader scanning top to bottom expects experience before education and skills near the end.`,
        recommendation:
          "Move sections into the order: Summary, Experience, Projects, Education, Skills, Certifications, Languages. Sections outside that list are ignored here.",
        evidence: swaps.slice(0, 3),
        confidence: "medium",
      };
    },
  },
];

/**
 * Shape bounds for "this line was trying to be a heading".
 *
 * The same numbers `section-detector` applies before it will even consider a
 * line, so a body line outside them is never reported as a missed heading. They
 * belong beside `MAX_HEADING_LENGTH` / `MAX_HEADING_WORDS` in one shared place,
 * which is not a file I own.
 */
const HEADING_SHAPE_MAX_LENGTH = 60;
const HEADING_SHAPE_MAX_WORDS = 6;

/**
 * Lines that read like a heading but did not resolve to a standard section.
 *
 * `detectSections` runs the tolerant matcher over every line, so this is the
 * evidence behind a low heading count: without it, telling a reader only that
 * "fewer than three headings were found" hid the fact that their "Skills & Tools"
 * heading was the reason.
 */
function unresolvedHeadingLines(resume: ParsedResume, max = 3): string[] {
  const detected = new Set(resume.sections.map((section) => section.heading.trim()));
  const found: string[] = [];
  for (const raw of resume.normalizedText.split("\n")) {
    const line = raw.trim();
    if (line.length === 0 || line.length > HEADING_SHAPE_MAX_LENGTH) continue;
    if (detected.has(line)) continue;
    if (/[.,;:]$/.test(line) || line.split(/\s+/).length > HEADING_SHAPE_MAX_WORDS) continue;
    if (isBulletLine(line)) continue;
    if (matchSectionHeading(line) !== undefined) continue;
    found.push(redactContact(line).text);
    if (found.length >= max) break;
  }
  return found;
}
