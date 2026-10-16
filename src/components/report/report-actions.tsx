"use client";

import * as React from "react";
import { Check, Copy, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildReportSummary } from "@/lib/resume/report-summary";
import type { ParsedResume, ScoreReport } from "@/lib/resume/types";

/** Copy the summary to the clipboard, with a graceful fallback. */
export function useCopySummary(report: ScoreReport, resume: ParsedResume) {
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle");

  const copy = React.useCallback(async () => {
    const text = buildReportSummary(report, resume);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setState("copied");
        return;
      }
      // Fallback for browsers without the async clipboard API.
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      setState(ok ? "copied" : "failed");
    } catch {
      setState("failed");
    }
  }, [report, resume]);

  React.useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 4000);
    return () => clearTimeout(timer);
  }, [state]);

  return { state, copy };
}

/**
 * Output actions for the report: copy a plain-text summary, and print. The
 * navigation actions live in `ReportHeader` and are not duplicated here.
 */
export function ReportActions({
  report,
  resume,
}: {
  report: ScoreReport;
  resume: ParsedResume;
}) {
  const { state, copy } = useCopySummary(report, resume);

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={copy}>
        {state === "copied" ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        {state === "copied"
          ? "Summary copied"
          : state === "failed"
            ? "Copy failed. Select and copy manually."
            : "Copy summary"}
      </Button>

      <Button type="button" variant="quiet" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" aria-hidden="true" />
        Print report
      </Button>

      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? "Report summary copied to clipboard" : ""}
      </span>
    </div>
  );
}