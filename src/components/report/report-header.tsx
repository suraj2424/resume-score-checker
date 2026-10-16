import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreFigure, ScoreScale } from "./score-scale";
import { bandTone } from "@/components/ui/tones";
import { TONE_DOT } from "@/components/ui/badge";
import type { ScoreReport } from "@/lib/resume/types";

/**
 * The masthead of the report: the measured value, the scale it was read
 * against, and the two figures that matter alongside it. Laid out as a printed
 * block header — a rule under the document name, then the reading.
 */
export function ReportHeader({
  report,
  onCheckAnother,
  onClearReport,
  actions,
}: {
  report: ScoreReport;
  onCheckAnother: () => void;
  onClearReport: () => void;
  actions: React.ReactNode;
}) {
  const criticalCount = report.criticalIssues.length;
  const tone = bandTone(report.scoreBand.id);

  return (
    <div className="slab print-flat">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule px-5 py-3 sm:px-7">
        <p className="figure truncate text-ink-2">{report.fileName}</p>
        <p className="figure text-ink-3">
          version {report.scoringVersion} · {report.coverage.checksEvaluated} of{" "}
          {report.coverage.checksTotal} checks examined
        </p>
      </div>

      <div className="grid gap-8 px-5 py-7 sm:px-7 lg:grid-cols-[minmax(0,17rem)_1fr] lg:gap-12">
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
          <h1 className="max-w-[36ch] text-balance text-[1.375rem] font-semibold leading-snug tracking-[-0.022em] text-ink sm:text-[1.625rem]">
            {report.scoreBand.summary}
          </h1>

          {report.coverage.warnings.length > 0 ? (
            <div className="flex flex-col gap-2.5 border-t border-rule pt-4">
              <p className="label">Set aside from the score</p>
              <ul className="flex flex-col gap-2">
                {report.coverage.warnings.map((warning) => (
                  <li
                    key={warning}
                    className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-2"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-[0.55em] size-1.5 shrink-0 rounded-full ${TONE_DOT.note}`}
                    />
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="no-print flex flex-wrap items-center gap-2 border-t border-rule pt-4">
            {actions}
            <Button type="button" variant="quiet" size="sm" onClick={onCheckAnother}>
              Check another resume
            </Button>
            <Button type="button" variant="quiet" size="sm" onClick={onClearReport}>
              Clear report
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}