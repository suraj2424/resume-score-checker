import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * The five tones. Each one stands for a real value in the report — a check
 * status, a severity, a score band, a parsing note — and always travels with
 * the word it stands for, so colour never carries meaning on its own.
 *
 * There is deliberately no "brand" tone: ink means act, colour means a result.
 */
export type Tone = "pass" | "caution" | "issue" | "note" | "mute";

export const TONE_DOT: Record<Tone, string> = {
  pass: "bg-pass",
  caution: "bg-caution",
  issue: "bg-issue",
  note: "bg-note",
  mute: "bg-mute",
};

export const TONE_RULE: Record<Tone, string> = {
  pass: "border-l-pass",
  caution: "border-l-caution",
  issue: "border-l-issue",
  note: "border-l-note",
  mute: "border-l-mute",
};

export const TONE_BAR: Record<Tone, string> = {
  pass: "bg-pass",
  caution: "bg-caution",
  issue: "bg-issue",
  note: "bg-note",
  mute: "bg-mute",
};

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium",
  {
    variants: {
      tone: {
        plain: "text-ink-2",
        pass: "text-pass",
        caution: "text-caution",
        issue: "text-issue",
        note: "text-note",
        mute: "text-mute",
      },
      /** `wash` puts the marker on its own tinted ground — for a stronger
       *  signal in a dense list. `plain` leaves it inline. */
      surface: {
        plain: "",
        wash: "px-2 py-1",
      },
      size: {
        sm: "text-[11px]",
        default: "text-[12px]",
      },
    },
    defaultVariants: {
      tone: "plain",
      surface: "plain",
      size: "default",
    },
  },
);

const WASH: Record<Tone, string> = {
  pass: "bg-pass-wash",
  caution: "bg-caution-wash",
  issue: "bg-issue-wash",
  note: "bg-note-wash",
  mute: "bg-mute-wash",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  tone?: Tone | "plain";
  /** Hide the leading dot for plain text markers. */
  dot?: boolean;
}

export function Badge({
  className,
  tone = "plain",
  surface = "plain",
  size,
  dot = true,
  children,
  ...props
}: BadgeProps) {
  const key = (tone === "plain" ? "mute" : tone) as Tone;
  return (
    <span
      className={cn(
        badgeVariants({ tone, surface, size }),
        surface === "wash" && WASH[key],
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[key])} /> : null}
      {children}
    </span>
  );
}

export { badgeVariants };