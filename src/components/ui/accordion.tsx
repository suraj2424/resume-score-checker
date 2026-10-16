"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Native `<details>` accordion. Chosen over a JS accordion so the content is
 * always in the DOM: it stays keyboard accessible, prints with every expanded
 * item, and works before hydration.
 */
export function AccordionItem({
  title,
  meta,
  children,
  defaultOpen = false,
  className,
  headingLevel = "h3",
}: {
  title: React.ReactNode;
  /** Points, status or other summary shown opposite the title. */
  meta?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headingLevel?: "h2" | "h3" | "h4";
}) {
  const Heading = headingLevel;
  return (
    <details
      open={defaultOpen}
      className={cn("group border-b border-rule last:border-b-0", className)}
    >
      <summary className="flex items-start gap-3 py-4 text-left outline-none transition-colors hover:text-ink focus-visible:bg-sheet-tint [&::-webkit-details-marker]:hidden">
        <ChevronDown
          className="accordion-chevron mt-0.5 size-4 shrink-0 text-ink-3"
          aria-hidden="true"
        />
        <Heading className="flex-1 text-[15px] font-semibold tracking-[-0.012em] text-ink">
          {title}
        </Heading>
        {meta ? <div className="flex shrink-0 items-center gap-3 pt-0.5">{meta}</div> : null}
      </summary>
      <div className="accordion-content pb-5 pl-7 pr-1 text-[15px] leading-relaxed text-ink-2">
        {children}
      </div>
    </details>
  );
}

/** Reveal all `<details>` elements inside a container (used when printing). */
export function openAllDetails(container: HTMLElement | null): Array<[HTMLDetailsElement, boolean]> {
  if (!container) return [];
  const items = Array.from(container.querySelectorAll<HTMLDetailsElement>("details"));
  const previous = items.map((item) => [item, item.open] as [HTMLDetailsElement, boolean]);
  for (const item of items) item.open = true;
  return previous;
}

export function restoreDetails(previous: Array<[HTMLDetailsElement, boolean]>): void {
  for (const [item, wasOpen] of previous) {
    item.open = wasOpen;
  }
}