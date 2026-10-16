import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils/cn";

/**
 * The mark is a proof mark: a check on a ruled line. The line is the scale,
 * the notch is the measured value — the same two ideas the score uses.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-[3px] border border-rule-2 bg-sheet",
        className,
      )}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M2 11.5h12"
          stroke="var(--color-ink-3)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <path
          d="M4.5 10.5 6.75 8l2 2L11.5 6"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9.5 6h2v2"
          stroke="var(--color-ink)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="text-[15px] font-bold tracking-[-0.02em] text-ink">{siteConfig.name}</span>
    </Link>
  );
}