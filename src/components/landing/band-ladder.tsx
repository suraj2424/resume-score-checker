import { SCORE_BANDS } from "@/config/scoring";
import { cn } from "@/lib/utils/cn";

/**
 * The score ladder: what each band of the 0–100 scale means, drawn to scale.
 * Every number comes from the scoring configuration, so the ladder cannot
 * drift from the engine.
 */
export function BandLadder({ className }: { className?: string }) {
  const ordered = [...SCORE_BANDS].sort((a, b) => a.min - b.min);
  // The upper bound of a band is the `min` of the band above it, so this map is
  // over positions and does not read the element it is handed.
  const upperBounds = ordered.map((_, index) =>
    index === ordered.length - 1 ? 100 : ordered[index + 1]!.min,
  );
  const widths = upperBounds.map((upper, index) => upper - ordered[index]!.min);
  const template = widths.map((width) => `${width}fr`).join(" ");
  // Density rises with the band: the better the reading, the more ink on the
  // page. No hue needed to say which end is which.
  const DENSITY = [
    "bg-ink/10",
    "bg-ink/20",
    "bg-ink/35",
    "bg-ink/55",
    "bg-ink",
  ] as const;

  const bandCells = ordered.map((band, index) => (
    <li key={band.id} className="flex min-w-0 flex-col gap-0.5 overflow-hidden">
      <span className="text-[13px] font-semibold leading-tight text-ink">{band.label}</span>
      <span className="figure text-ink-3">
        {band.min}–{upperBounds[index] === 100 ? 100 : upperBounds[index]! - 1}
      </span>
    </li>
  ));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div aria-hidden="true" className="flex h-3 w-full overflow-hidden border border-rule-2">
        {ordered.map((band, index) => (
          <span
            key={band.id}
            className={cn("h-full border-l border-rule first:border-l-0", DENSITY[index])}
            style={{ width: `${widths[index]!}%` }}
          />
        ))}
      </div>

      {/*
        The band names sit on the same proportional columns as the bar above —
        that correspondence is the whole point of the component. At 320px each
        of the four narrow columns is 37px, so a band name wraps onto four
        lines and the ladder reads as noise, so below `sm` the names fall back to
        a wrapping list. The bar still carries the scale either way.
      */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 sm:hidden">
        {bandCells}
      </ul>
      <ul className="hidden gap-x-2 sm:grid" style={{ gridTemplateColumns: template }}>
        {bandCells}
      </ul>

      <p className="max-w-[66ch] text-[13px] leading-relaxed text-ink-3">
        Bands are published on the{" "}
        <a href="/how-scoring-works" className="link">
          scoring page
        </a>
        . Scores are guidance for quality and parsing readiness, not a hiring prediction.
      </p>
    </div>
  );
}