"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils/cn";
import { TONE_BAR, type Tone } from "./badge";

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** Accessible label, e.g. "Structure and completeness: 16 of 20 points". */
  label?: string;
  /** The tone of the result this bar reports. Omit for a neutral measurement. */
  tone?: Tone;
  indicatorClassName?: string;
}

/**
 * Determinate bar for a category score. Ink when it is only measuring; a status
 * tone when it is reporting a verdict. Always paired with its numeric text so
 * the value is never carried by colour alone.
 */
export const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, label, tone, indicatorClassName, ...props }, ref) => {
  const clamped = Math.max(0, Math.min(100, value ?? 0));
  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={clamped}
      aria-label={label}
      className={cn("relative h-[3px] w-full overflow-hidden bg-rule", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 transition-transform",
          tone ? TONE_BAR[tone] : "bg-ink",
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = "Progress";