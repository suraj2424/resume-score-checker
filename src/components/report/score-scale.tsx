import { cn } from "@/lib/utils/cn";
import type { ScoreBandId } from "@/config/scoring";
import { SCORE_BANDS } from "@/config/scoring";
import { bandTone } from "@/components/ui/tones";
import { TONE_DOT, type Tone } from "@/components/ui/badge";

/**
 * The score is a measurement, so it is drawn like one: a printed scale with
 * ticks at the published band thresholds and a fill up to the value. It
 * replaces the progress donut, which reported a number nobody could place.
 *
 * The fill takes the band tone, so the verdict is legible before the figure is
 * read. Below 60 the bands are thin, and the colour has to do the work.
 */

const MAJOR_TICKS = [0, 25, 50, 75, 100] as const;
const MINOR_TICKS = [10, 20, 30, 40, 60, 70, 80, 90] as const;

const SIZE_MAP = {
  sm: { bar: "h-2", figure: "text-3xl", tickLabel: "text-[10px]" },
  md: { bar: "h-3", figure: "text-5xl", tickLabel: "text-[11px]" },
  lg: { bar: "h-5", figure: "text-[4.5rem] sm:text-[6rem]", tickLabel: "text-[11px]" },
} as const;

export function ScoreScale({
  value,
  band,
  size = "md",
  showThresholds = true,
  label,
  className,
}: {
  value: number;
  band?: ScoreBandId;
  size?: keyof typeof SIZE_MAP;
  /** Hairlines at the published band minimums (40 / 60 / 75 / 90). */
  showThresholds?: boolean;
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const { bar, tickLabel } = SIZE_MAP[size];
  const tone: Tone = band ? bandTone(band) : "mute";

  return (
    <div
      className={cn("w-full", className)}
      role="img"
      aria-label={label ?? `Score ${clamped} out of 100`}
    >
      <div className={cn("relative w-full border-b border-rule-2", bar)}>
        <span
          className={cn("animate-wipe absolute inset-y-0 left-0 motion-reduce:animate-none", TONE_DOT[tone])}
          style={{ width: `${clamped}%` }}
        />

        {showThresholds
          ? SCORE_BANDS.filter((b) => b.min > 0).map((bandEntry) => (
              <span
                key={bandEntry.id}
                aria-hidden="true"
                className="absolute inset-y-0 w-px bg-sheet/70"
                style={{ left: `${bandEntry.min}%` }}
              />
            ))
          : null}

        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-[2px] bg-ink"
          style={{ left: `calc(${clamped}% - 1px)` }}
        />
      </div>

      <div aria-hidden="true" className="relative mt-1.5 h-4">
        {MINOR_TICKS.map((tick) => (
          <span
            key={tick}
            className="absolute top-0 h-1.5 w-px bg-rule-2"
            style={{ left: `${tick}%` }}
          />
        ))}
        {MAJOR_TICKS.map((tick, index) => (
          <span
            key={tick}
            className={cn(
              "figure absolute top-0 text-ink-3",
              tickLabel,
              index === 0 && "translate-x-0",
              tick === 100 && "-translate-x-full",
              tick !== 0 && tick !== 100 && "-translate-x-1/2",
            )}
            style={{ left: `${tick}%` }}
          >
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The measured value, set large. Ink, not a status colour: the reading itself
 * is not a verdict, and the band dot beside it carries the verdict. The narrower
 * width of Archivo at display size; the denominator stays monospaced so columns
 * of scores line up.
 */
export function ScoreFigure({ value, size = "md" }: { value: number; size?: keyof typeof SIZE_MAP }) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("flex items-baseline gap-1")}>
      <span className={cn("display-cut figure-lg leading-[0.82] text-ink", SIZE_MAP[size].figure)}>
        {clamped}
      </span>
      <span className="figure text-ink-3">/ 100</span>
    </div>
  );
}