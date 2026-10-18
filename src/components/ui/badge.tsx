import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * The five tones. Each one stands for a real value in the report — a check
 * status, a severity, a score band, a parsing note — and always travels with
 * the word it stands for, so colour never carries meaning on its own.
 *
 * There is deliberately no "brand" tone: ink means act, colour means a result.
 *
 * This file owns the tone → CSS side of that rule; `tones.ts` owns the domain →
 * tone side, and it is the only place a domain value becomes a tone. The maps
 * here are exported so a wash or a foreground can be reached for without a
 * second copy being written next to the component that wanted one.
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

/** The foreground for a tone, in one place so `badgeVariants` and every
 *  consumer of `TONE_TEXT` cannot disagree. */
export const TONE_TEXT: Record<Tone, string> = {
  pass: "text-pass",
  caution: "text-caution",
  issue: "text-issue",
  note: "text-note",
  mute: "text-mute",
};

/** The tinted ground a wash sits on. A tone never appears without its word. */
export const TONE_WASH: Record<Tone, string> = {
  pass: "bg-pass-wash",
  caution: "bg-caution-wash",
  issue: "bg-issue-wash",
  note: "bg-note-wash",
  mute: "bg-mute-wash",
};

const badgeVariants = cva(
  // `min-w-0` so a `whitespace-nowrap` marker can be shrunk by its flex parent
  // instead of forcing the container wider than its column. 13px is the floor
  // for this font everywhere in the system; a badge is a label, not a caption.
  "inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-[3px] text-[13px] font-medium",
  {
    variants: {
      tone: {
        plain: "text-ink-2",
        pass: TONE_TEXT.pass,
        caution: TONE_TEXT.caution,
        issue: TONE_TEXT.issue,
        note: TONE_TEXT.note,
        mute: TONE_TEXT.mute,
      },
      /** `wash` puts the marker on its own tinted ground — for a stronger
       *  signal in a dense list. `plain` leaves it inline. */
      surface: {
        plain: "",
        wash: "px-2 py-1",
      },
      size: {
        /*
          `sm` existed at 11px. Its only two call sites
          (`report/detailed-checks.tsx`) sat on a plain surface rather than a
          wash, so the exemption for keeping it small never applied — 11px is
          below any reasonable floor for non-incidental text. It is now 13px and
          therefore identical to `default`; the variant exists only so a caller
          that still asks for it compiles. Delete the key once no call site does.
        */
        sm: "text-[13px]",
        default: "text-[13px]",
      },
    },
    defaultVariants: {
      tone: "plain",
      surface: "plain",
      size: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Hide the leading dot for plain text markers. */
  dot?: boolean;
}

export function Badge({
  className,
  tone,
  surface,
  size,
  dot = true,
  children,
  ...props
}: BadgeProps) {
  // `plain` is the absence of a tone, not a sixth tone: no dot colour, no wash,
  // and it falls back to the mute ink rather than to nothing.
  const resolved: Tone = tone && tone !== "plain" ? tone : "mute";
  return (
    <span
      data-slot="badge"
      className={cn(
        badgeVariants({ tone, surface, size }),
        surface === "wash" && TONE_WASH[resolved],
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[resolved])} /> : null}
      {children}
    </span>
  );
}

export { badgeVariants };