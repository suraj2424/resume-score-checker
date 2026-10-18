"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import {
  collectBulletInsights,
  summarizeMarks,
  type BulletInsight,
} from "@/lib/resume/bullet-insights";
import { overlapsRedaction, redactContact } from "@/lib/resume/redact";
import { bulletMarkClass } from "@/components/ui/tones";
import type { BulletMark, ResumeBullet } from "@/lib/resume/types";

/**
 * The marked-up proof ledger.
 *
 * Each flagged bullet is set as running text with the offending words marked
 * inline — the way a marked-up page reads — plus a rule in the bullet's tone and
 * a ruled annotation column giving the measured fact and the fix.
 *
 * Text is built from sliced strings, never from innerHTML, and contact details
 * are redacted before anything is rendered, so the report keeps the promise on
 * the privacy page that it never displays an address, number or link. That
 * redaction stays even though the score engine now redacts evidence centrally:
 * this component is the one that renders whole bullet lines, and it is the last
 * thing between the raw text and the page.
 */

/** The summary line, in the order a reader should act on them. */
const MARK_ORDER: Array<{ kind: BulletMark["kind"]; noun: string }> = [
  { kind: "weak-phrase", noun: "filler phrasing" },
  { kind: "no-action-verb", noun: "with no action verb" },
  { kind: "no-outcome", noun: "with no outcome" },
  { kind: "too-long", noun: "too long" },
  { kind: "too-short", noun: "too thin" },
  { kind: "first-person", noun: "in the first person" },
];

/**
 * How many annotated marks are open on a bullet before the rest are folded.
 *
 * Screen-only. Nothing is dropped: `bullet-insights` returns every mark, and
 * the ones past this count are rendered with `hidden print:block`, so the
 * printed page annotates every mark the screen folds away.
 */
const OPEN_MARKS = 3;

/**
 * Bullets shown before the "show more" affordance. Same rule as the marks above
 * — all of them are in the DOM, the overflow is hidden on screen and restored
 * by the print stylesheet. A `slice` here plus a `no-print` reveal button meant
 * the seventh bullet could never reach paper.
 */
const PAGE = 6;

interface Piece {
  text: string;
  mark?: BulletMark;
}

/**
 * Slice the bullet into plain and marked pieces. Offsets are translated through
 * the redaction map, and any mark that lands inside a redaction is dropped
 * rather than drawn in the wrong place.
 */
function toPieces(bullet: ResumeBullet, marks: BulletMark[]): Piece[] {
  const { text, spans, map } = redactContact(bullet.text);

  // Whole-bullet marks carry no inline span to draw.
  const inline = marks.filter(
    (mark) => !(mark.start === 0 && mark.end >= bullet.text.length),
  );

  const drawn = inline
    .map((mark) => {
      const start = map(mark.start);
      const end = map(mark.end);
      if (end <= start || overlapsRedaction(spans, start, end)) return null;
      return { start, end, mark };
    })
    .filter((entry): entry is { start: number; end: number; mark: BulletMark } => entry !== null)
    .sort((a, b) => a.start - b.start);

  const pieces: Piece[] = [];
  let cursor = 0;
  for (const entry of drawn) {
    if (entry.start < cursor) continue; // overlapping mark, keep the first
    if (entry.start > cursor) pieces.push({ text: text.slice(cursor, entry.start) });
    pieces.push({ text: text.slice(entry.start, entry.end), mark: entry.mark });
    cursor = entry.end;
  }
  if (cursor < text.length) pieces.push({ text: text.slice(cursor) });
  return pieces.length > 0 ? pieces : [{ text }];
}

function markKey(bullet: ResumeBullet, mark: BulletMark): string {
  return `bullet-${bullet.position}-${mark.kind}-${mark.start}-${mark.end}`;
}

function MarkedBullet({ insight, hiddenRow }: { insight: BulletInsight; hiddenRow: boolean }) {
  const { bullet, marks, tone } = insight;
  const pieces = React.useMemo(() => toPieces(bullet, marks), [bullet, marks]);
  const [showAllMarks, setShowAllMarks] = React.useState(false);
  const folded = marks.length - OPEN_MARKS;

  return (
    <li
      className={cn(
        "grid gap-x-8 gap-y-3 border-t border-rule py-6 lg:grid-cols-[minmax(0,1fr)_17rem]",
        hiddenRow && "hidden print:block",
      )}
    >
      <div className="min-w-0">
        <p className="figure mb-2 text-ink-3">
          Bullet {bullet.position}
          {bullet.section ? ` · ${bullet.section}` : ""} · {bullet.wordCount} words
        </p>
        <p className="max-w-[58ch] text-[15px] leading-[1.7] text-ink-2">
          {pieces.map((piece, index) =>
            piece.mark ? (
              /*
                `aria-describedby` onto the annotation rather than `title`:
                a native tooltip is unreachable by keyboard and invisible to a
                screen reader, so the only channel it opened was the Badge in the
                next column — which is a sighted affordance the mark itself never
                referenced. The description is the same text a mouse reader saw.
              */
              <mark
                key={index}
                aria-describedby={markKey(bullet, piece.mark)}
                className={cn("rounded-[2px] px-0.5 py-px", bulletMarkClass(piece.mark.kind))}
              >
                {piece.text}
              </mark>
            ) : (
              <span key={index}>{piece.text}</span>
            ),
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:border-l lg:border-rule lg:pl-5">
        {marks.map((mark, index) => {
          const hidden = !showAllMarks && index >= OPEN_MARKS;
          return (
            <div
              key={markKey(bullet, mark)}
              id={markKey(bullet, mark)}
              className={cn("flex flex-col gap-1", hidden && "hidden print:block")}
            >
              <Badge tone={tone}>{mark.label}</Badge>
              {mark.detail ? <p className="figure text-ink-3">{mark.detail}</p> : null}
              {mark.fix ? (
                <p className="text-[13px] leading-relaxed text-ink-2">{mark.fix}</p>
              ) : null}
            </div>
          );
        })}

        {folded > 0 && !showAllMarks ? (
          <button
            type="button"
            className="no-print self-start text-left text-[13px] font-medium text-ink-2 underline decoration-rule-2 underline-offset-4 hover:text-ink"
            onClick={() => setShowAllMarks(true)}
          >
            {folded} more {folded === 1 ? "mark" : "marks"} on this line
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function MarkedUpBullets({ bullets }: { bullets: ResumeBullet[] }) {
  const [limit, setLimit] = React.useState(PAGE);
  const insights = React.useMemo(() => collectBulletInsights(bullets), [bullets]);

  if (bullets.length === 0) {
    return (
      <p className="text-[15px] leading-relaxed text-ink-2">
        No bullet points were detected in this document, so there is nothing to mark up. Write your
        achievements as short bullets, one idea each, and the report will show you exactly where
        each one falls short.
      </p>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="flex flex-col gap-2 border-l-2 border-l-pass bg-pass-wash px-5 py-4">
        <p className="text-[15px] font-semibold text-ink">
          All {bullets.length} bullets hold up
        </p>
        <p className="max-w-[58ch] text-[14px] leading-relaxed text-ink-2">
          Each one starts with a verb, carries an outcome and stays short enough to scan. Nothing to
          change here.
        </p>
      </div>
    );
  }

  const counts = summarizeMarks(insights);
  // A sentence, not a dot-joined meta string.
  const summary = MARK_ORDER.filter((entry) => counts[entry.kind] > 0)
    .map((entry) => `${counts[entry.kind]} ${entry.noun}`)
    .join(", ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 border-b border-rule pb-5">
        <p className="text-[15px] font-semibold text-ink">
          {insights.length} of {bullets.length} bullets need work
        </p>
        <p className="max-w-[62ch] text-[14px] leading-relaxed text-ink-2">
          Across those lines: {summary}.
        </p>
      </div>

      <ul className="flex flex-col">
        {insights.map((insight, index) => (
          <MarkedBullet
            key={insight.bullet.position}
            insight={insight}
            hiddenRow={index >= limit}
          />
        ))}
      </ul>

      {insights.length > limit ? (
        <Button
          type="button"
          variant="quiet"
          size="sm"
          className="no-print self-start"
          onClick={() => setLimit((value) => value + PAGE)}
        >
          Show {Math.min(PAGE, insights.length - limit)} more of {insights.length}
        </Button>
      ) : null}
    </div>
  );
}