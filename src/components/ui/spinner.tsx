import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Inline loading indicator with an accessible label.
 *
 * Deliberately not a live region. `/check` already keeps one polite
 * `role="status"` mounted for the phase and score, and a spinner that announced
 * itself would make every state change speak twice — and a static "Analysis in
 * progress" next to a live "Reading the document" is the less useful half of the
 * pair.
 */
export function Spinner({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span data-slot="spinner" className="inline-flex items-center gap-2">
      <Loader2 className={cn("size-4 animate-spin text-ink-3", className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
