import { TONE_TEXT, TONE_WASH, type Tone } from "@/components/ui/badge";
import type {
  BulletMark,
  CheckSeverity,
  CheckStatus,
  SignalSeverity,
} from "@/lib/resume/types";
import { SCORING_THRESHOLDS, type ScoreBandId } from "@/config/scoring";

/**
 * The single place where a domain value becomes a tone.
 *
 * Every mapping here answers the same question: is there a real result behind
 * this? If there is, it gets a colour. If it is only a measurement — a word
 * count, a score with no band, a file size — it stays ink. That rule is what
 * keeps colour meaningful instead of decorative.
 */

/** A check's outcome. The word always accompanies the tone. */
export function statusTone(status: CheckStatus): Tone {
  switch (status) {
    case "pass":
      return "pass";
    case "warning":
      return "caution";
    case "issue":
      return "issue";
    case "unable-to-verify":
      return "note";
    default:
      return "mute";
  }
}

/**
 * How much a problem matters. Severity is not the same as status: a check can
 * pass and still be high severity, and an informational note is not a warning.
 */
export function severityTone(severity: CheckSeverity): Tone {
  switch (severity) {
    case "high":
      return "issue";
    case "medium":
      return "caution";
    case "low":
      return "note";
    default:
      return "mute";
  }
}

/** A parsing or formatting signal raised while reading the document. */
export function signalTone(severity: SignalSeverity): Tone {
  switch (severity) {
    case "critical":
      return "issue";
    case "warning":
      return "caution";
    default:
      return "note";
  }
}

/**
 * The overall score band.
 *
 * Three tones for five bands, on purpose. Excellent and strong are both green
 * and fair and good are both amber — the word beside the colour tells you
 * which, and giving each band its own hue would be five colours saying
 * nothing except that the designer had five colours.
 */
export function bandTone(band: ScoreBandId): Tone {
  switch (band) {
    case "excellent":
    case "strong":
      return "pass";
    case "good":
    case "fair":
      return "caution";
    default:
      return "issue";
  }
}

/** How hard to work on a fix, from the deterministic priority. */
export function priorityTone(priority: "high" | "medium" | "low"): Tone {
  switch (priority) {
    case "high":
      return "issue";
    case "medium":
      return "caution";
    default:
      return "note";
  }
}

/**
 * Where `categoryTone` changes colour.
 *
 * Exported because the breakdown has to *describe* this rule in prose, and a
 * sentence that hardcodes "a quarter" and "three fifths" starts lying the moment
 * either number moves. The report renders these two values instead.
 */
export const CATEGORY_TONE_THRESHOLDS = {
  /** At or above this share lost, the category reads as amber. */
  caution: 0.25,
  /** At or above this share lost, the category reads as red. */
  issue: 0.6,
} as const;

/**
 * A category's tone follows how much of it was lost, not whether anything
 * failed. "Did this category contain a single issue?" is a useless question
 * across 27 checks — almost every category answers yes, so every bar goes red
 * and the colour stops carrying information.
 *
 * Proportion lost is a real measurement, it already matches the length of the
 * bar beside it, and it spreads: one bad category reads as red while two merely
 * imperfect ones read as amber and the healthy ones stay ink-green.
 */
export function categoryTone(category: { earned: number; possible: number }): Tone {
  if (category.possible <= 0) return "mute";
  const lostShare = (category.possible - category.earned) / category.possible;
  if (lostShare >= CATEGORY_TONE_THRESHOLDS.issue) return "issue";
  if (lostShare >= CATEGORY_TONE_THRESHOLDS.caution) return "caution";
  return "pass";
}

/** Share of a category's points that were lost, as a percentage. */
export function categoryLostPercent(category: {
  earned: number;
  possible: number;
}): number {
  if (category.possible <= 0) return 0;
  return Math.round(((category.possible - category.earned) / category.possible) * 100);
}

/* ------------------------------------------------------------------ */
/* Measured snapshots                                                  */
/* ------------------------------------------------------------------ */

/*
 * These three used to be re-derived inside `content-snapshot.tsx` from literals
 * (200 words, 3 pages, 3 sections). A literal in a component is a second copy of
 * a judgement the scoring engine already makes against `SCORING_THRESHOLDS`: the
 * threshold moves in config, the component keeps telling the reader the old
 * thing, and nothing fails. Each one reads the threshold the engine reads.
 */

export function wordVolumeTone(wordCount: number): Tone {
  return wordCount >= SCORING_THRESHOLDS.minimalWords ? "pass" : "caution";
}

export function pageLengthTone(pageCount: number): Tone {
  return pageCount <= SCORING_THRESHOLDS.typicalMaxPages ? "pass" : "caution";
}

export function sectionCountTone(sectionCount: number): Tone {
  return sectionCount >= SCORING_THRESHOLDS.strongHeadingCount ? "pass" : "caution";
}

/**
 * The lines of the detection snapshot, where an empty result does not mean one
 * thing.
 *
 * A missing set of section headings is a finding about the document. An empty
 * skill-term list is not a finding about the person — the list is a fixed set
 * and a resume can be excellent without touching it. A clean parse is a pass.
 * Routing them through one switch is what keeps four inline colour decisions
 * from becoming four places where the rule quietly differs.
 */
export type SnapshotSignal =
  | "no-sections-found"
  | "no-terms-found"
  | "no-parse-problems"
  | "privacy-note";

export function snapshotTone(signal: SnapshotSignal): Tone {
  switch (signal) {
    case "no-sections-found":
      return "caution";
    case "no-parse-problems":
      return "pass";
    case "privacy-note":
      return "note";
    default:
      return "mute";
  }
}

/* ------------------------------------------------------------------ */
/* Bullet marks                                                        */
/* ------------------------------------------------------------------ */

/**
 * How serious a mark on a bullet is.
 *
 * A `switch` rather than a lookup table: the fallback arm means a seventh kind
 * lands on `issue` instead of silently producing `undefined` classes, which is
 * what a `Record` with no exhaustiveness guarantee used to do here.
 */
export function bulletMarkTone(kind: BulletMark["kind"]): Tone {
  switch (kind) {
    case "too-long":
    case "first-person":
    case "no-action-verb":
    case "no-outcome":
      return "caution";
    default:
      return "issue";
  }
}

/*
 * Wash and text for a highlighted mark. Reused from `badge.tsx` rather than
 * copied: these were a second domain→colour table, which is exactly the drift
 * AGENTS.md §4 exists to prevent, and `badge.tsx` now exports both.
 */
const MARK_WASH: Record<Tone, string> = TONE_WASH;
const MARK_TEXT: Record<Tone, string> = TONE_TEXT;

/** The highlight classes for a marked span: a wash on paper, ink on top of it. */
export function bulletMarkClass(kind: BulletMark["kind"]): string {
  const tone = bulletMarkTone(kind);
  return `${MARK_WASH[tone]} ${MARK_TEXT[tone]}`;
}