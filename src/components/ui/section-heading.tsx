import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * A section head is a rule, a heading, and at most one sentence of support.
 * There is no tracked-out label above the heading and no section number: on a
 * printed page the heading and its position in the document are enough.
 */
export function SectionHeading({
  label,
  title,
  description,
  align = "left",
  as: Tag = "h2",
  size = "default",
  className,
}: {
  /** Optional sentence-case signpost. Not an eyebrow: no caps, no tracking. */
  label?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2" | "h3";
  size?: "default" | "compact" | "hero";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {label ? <p className="label">{label}</p> : null}
      <Tag
        className={cn(
          "text-ink",
          size === "hero" && "text-[2.125rem] leading-[1.04] tracking-[-0.032em] sm:text-[3rem]",
          size === "default" && "text-[1.5rem] leading-[1.12] tracking-[-0.024em] sm:text-[2rem]",
          size === "compact" && "text-xl leading-snug tracking-[-0.018em] sm:text-[1.5rem]",
        )}
      >
        {title}
      </Tag>
      {description ? (
        <p className="max-w-[58ch] text-[15px] leading-relaxed text-ink-2">{description}</p>
      ) : null}
    </div>
  );
}