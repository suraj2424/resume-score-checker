import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";
import { TONE_RULE, TONE_WASH, type Tone } from "./badge";

/**
 * A note set into the page. The status is a 2px rule down the left edge — the
 * mark a reviewer makes in the margin — not an icon in a coloured box.
 *
 * `rounded-[3px]` is `--radius-md`. The alert is one of five bordered
 * containers that were left square while the rest of the system took the
 * paper's 2px corner, which is an unstated exception to a documented rule.
 */
const alertVariants = cva(
  "rounded-[3px] border border-rule border-l-2 px-5 py-4 text-[14px]",
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

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, tone, surface, role, children, ...props }: AlertProps) {
  const resolved: Tone = tone ?? "mute";
  return (
    <div
      data-slot="alert"
      // Set by the caller, not derived from tone. Deriving it from tone left the
      // `no-text-extracted` failure — which renders `caution` — with no role at
      // all, so the one failure a user most needs to hear about was announced to
      // nobody. The static prose alerts on the legal and methodology pages pass
      // nothing, because `role="alert"` on content that was already on screen
      // signals a dynamic update that did not happen.
      role={role}
      className={cn(
        alertVariants({ tone, surface }),
        surface === "wash" && TONE_WASH[resolved],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p data-slot="alert-title" className={cn("font-semibold leading-snug text-ink", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="alert-description"
      className={cn("mt-1.5 flex flex-col gap-2 leading-relaxed text-ink-2", className)}
      {...props}
    />
  );
}

export { alertVariants };