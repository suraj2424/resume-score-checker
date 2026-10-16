import { cn } from "@/lib/utils/cn";
import { TONE_BAR, type Tone } from "@/components/ui/badge";

/**
 * A category's share of the score, drawn on the same scale as the total: a bar
 * for the points earned, the rule showing the points still available. The tone
 * reports the worst result found in that category; the percentage beside it
 * repeats the value in text so colour is never the only signal.
 */
export function CategoryScoreBar({
  earned,
  possible,
  tone = "mute",
  label,
}: {
  earned: number;
  possible: number;
  tone?: Tone;
  label: string;
}) {
  const percentOfPossible = possible > 0 ? Math.round((earned / possible) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative h-[6px] w-full bg-rule"
        role="progressbar"
        aria-label={label}
        aria-valuenow={earned}
        aria-valuemin={0}
        aria-valuemax={possible}
      >
        <div
          className={cn("h-full transition-[width] duration-500", TONE_BAR[tone])}
          style={{ width: `${percentOfPossible}%` }}
        />
      </div>
      <span className="figure shrink-0 text-ink-3">{percentOfPossible}%</span>
    </div>
  );
}