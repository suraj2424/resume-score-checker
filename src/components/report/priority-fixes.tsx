"use client";

import * as React from "react";
import { Badge, TONE_RULE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { priorityTone } from "@/components/ui/tones";
import { cn } from "@/lib/utils/cn";
import type { Recommendation } from "@/lib/resume/types";

const PRIORITY_LABEL: Record<Recommendation["priority"], string> = {
  high: "Fix first",
  medium: "Fix soon",
  low: "Worth doing",
};

/**
 * The fix list is a numbered sequence — severity, recoverable points, then
 * confidence — so it is the one list on the page that carries order numbers.
 */
function RecommendationRow({
  recommendation,
  index,
}: {
  recommendation: Recommendation;
  index: number;
}) {
  const tone = priorityTone(recommendation.priority);
  // The action itself is ink, because ink means act. The rule beside it carries
  // the priority, so colour never has to label a next step as a warning.

  return (
    <li className="grid gap-3 px-5 py-5 sm:grid-cols-[2.5rem_1fr] sm:gap-5 sm:px-7">
      <span className="figure text-ink-3">{String(index + 1).padStart(2, "0")}</span>
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <Badge tone={tone} surface="wash">
            {PRIORITY_LABEL[recommendation.priority]}
          </Badge>
          {recommendation.pointsRecoverable > 0 ? (
            <span className="figure text-ink-3">
              up to {recommendation.pointsRecoverable} pts recoverable
            </span>
          ) : null}
        </div>

        <h4 className="text-[15px] font-semibold leading-snug tracking-[-0.012em] text-ink">
          {recommendation.title}
        </h4>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-ink-2">
          {recommendation.explanation}
        </p>
        <p
          className={cn(
            "max-w-[62ch] border-l-2 pl-4 text-[15px] leading-relaxed text-ink-2",
            TONE_RULE[tone],
          )}
        >
          <span className="block text-[13px] font-semibold text-ink">What to do next</span>
          {recommendation.action}
        </p>
      </div>
    </li>
  );
}

export function PriorityFixes({ recommendations }: { recommendations: Recommendation[] }) {
  const [showAll, setShowAll] = React.useState(false);

  if (recommendations.length === 0) {
    return (
      <EmptyState
        tone="pass"
        title="No fixes left to make"
        description="Every check passed. Treat this as a clean reading rather than a finished edit: fit to a specific role still depends on the job."
      />
    );
  }

  const visible = showAll ? recommendations : recommendations.slice(0, 3);

  return (
    <div className="flex flex-col gap-3">
      <ol className="slab flex flex-col divide-y divide-rule print-flat">
        {visible.map((recommendation, i) => (
          <RecommendationRow key={recommendation.checkId} recommendation={recommendation} index={i} />
        ))}
      </ol>

      {recommendations.length > 3 ? (
        <Button
          type="button"
          variant="quiet"
          size="sm"
          className="no-print self-start"
          onClick={() => setShowAll((value) => !value)}
          aria-expanded={showAll}
        >
          {showAll ? "Show the first three only" : `Show all ${recommendations.length}`}
        </Button>
      ) : null}

      <p className="text-[13px] leading-relaxed text-ink-3">
        Ordered by severity, recoverable points and confidence. Fixing an item recovers at most the
        points shown.
      </p>
    </div>
  );
}