import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * A section head is a rule, a heading, and at most one sentence of support.
 * There is no tracked-out label above the heading and no section number: on a
 * printed page the heading and its position in the document are enough.
 *
 * There is no `size`, `align` or `as` prop. The `h2` rule in `globals.css` is
 * the scale now — this component overrode it with its own clamp at eight call
 * sites, which meant the `size="hero"`/`size="compact"` pair only ever
 * described a difference the scale already made, and nothing could reach for
 * `align="center"` without also inventing a third centre-aligned heading.
 */
export function SectionHeading({
  label,
  title,
  description,
  className,
}: {
  /** Optional sentence-case signpost. Not an eyebrow: no caps, no tracking. */
  label?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="section-heading" className={cn("flex flex-col gap-3", className)}>
      {label ? <p className="label">{label}</p> : null}
      {/* The lede measure: one supporting sentence under a heading. */}
      <h2 className="text-ink">{title}</h2>
      {description ? (
        <p className="max-w-[58ch] text-[15px] leading-relaxed text-ink-2">{description}</p>
      ) : null}
    </div>
  );
}