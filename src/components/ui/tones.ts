import type { Tone } from "@/components/ui/badge";
import type {
  CheckSeverity,
  CheckStatus,
  SignalSeverity,
} from "@/lib/resume/types";
import type { ScoreBandId } from "@/config/scoring";

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
  if (lostShare >= 0.6) return "issue";
  if (lostShare >= 0.25) return "caution";
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