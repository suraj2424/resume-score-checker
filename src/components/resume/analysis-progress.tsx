"use client";

import { Check, Loader2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";

/**
 * One entry per stage the pipeline can actually be observed in.
 *
 * The list used to open with "Reading the file", a step no caller could set:
 * the two phases the check client owns resolve straight to `extracting` and
 * `checking`. So the first row was marked done before anything had happened and
 * the last row could never be current — four rows describing three stages. The
 * dead entry is deleted rather than wired up, because emitting a real `reading`
 * phase means changing `analyzeResumeFile` to report parsing separately, and
 * that is the parser's contract rather than this list's.
 */
const STEPS = [
  { id: "extracting", label: "Extracting text" },
  { id: "checking", label: "Running the checks" },
  { id: "report", label: "Preparing the report" },
] as const;

export type ProgressStepId = (typeof STEPS)[number]["id"];

function stepIndex(id: ProgressStepId): number {
  return STEPS.findIndex((step) => step.id === id);
}

/**
 * The three icons are `aria-hidden` and weight is the only other cue, so
 * without this the list rendered three visually distinct rows that were
 * identical in the accessibility tree — a screen reader heard the same three
 * labels with nothing about which one was running.
 */
const STATE_TEXT = {
  done: "Done",
  active: "In progress",
  pending: "Not started",
} as const;

type StepState = keyof typeof STATE_TEXT;

/**
 * Named steps so the wait is legible. Resolves to results or an error — there
 * is no indefinite spinner.
 *
 * Deliberately not a live region: the check client already owns one polite
 * region that announces the phase, and a second one here would say the same
 * thing a beat later. The `sr-only` state text below is static content inside a
 * list, not an announcement — `aria-current` is what a screen reader reads on
 * the active row.
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

      <ol className="flex flex-col border-t border-rule" aria-label="Analysis stages">
        {STEPS.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          const state: StepState = done ? "done" : active ? "active" : "pending";
          return (
            <li
              key={step.id}
              aria-current={active ? "step" : undefined}
              className="flex items-center gap-3 border-b border-rule py-2.5 last:border-b-0"
            >
              {done ? (
                <Check className="size-4 shrink-0 text-pass" aria-hidden="true" />
              ) : active ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-ink" aria-hidden="true" />
              ) : (
                <span aria-hidden="true" className="size-3.5 shrink-0 border border-rule-2" />
              )}
              {/* `ink-2`, not `ink-3`: an unreachable row is still text, and
                  `ink-3` measured 3.1:1 on this tint against a 4.5:1 floor. */}
              <span className={done || active ? "text-[14px] font-medium text-ink" : "text-[14px] text-ink-2"}>
                {step.label}
              </span>
              <span className="sr-only">, {STATE_TEXT[state]}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}