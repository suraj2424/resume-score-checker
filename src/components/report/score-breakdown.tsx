import type { ScoreCategory } from "@/lib/resume/types";
import { Button } from "@/components/ui/button";
import { categoryLostPercent, categoryTone } from "@/components/ui/tones";
import { CategoryScoreBar } from "./category-score-bar";

function CategoryRow({
  category,
  onInspect,
}: {
  category: ScoreCategory;
  onInspect: (categoryId: string) => void;
}) {
  const tone = categoryTone(category);
  const setAside = category.checksTotal - category.checksEvaluated;
  const lostPercent = categoryLostPercent(category);

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
          {setAside > 0 ? `, ${setAside} set aside` : ""}
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

      <p className="text-[13px] leading-relaxed text-ink-3">
        Bar colour follows how much of that category was lost: green under a quarter, amber up to
        three fifths, red beyond. Checks set aside are removed from both totals, so they are never
        counted as failures.
      </p>
    </div>
  );
}