import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { TONE_DOT, TONE_RULE, type Tone } from "./badge";

/**
 * An empty screen is an invitation to act: it says what is missing and offers
 * the next move. Left-aligned and ruled, no dashed placeholder box.
 *
 * `tone` is only for empty states that are genuinely a result — a report with
 * nothing left to fix is a pass, not an absence.
 *
 * `rounded-[3px]` is `--radius-md`, the same 2px paper corner every other
 * bordered container in the system takes.
 */
export function EmptyState({
  title,
  description,
  action,
  tone,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-start gap-3 rounded-[3px] border border-rule border-l-2 bg-sheet px-6 py-8",
        tone && TONE_RULE[tone],
        className,
      )}
    >
      <p className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        {tone ? (
          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", TONE_DOT[tone])} />
        ) : null}
        {title}
      </p>
      {description ? (
        <p className="max-w-[66ch] text-[14px] leading-relaxed text-ink-2">{description}</p>
      ) : null}
      {action}
    </div>
  );
}