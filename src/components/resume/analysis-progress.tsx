"use client";

import { Check, Loader2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";

const STEPS = [
  { id: "reading", label: "Reading the file" },
  { id: "extracting", label: "Extracting text" },
  { id: "checking", label: "Running the checks" },
  { id: "report", label: "Preparing the report" },
] as const;

export type ProgressStepId = (typeof STEPS)[number]["id"];

function stepIndex(id: ProgressStepId): number {
  return STEPS.findIndex((step) => step.id === id);
}

/**
 * Named steps so the wait is legible. Resolves to results or an error — there
 * is no indefinite spinner.
 */
export function AnalysisProgress({
  activeStep,
  fileName,
  className,
}: {
  activeStep: ProgressStepId;
  fileName: string;
  className?: string;
}) {
  const activeIndex = stepIndex(activeStep);

  return (
    <div className={cn("flex flex-col gap-5 border border-rule bg-sheet-tint p-5 sm:p-6", className)}>
      <div className="flex items-center gap-3">
        <Spinner label="Analysis in progress" />
        <div className="flex flex-col gap-0.5">
          <p className="text-[15px] font-semibold text-ink">
            {activeStep === "checking" ? "Running resume checks" : "Analyzing your resume"}
          </p>
          <p className="figure truncate text-ink-3">{fileName}</p>
        </div>
      </div>

      <ol className="flex flex-col border-t border-rule">
        {STEPS.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li
              key={step.id}
              className="flex items-center gap-3 border-b border-rule py-2.5 last:border-b-0"
            >
              {done ? (
                <Check className="size-4 shrink-0 text-pass" aria-hidden="true" />
              ) : active ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-ink" aria-hidden="true" />
              ) : (
                <span aria-hidden="true" className="size-3.5 shrink-0 border border-rule-2" />
              )}
              <span className={done || active ? "text-[14px] font-medium text-ink" : "text-[14px] text-ink-3"}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}