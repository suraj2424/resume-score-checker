import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";
import { TONE_RULE, type Tone } from "./badge";

/**
 * A note set into the page. The status is a 2px rule down the left edge — the
 * mark a reviewer makes in the margin — not an icon in a coloured box.
 */
const alertVariants = cva(
  "border border-rule border-l-2 px-5 py-4 text-[14px]",
  {
    variants: {
      tone: {
        mute: TONE_RULE.mute,
        pass: TONE_RULE.pass,
        caution: TONE_RULE.caution,
        issue: TONE_RULE.issue,
        note: TONE_RULE.note,
      },
      surface: {
        plain: "bg-sheet",
        wash: "bg-sheet-tint",
      },
    },
    defaultVariants: {
      tone: "mute",
      surface: "plain",
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

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, tone = "mute", surface = "plain", children, ...props }: AlertProps) {
  return (
    <div
      role={tone === "issue" ? "alert" : undefined}
      className={cn(alertVariants({ tone, surface }), surface === "wash" && WASH[tone ?? "mute"], className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("font-semibold leading-snug text-ink", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-1.5 flex flex-col gap-2 leading-relaxed text-ink-2", className)} {...props} />
  );
}

Alert.Title = AlertTitle;
Alert.Description = AlertDescription;

export { alertVariants };