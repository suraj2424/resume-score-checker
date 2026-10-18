import { SCORING_THRESHOLDS } from "@/config/scoring";
import type { BulletMark, ResumeBullet } from "./types";

/**
 * Turn detection into pinpointed findings.
 *
 * The scoring rules and the report both read marks from here, so a finding can
 * never be described one way in the score and another way in the list.
 *
 * A mark either points at the exact offending words, or — when the defect is a
 * property of the whole line, such as a bullet that is simply too long — spans
 * the entire bullet. Faking a phrase highlight for "this bullet has no number
 * in it" would be dishonest markup.
 */

export interface BulletInsight {
  bullet: ResumeBullet;
  marks: BulletMark[];
  /** The most serious tone among the marks, used to colour the rule. */
  tone: "issue" | "caution";
}

function wholeBulletMark(
  bullet: ResumeBullet,
  kind: BulletMark["kind"],
  checkId: string,
  label: string,
  detail: string,
  fix: string,
): BulletMark {
  return {
    kind,
    start: 0,
    end: bullet.text.length,
    text: bullet.text,
    label,
    checkId,
    detail,
    fix,
  };
}

/**
 * A mark pinned to the exact words that caused it.
 *
 * Takes no bullet: every caller already holds the span, and passing the bullet
 * as well invited a future edit to reach back into it and re-derive offsets from
 * a second source of truth. `wholeBulletMark` is the opposite case and keeps the
 * bullet, because "the whole line" is the claim.
 */
function spanMark(
  kind: BulletMark["kind"],
  checkId: string,
  label: string,
  span: { start: number; end: number; text: string },
  detail: string,
  fix: string,
): BulletMark {
  return { kind, start: span.start, end: span.end, text: span.text, label, checkId, detail, fix };
}

export function buildBulletMarks(bullet: ResumeBullet): BulletMark[] {
  const marks: BulletMark[] = [];
  const longLimit = SCORING_THRESHOLDS.longBulletWords;
  const shortLimit = SCORING_THRESHOLDS.shortBulletWords;

  if (bullet.wordCount > longLimit) {
    marks.push(
      wholeBulletMark(
        bullet,
        "too-long",
        "content-bullet-length",
        "Too long",
        `${bullet.wordCount} words · limit ${longLimit}`,
        "Split this into two bullets, or cut the part that does not change the outcome.",
      ),
    );
  } else if (bullet.wordCount < shortLimit) {
    marks.push(
      wholeBulletMark(
        bullet,
        "too-short",
        "content-bullet-conciseness",
        "Too thin",
        `${bullet.wordCount} words · needs at least ${shortLimit}`,
        "Say what you did and what it produced. One clause is not an achievement.",
      ),
    );
  }

  if (!bullet.containsNumber) {
    marks.push(
      wholeBulletMark(
        bullet,
        "no-outcome",
        "content-quantified-outcomes",
        "No outcome",
        "No figure, size or time in this line",
        "Add the size of the thing you changed. Not every bullet needs a number, but most need one.",
      ),
    );
  }

  for (const span of bullet.weakPhraseSpans) {
    marks.push(
      spanMark(
        "weak-phrase",
        "content-weak-wording",
        "Filler",
        span,
        `“${span.text}” describes effort, not result`,
        "Start with the verb you actually did, and end with what changed.",
      ),
    );
  }

  for (const span of bullet.firstPersonSpans) {
    marks.push(
      spanMark(
        "first-person",
        "content-first-person",
        "First person",
        span,
        `“${span.text}” puts you in the sentence`,
        "Drop the pronoun. “Led the migration” says the same thing without it.",
      ),
    );
  }

  const leading = bullet.leadingTokenSpan;
  if (leading) {
    marks.push(
      spanMark(
        "no-action-verb",
        "content-action-verbs",
        "No action verb",
        leading,
        `“${leading.text}” is not a verb you did`,
        "Open with what you did: Led, Built, Cut, Migrated, Reduced.",
      ),
    );
  }

  return marks;
}

const TONE_BY_KIND: Record<BulletMark["kind"], "issue" | "caution"> = {
  "too-long": "caution",
  "too-short": "issue",
  "weak-phrase": "issue",
  "first-person": "caution",
  "no-action-verb": "caution",
  "no-outcome": "caution",
};

export function insightTone(marks: BulletMark[]): "issue" | "caution" {
  return marks.some((mark) => TONE_BY_KIND[mark.kind] === "issue") ? "issue" : "caution";
}

/** Every bullet that has at least one mark, ordered most serious first. */
export function collectBulletInsights(bullets: ResumeBullet[]): BulletInsight[] {
  return bullets
    .map((bullet) => {
      const marks = buildBulletMarks(bullet);
      return { bullet, marks, tone: insightTone(marks) };
    })
    .filter((insight) => insight.marks.length > 0)
    .sort((a, b) => {
      if (a.marks.length !== b.marks.length) return b.marks.length - a.marks.length;
      return a.bullet.position - b.bullet.position;
    });
}

/** Counts per mark kind, for the summary line above the ledger. */
export function summarizeMarks(insights: BulletInsight[]): Record<BulletMark["kind"], number> {
  const counts: Record<BulletMark["kind"], number> = {
    "too-long": 0,
    "too-short": 0,
    "weak-phrase": 0,
    "first-person": 0,
    "no-action-verb": 0,
    "no-outcome": 0,
  };
  for (const insight of insights) {
    for (const mark of insight.marks) counts[mark.kind] += 1;
  }
  return counts;
}