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
 */
export const SCORING_VERSION = "1.2.0";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

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
  /** Distinct recognized skill terms considered a strong set. */
  strongSkillTermCount: 15,
  minimumSkillTermCount: 8,
  /** Lines longer than this may indicate columns or tables. */
  longLineCharacters: 110,
  longLineRatioWarning: 0.4,
  /** Page count guidance. */
  typicalMaxPages: 3,
  longResumePages: 4,
  /** Share of headings that must share one casing style for a pass. */
  headingStyleSharePass: 0.9,
  /** A professional summary longer than this reads as a wall of text. */
  summaryWordLimit: 50,
  /** Above this, a summary is more likely to be hiding than describing. */
  summaryWordWarning: 80,
  /** Dates older than this are ignored when judging role order. */
  plausibleYearMin: 1950,
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
