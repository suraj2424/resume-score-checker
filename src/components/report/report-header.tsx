import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge, TONE_DOT } from "@/components/ui/badge";
import { ScoreFigure, ScoreScale } from "./score-scale";
import { bandTone } from "@/components/ui/tones";
import { cn } from "@/lib/utils/cn";
import type { ScoreReport } from "@/lib/resume/types";

/**
 * The masthead of the report: the measured value, the scale it was read
 * against, and the two figures that matter alongside it. Laid out as a printed
 * block header — a rule under the document name, then the reading.
 *
 * The document-level action ("check another") lives here; the report's output
 * actions are passed in and belong to the rail.
 */
export function ReportHeader({
  report,
  onCheckAnother,
  actions,
}: {
  report: ScoreReport;
  onCheckAnother: () => void;
  actions?: React.ReactNode;
}) {
  const criticalCount = report.criticalIssues.length;
  const tone = bandTone(report.scoreBand.id);

  return (
    <div className="slab print-flat">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule px-5 py-3 sm:px-7">
        {/*
          The name is user-supplied and routinely long, and it is the one PII
          string the report shows on purpose. `truncate` keeps a long one from
          pushing the version off the row; `title` keeps it reachable on hover,
          because a truncated file name is no identification at all.
        */}
        <p className="figure min-w-0 truncate text-ink-2" title={report.fileName}>
          {report.fileName}
        </p>
        <p className="figure shrink-0 text-ink-3">
          version {report.scoringVersion} · {report.coverage.checksEvaluated} of{" "}
          {report.coverage.checksTotal} checks examined
        </p>
      </div>

      {/* The rail takes 17rem of the page, so this only has two columns once the
          viewport is wide enough for the report to still have a reading measure. */}
      <div className="grid gap-8 px-5 py-7 sm:px-7 xl:grid-cols-[minmax(0,17rem)_1fr] xl:gap-12">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <p className="label">Resume score</p>
            <ScoreFigure value={report.score} size="md" />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Badge tone={tone} surface="wash">
                {report.scoreBand.label}
              </Badge>
              {criticalCount > 0 ? (
                <Badge tone="issue">
                  {criticalCount} critical {criticalCount === 1 ? "mark" : "marks"}
                </Badge>
              ) : (
                <Badge tone="pass">No critical marks</Badge>
              )}
            </div>
          </div>

          <ScoreScale value={report.score} band={report.scoreBand.id} size="sm" />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {/*
            A stable noun phrase, not the band sentence. Heading navigation is
            how a screen-reader user finds their place, and an `<h1>` that reads
            "A solid resume overall. The priority fixes below…" identifies
            nothing — it also left `<title>` on the page disagreeing with it.
          */}
          <h1 className="sr-only">Resume score report</h1>
          <p className="max-w-[36ch] text-balance text-[1.375rem] font-semibold leading-snug tracking-[-0.022em] text-ink sm:text-[1.625rem]">
            {report.scoreBand.summary}
          </p>

          {report.coverage.warnings.length > 0 ? (
            <div className="flex flex-col gap-2.5 border-t border-rule pt-4">
              <p className="label">Left out of the score</p>
              <ul className="flex flex-col gap-2">
                {report.coverage.warnings.map((warning) => (
                  <li
                    key={warning}
                    className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-2"
                  >
                    <span aria-hidden="true" className={cn("mt-[0.55em] size-1.5 shrink-0 rounded-full", TONE_DOT.note)} />
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div
            className={cn(
              "no-print flex flex-wrap items-center gap-2",
              actions && "border-t border-rule pt-4",
            )}
          >
            {actions}
            <Button type="button" variant="quiet" size="sm" onClick={onCheckAnother}>
              Check another resume
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}