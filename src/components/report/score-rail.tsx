"use client";

import * as React from "react";
import { Badge, TONE_DOT, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bandTone } from "@/components/ui/tones";
import { SCORE_BANDS, type ScoreBandId } from "@/config/scoring";
import { cn } from "@/lib/utils/cn";
import type { ParsedResume, ScoreReport } from "@/lib/resume/types";
import { ReportActions } from "./report-actions";
import { ScoreFigure } from "./score-scale";

/**
 * The report's only navigation.
 *
 * Six `id=`-bearing sections and, before this, nothing that pointed at any of
 * them except one "Inspect" button per category. The rail is what makes the
 * report navigable: a persistent score so the reading survives a scroll, a
 * ladder so the number can be placed, five counts, the output actions that used
 * to be a scroll away, and a live list of the sections themselves.
 *
 * It is also a second filter control for the check list. Clicking a category
 * does three things in one action — filter, scroll, move focus — because the
 * old `inspect()` only scrolled, which left keyboard and screen-reader users
 * parked at an empty position about a screen below where focus still was.
 */

/**
 * The one list of sections. `report-view.tsx` renders its sections from this and
 * the rail links to them, so a section cannot exist without being navigable and
 * a link cannot point at a heading that was renamed.
 */
export const REPORT_SECTIONS = [
  { id: "score-summary", title: "Score and band", short: "Score" },
  { id: "score-breakdown", title: "Where the points come from", short: "Breakdown" },
  { id: "priority-fixes", title: "What to improve first", short: "Fixes" },
  { id: "marked-up-bullets", title: "Your bullets, marked up", short: "Bullets" },
  { id: "detailed-checks", title: "Every check, with its evidence", short: "All checks" },
  { id: "content-snapshot", title: "What was detected", short: "Detected" },
] as const;

/** Matches `scroll-padding-top` on `html` plus `scroll-mt-24` on each section. */
const STICKY_OFFSET_PX = 96;

/**
 * Move the viewport and the focus together.
 *
 * Focusing without `preventScroll` fights the scroll that follows it; scrolling
 * without focusing is the bug this replaces. Reduced motion turns the animation
 * off — the global rule kills the CSS `scroll-behavior`, but an explicit
 * `behavior: "smooth"` opts back in and ignores it.
 */
export function scrollToReportSection(sectionId: string): void {
  const target = document.getElementById(sectionId);
  if (!target) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

/** Which section the reader is looking at, so the nav can mark it. */
function useCurrentSection(ids: readonly string[]): string | null {
  const [current, setCurrent] = React.useState<string | null>(ids[0] ?? null);

  React.useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      // The last section whose top has passed the masthead is the one being read.
      // A scroll listener beats IntersectionObserver here because the answer
      // depends on an offset the observer cannot be told about.
      let active = ids[0] ?? null;
      for (const id of ids) {
        const element = document.getElementById(id);
        if (!element) continue;
        if (element.getBoundingClientRect().top - STICKY_OFFSET_PX <= 0) active = id;
      }
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
        active = ids[ids.length - 1] ?? active;
      }
      setCurrent((previous) => (previous === active ? previous : active));
    };

    const schedule = () => {
      if (frame) return;
      // jsdom has no `requestAnimationFrame` by default, and the effect runs on
      // mount in every render test of the report.
      if (typeof window.requestAnimationFrame !== "function") {
        measure();
        return;
      }
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ids]);

  return current;
}

interface RailCounts {
  evaluated: number;
  total: number;
  fixes: number;
  issues: number;
  notApplicable: number;
  unableToVerify: number;
}

function railCounts(report: ScoreReport): RailCounts {
  return {
    evaluated: report.coverage.checksEvaluated,
    total: report.coverage.checksTotal,
    fixes: report.recommendations.length,
    issues: report.results.filter((result) => result.status === "issue").length,
    notApplicable: report.coverage.notApplicable,
    unableToVerify: report.coverage.unableToVerify,
  };
}

/**
 * Five counts, not four.
 *
 * "Set aside" used to be one number meaning two opposite things — a check that
 * had nothing to look at, and a check the extracted text would not support. They
 * are split here for the same reason they are split in the engine: "we did not
 * need to look" is not a finding, and reading it as one is how a resume with no
 * summary section gets told its extraction failed.
 */
function Counts({ report, className }: { report: ScoreReport; className?: string }) {
  const counts = railCounts(report);
  const rows: Array<{ label: string; value: string; tone?: Tone }> = [
    { label: "Checks examined", value: `${counts.evaluated} of ${counts.total}` },
    { label: "Fixes to make", value: String(counts.fixes) },
    { label: "Issues found", value: String(counts.issues), tone: "issue" },
    { label: "Did not apply", value: String(counts.notApplicable), tone: "mute" },
    { label: "Could not be evaluated", value: String(counts.unableToVerify), tone: "note" },
  ];

  return (
    <dl className={cn("flex flex-col", className)}>
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-3 border-t border-rule py-2"
        >
          <dt className="label flex items-center gap-1.5">
            {row.tone ? (
              <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[row.tone])} />
            ) : null}
            {row.label}
          </dt>
          <dd className="figure text-ink">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The band ladder, vertical.
 *
 * The landing page draws the same bands horizontally across a full column width;
 * five labels side by side inside 17rem is five unreadable fragments. Stacked,
 * each band is a legible row and the current one is the only coloured thing —
 * colour marks a result, and "which band am I in" is the one result here.
 */
function BandLadder({ band }: { band: ScoreBandId }) {
  const ordered = [...SCORE_BANDS].sort((a, b) => a.min - b.min);
  const currentTone = bandTone(band);

  return (
    <ol className="flex flex-col">
      {ordered.map((entry, index) => {
        const isCurrent = entry.id === band;
        const upper = index === ordered.length - 1 ? 100 : ordered[index + 1]!.min - 1;
        return (
          <li
            key={entry.id}
            aria-current={isCurrent ? "true" : undefined}
            className={cn(
              "flex items-center justify-between gap-3 border-l-2 border-l-transparent py-1.5 pl-2",
              isCurrent ? "border-l-ink" : "border-l-transparent",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  isCurrent ? TONE_DOT[currentTone] : "bg-rule-2",
                )}
              />
              <span
                className={cn(
                  "truncate text-[12px]",
                  isCurrent ? "font-semibold text-ink" : "text-ink-3",
                )}
              >
                {entry.label}
              </span>
              {isCurrent ? <span className="sr-only">— your band</span> : null}
            </span>
            <span className="figure shrink-0 text-ink-3">
              {entry.min}–{upper}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function SectionNav({ current }: { current: string | null }) {
  return (
    <nav aria-label="Report sections">
      <ol className="flex flex-col">
        {REPORT_SECTIONS.map((section) => {
          const isCurrent = section.id === current;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={isCurrent ? "true" : undefined}
                className={cn(
                  "flex items-center gap-2 border-l-2 border-l-transparent py-1.5 pl-2 text-[13px] transition-colors",
                  isCurrent
                    ? "border-l-ink font-semibold text-ink"
                    : "text-ink-2 hover:border-l-rule-2 hover:text-ink",
                )}
              >
                <span aria-hidden="true" className="text-ink-3">
                  ›
                </span>
                {section.short}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The category filter, which is also the rail's second job.
 *
 * Buttons, not anchors: nothing is navigated to and nothing belongs in the back
 * stack, so `<a>` would claim a destination that does not exist. `aria-pressed`
 * exposes the state as what it is — a toggle — where `aria-current` on an anchor
 * would claim a position inside a set of links.
 */
function CategoryFilter({
  report,
  activeCategoryId,
  onInspectCategory,
}: {
  report: ScoreReport;
  activeCategoryId: string | null;
  onInspectCategory: (categoryId: string | null) => void;
}) {
  return (
    <div role="group" aria-label="Filter checks by category" className="flex flex-col gap-1.5">
      <p className="label border-b border-rule pb-1.5">Filter the check list</p>
      <ul className="flex flex-col">
        {report.categories.map((category) => {
          const isActive = activeCategoryId === category.id;
          const scored = category.possible > 0;
          return (
            <li key={category.id}>
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => onInspectCategory(isActive ? null : category.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 border-l-2 border-l-transparent py-1.5 pl-2 text-left text-[13px] transition-colors",
                  isActive
                    ? "border-l-ink font-semibold text-ink"
                    : "text-ink-2 hover:border-l-rule-2 hover:text-ink",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className="text-ink-3">
                    {isActive ? "▪" : "·"}
                  </span>
                  <span className="truncate">{category.name}</span>
                  <span className="sr-only"> — show only these checks</span>
                </span>
                <span className="figure shrink-0 text-ink-3">
                  {scored ? `${category.earned}/${category.possible}` : "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface ScoreRailProps {
  report: ScoreReport;
  resume: ParsedResume;
  onClearReport: () => void;
  activeCategoryId: string | null;
  onInspectCategory: (categoryId: string | null) => void;
}

/**
 * The desktop rail. Sized and stuck by its parent grid — `17rem` wide,
 * `lg:sticky lg:top-24 lg:self-start`, so it never stretches to the length of
 * the column it sits beside.
 */
export function ScoreRail({
  report,
  resume,
  onClearReport,
  activeCategoryId,
  onInspectCategory,
}: ScoreRailProps) {
  const sectionIds = React.useMemo(() => REPORT_SECTIONS.map((section) => section.id), []);
  const current = useCurrentSection(sectionIds);
  const tone = bandTone(report.scoreBand.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="label">Resume score</p>
        <ScoreFigure value={report.score} size="sm" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge tone={tone} surface="wash">
            {report.scoreBand.label}
          </Badge>
          <span className="figure text-ink-3">v{report.scoringVersion}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="label border-b border-rule pb-2">Band ladder</p>
        <BandLadder band={report.scoreBand.id} />
      </div>

      <Counts report={report} className="border-b border-rule pb-1" />

      <div className="flex flex-col gap-2">
        <p className="label border-b border-rule pb-2">On this page</p>
        <SectionNav current={current} />
      </div>

      <CategoryFilter
        report={report}
        activeCategoryId={activeCategoryId}
        onInspectCategory={onInspectCategory}
      />

      <div className="no-print flex flex-col gap-2 border-t border-rule pt-4">
        <ReportActions report={report} resume={resume} />
        <Button type="button" variant="quiet" size="sm" onClick={onClearReport}>
          Clear report
        </Button>
      </div>
    </div>
  );
}

/**
 * The mobile rail: a sticky bar, because a 17rem column cannot survive 375px.
 *
 * A 17rem sidebar at 320px leaves the report 120px wide; a bottom bar keeps the
 * score and the fixes count on screen at any width and hands navigation to a
 * `<details>` that is only open when asked for. `main` already reserves
 * `pb-16`, which clears the bar, so nothing has to guess at its height.
 *
 * No transition of its own, so the global `prefers-reduced-motion` rule covers
 * it — the only motion on this path is the anchor scroll, which
 * `scrollToReportSection` handles.
 */
export function MobileReportBar({
  report,
  activeCategoryId,
  onInspectCategory,
}: {
  report: ScoreReport;
  activeCategoryId: string | null;
  onInspectCategory: (categoryId: string | null) => void;
}) {
  const counts = railCounts(report);
  const tone = bandTone(report.scoreBand.id);

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-sheet/95 backdrop-blur-sm lg:hidden">
      <details data-report-nav>
        <summary className="flex items-center justify-between gap-3 px-5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring sm:px-8">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="figure-lg text-[1.125rem] leading-none text-ink">
              {report.score}
              <span className="text-ink-3">/100</span>
            </span>
            <Badge tone={tone}>{report.scoreBand.label}</Badge>
            <span className="figure truncate text-ink-3">
              {counts.fixes} {counts.fixes === 1 ? "fix" : "fixes"}
            </span>
          </span>
          <span className="label shrink-0">Sections</span>
        </summary>

        <nav
          aria-label="Report sections"
          className="flex flex-col border-t border-rule px-5 py-2 sm:px-8"
        >
          <ul className="flex flex-col">
            {REPORT_SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block py-2 text-[14px] text-ink-2 hover:text-ink"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
          <CategoryFilter
            report={report}
            activeCategoryId={activeCategoryId}
            onInspectCategory={(categoryId) => {
              onInspectCategory(categoryId);
              const open = document.querySelector<HTMLDetailsElement>("details[data-report-nav]");
              if (open) open.open = false;
            }}
          />
        </nav>
      </details>
    </div>
  );
}