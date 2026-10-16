import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Inline loading indicator with an accessible label. */
export function Spinner({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <Loader2 className={cn("size-4 animate-spin text-ink-3", className)} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
