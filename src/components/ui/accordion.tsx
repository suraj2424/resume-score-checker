"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Native `<details>` accordion. Chosen over a JS accordion so the content is
 * always in the DOM: it stays keyboard accessible, prints with every expanded
 * item, and works before hydration.
 *
 * The summary is a full-width row, so an offset outline would be drawn over the
 * neighbouring rows. The ring is inset for that reason, and it exists at all
 * because the row previously carried `outline-none` plus a 2% background shift —
 * which is not a focus indicator on either theme.
 */
export function AccordionItem({
  title,
  meta,
  children,
  defaultOpen = false,
  className,
}: {
  title: React.ReactNode;
  /** Points, status or other summary shown opposite the title. */
  meta?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn("group border-b border-rule last:border-b-0", className)}
    >
      <summary className="flex items-start gap-3 py-4 text-left outline-none transition-colors hover:text-ink focus-visible:bg-sheet-tint focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring [&::-webkit-details-marker]:hidden">
        <ChevronDown
          className="accordion-chevron mt-0.5 size-4 shrink-0 text-ink-3"
          aria-hidden="true"
        />
        <h3
          data-slot="accordion-heading"
          className="flex-1 text-[15px] font-semibold tracking-[-0.012em] text-ink"
        >
          {title}
        </h3>
        {meta ? <div className="flex shrink-0 items-center gap-3 pt-0.5">{meta}</div> : null}
      </summary>
      <div
        data-slot="accordion-content"
        className="accordion-content pb-5 pl-7 pr-1 text-[15px] leading-relaxed text-ink-2"
      >
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