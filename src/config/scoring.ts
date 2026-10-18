/**
 * Scoring policy configuration.
 *
 * Every tunable number in the deterministic scoring engine lives here so the
 * methodology page can render true values and tests can rely on them.
 * These weights are product policy, not universal truths about hiring.
 */

/**
 * Bumped to 1.1.0 when four checks were added from the published Tech Interview
 * Handbook resume guide: role chronology, plain-text headings, summary length
 * and glyph safety. Scores are only comparable within a version, and the report
 * shows the version it was scored with.
 *
 * Bumped to 1.2.0 when the duplicated skills-section presence check was merged
 * into a single check (`structure-skills-section`). Previously a missing skills
 * section cost up to 9 points across two near-identical checks; now presence is
 * measured once (structure, 3 pts) and the skills category measures breadth
 * (8 pts), specificity (6 pts) and scannability (6 pts). Total stays 100.
 *
 * Bumped to 1.3.0 when six checks were added — role date validity, date
 * granularity, section order, tense consistency, reading order and scanned
 * pages — and the per-check weights were rebalanced to pay for them. The
 * category weights (20/25/15/20/20) did not change; only how those 100 points
 * are distributed across 36 checks instead of 30. Every check that existed at
 * 1.2.0 still exists here, so no previously-reported finding disappears.
 */
export const SCORING_VERSION = "1.3.0";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * How the limit is written in user-facing copy. It is a label rather than a
 * derived value because a legal sentence should read "5 MB", not whatever a
 * byte formatter produces, and because the uploader and the privacy policy were
 * each deriving the same string separately.
 */
export const MAX_UPLOAD_LABEL = "5 MB";

export const ACCEPTED_EXTENSIONS = ["pdf", "docx"] as const;
export type AcceptedExtension = (typeof ACCEPTED_EXTENSIONS)[number];

export interface ScoringCategoryConfig {
  id: string;
  name: string;
  description: string;
  /** Weight of this category in the overall score. All weights sum to 100. */
  weight: number;
}

export const SCORING_CATEGORIES: ScoringCategoryConfig[] = [
  {
    id: "structure",
    name: "Structure and completeness",
    description:
      "Whether the major sections a recruiter expects are present and easy to find.",
    weight: 20,
  },
  {
    id: "content",
    name: "Content and bullet quality",
    description:
      "How clearly your bullet points describe actions, tools and outcomes.",
    weight: 25,
  },
  {
    id: "contact",
    name: "Contact and professional profile",
    description:
      "Whether recruiters can reach you and find your professional profiles.",
    weight: 15,
  },
  {
    id: "readability",
    name: "Readability and formatting",
    description:
      "How reliably your document can be read and understood, including by software that parses resumes.",
    weight: 20,
  },
  {
    id: "skills",
    name: "Skills and relevance signals",
    description:
      "General skills and keyword signals. Job-specific matching needs a target role and is not part of this check.",
    weight: 20,
  },
];

export const TOTAL_SCORE_WEIGHT = SCORING_CATEGORIES.reduce(
  (sum, category) => sum + category.weight,
  0,
);

export function getCategoryConfig(id: string): ScoringCategoryConfig {
  const category = SCORING_CATEGORIES.find((entry) => entry.id === id);
  if (!category) {
    throw new Error(`Unknown scoring category: ${id}`);
  }
  return category;
}

/* ------------------------------------------------------------------ */
/* Detection thresholds (used by rules, kept here for transparency)    */
/* ------------------------------------------------------------------ */

export const SCORING_THRESHOLDS = {
  /** Below this word count, a resume is considered to have very little content. */
  minimalWords: 60,
  /** Below this word count the document is a stub rather than a resume. */
  extractableTextWarningWords: 20,
  /** Bullet word count limits. */
  longBulletWords: 46,
  shortBulletWords: 5,
  /** Share of bullets that should start with an action verb for a full pass. */
  actionVerbSharePass: 0.5,
  actionVerbShareWarning: 0.25,
  /** Share of bullets containing a measurable number. */
  quantifiedSharePass: 0.3,
  quantifiedShareWarning: 0.12,
  /** Share of bullets containing first-person language. */
  firstPersonShareWarning: 0.2,
  /** Share of bullets using weak/generic phrasing. */
  weakPhraseShareWarning: 0.25,
  /**
   * Defect *rates*, not counts. Three long bullets in a six-bullet resume is a
   * 50% rate; three in a twenty-five-bullet resume is 12%. Counting absolutes
   * punished a longer resume for the same underlying quality.
   */
  longBulletShareWarning: 0.15,
  shortBulletShareWarning: 0.15,
  /** Distinct recognized skill terms considered a strong set. */
  strongSkillTermCount: 15,
  minimumSkillTermCount: 8,
  /** Share of a skills section that must be recognisable terms, not filler. */
  genericTermSharePass: 0.25,
  genericTermShareWarning: 0.45,
  /** A skills line at or under this many characters reads as a scannable list. */
  skillsLineLengthPass: 80,
  /** Lines longer than this may indicate columns or tables. */
  longLineCharacters: 110,
  longLineRatioWarning: 0.4,
  /** Page count guidance. */
  typicalMaxPages: 3,
  longResumePages: 4,
  /** Pages at or under this count are considered the expected length. */
  idealMaxPages: 2,
  /** Consecutive blank lines that read as broken layout. */
  maxBlankLineRunWarning: 3,
  /** Recognizable section headings needed for a full pass. */
  strongHeadingCount: 3,
  /** Share of headings that must share one casing style for a pass. */
  headingStyleSharePass: 0.9,
  headingStyleShareWarning: 0.6,
  /** Share of dates that must share one format family for a pass. */
  dateFormatSharePass: 0.9,
  dateFormatShareWarning: 0.6,
  /** A professional summary longer than this reads as a wall of text. */
  summaryWordLimit: 50,
  /** Above this, a summary is more likely to be hiding than describing. */
  summaryWordWarning: 80,
  /** Dates older than this are ignored when judging role order. */
  plausibleYearMin: 1950,
  /** A year beyond this is a typo or a planned role, not a past one. */
  plausibleYearMax: 2100,
  /** A role header longer than this is prose, not a role line. */
  maxRoleLineLength: 140,
  /** Fewer role entries than this means order cannot be judged. */
  minimumRoleEntries: 2,
  /** Estimated words on one printed page, used when a DOCX reports no page count. */
  wordsPerPage: 550,
  /* ---- Date validity, granularity and section order (1.3.0) ---- */
  /** Share of role entries that must carry a readable, ordered date range. */
  roleDateRangeWarningRate: 0.5,
  /** Roles ending within this many years must give a month, not just a year. */
  recentRoleWindowYears: 3,
  /** Share of recent roles that must carry month precision. */
  monthPrecisionSharePass: 0.8,
  monthPrecisionShareWarning: 0.5,
  /** Out-of-order section swaps tolerated before this is an issue. */
  sectionOrderSwapWarning: 1,
  /** Share of bullets that must share one tense. */
  tenseConsistencyPass: 0.9,
  tenseConsistencyWarning: 0.75,
  /** Share of pages that may be image-only before this is an issue. */
  scannedPageShareIssue: 0.5,
  /** Lines that interleave two columns before this is an issue. */
  interleavedLineIssueCount: 3,
} as const;

/** Credit awarded for a "warning" result, as a fraction of the check points. */
export const WARNING_CREDIT = 0.5;

export const SCORE_BANDS = [
  {
    id: "excellent",
    min: 90,
    label: "Excellent",
    summary:
      "Your resume covers the essentials well. Review the suggestions below to keep it sharp.",
  },
  {
    id: "strong",
    min: 75,
    label: "Strong",
    summary:
      "A solid resume overall. The priority fixes below are the quickest ways to strengthen it.",
  },
  {
    id: "good",
    min: 60,
    label: "Good",
    summary:
      "Your resume clears the basics. Work through the priority fixes to close the remaining gaps.",
  },
  {
    id: "fair",
    min: 40,
    label: "Fair",
    summary:
      "There are clear gaps that recruiters and parsers may notice. The priority fixes are a good starting order.",
  },
  {
    id: "needs-work",
    min: 0,
    label: "Needs work",
    summary:
      "Several important elements were missing or hard to detect. Start with the top fixes and re-check when done.",
  },
] as const;

export type ScoreBandId = (typeof SCORE_BANDS)[number]["id"];
