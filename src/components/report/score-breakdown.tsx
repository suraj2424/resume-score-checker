import type { ScoreCategory } from "@/lib/resume/types";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_TONE_THRESHOLDS,
  categoryLostPercent,
  categoryTone,
} from "@/components/ui/tones";
import { CategoryScoreBar } from "./category-score-bar";

function CategoryRow({
  category,
  onInspect,
}: {
  category: ScoreCategory;
  onInspect: (categoryId: string) => void;
}) {
  const tone = categoryTone(category);
  const lostPercent = categoryLostPercent(category);
  const excluded: string[] = [];
  // Two numbers, because `checksTotal - checksEvaluated` was one number for two
  // different facts: a check that had nothing to look at, and a check the
  // extraction would not support. Reading the second as the first tells a resume
  // with no summary section that its text failed to extract.
  if (category.notApplicable > 0) {
    excluded.push(`${category.notApplicable} did not apply`);
  }
  if (category.unableToVerify > 0) {
    excluded.push(`${category.unableToVerify} could not be evaluated`);
  }

  return (
    <li className="grid gap-3 px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-6 sm:px-7">
      <div className="flex min-w-0 flex-col gap-2">
        <h3 className="text-[15px] font-semibold tracking-[-0.012em] text-ink">{category.name}</h3>
        <CategoryScoreBar
          earned={category.earned}
          possible={category.possible}
          tone={tone}
          label={`${category.name}: ${category.earned} of ${category.possible} points`}
        />
        <p className="figure text-ink-3">
          {category.checksEvaluated} of {category.checksTotal} checks examined
          {excluded.length > 0 ? `, ${excluded.join(", ")}` : ""}
          {lostPercent > 0 ? `, ${lostPercent}% of points lost` : ""}
        </p>
      </div>

      <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
        <p className="figure-lg text-[1.375rem] leading-none text-ink">
          {category.earned}
          <span className="text-ink-3">/{category.possible}</span>
        </p>
        <Button type="button" variant="quiet" size="xs" onClick={() => onInspect(category.id)}>
          Inspect
        </Button>
      </div>
    </li>
  );
}

export function ScoreBreakdown({
  categories,
  onInspect,
}: {
  categories: ScoreCategory[];
  onInspect: (categoryId: string) => void;
}) {
  if (categories.length === 0) {
    return (
      <p className="text-[15px] text-ink-2">No category data was produced for this report.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="slab flex flex-col divide-y divide-rule print-flat">
        {categories.map((category) => (
          <CategoryRow key={category.id} category={category} onInspect={onInspect} />
        ))}
      </ul>

      <p className="max-w-[62ch] text-[13px] leading-relaxed text-ink-3">
        {/* The percentages are rendered from the same constants `categoryTone`
            branches on. A sentence that spells "a quarter" and "three fifths"
            keeps saying them after the rule moves. */}
        Bar colour follows how much of that category was lost: green under{" "}
        {Math.round(CATEGORY_TONE_THRESHOLDS.caution * 100)}%, amber up to{" "}
        {Math.round(CATEGORY_TONE_THRESHOLDS.issue * 100)}%, red beyond. Checks that did not apply
        and checks that could not be evaluated are both removed from the totals, so neither is ever
        counted as a failure.
      </p>
    </div>
  );
}