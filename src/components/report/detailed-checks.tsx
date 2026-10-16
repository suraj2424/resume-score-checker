"use client";

import * as React from "react";
import { AccordionItem } from "@/components/ui/accordion";
import { Badge, TONE_RULE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { severityTone, statusTone } from "@/components/ui/tones";
import { cn } from "@/lib/utils/cn";
import { CheckStatusBadge } from "./check-status-badge";
import { SCORING_CATEGORIES } from "@/config/scoring";
import type { CheckResultWithMetadata, CheckStatus } from "@/lib/resume/types";

type StatusFilter = "all" | "issues" | "warnings" | "passed" | "not-evaluated";

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string; matches: (status: CheckStatus) => boolean }> = [
  { id: "all", label: "All", matches: () => true },
  { id: "issues", label: "Issues", matches: (status) => status === "issue" },
  { id: "warnings", label: "Warnings", matches: (status) => status === "warning" },
  { id: "passed", label: "Passed", matches: (status) => status === "pass" },
  {
    id: "not-evaluated",
    label: "Set aside",
    matches: (status) => status === "unable-to-verify" || status === "not-applicable",
  },
];

const SEVERITY_LABEL: Record<CheckResultWithMetadata["severity"], string> = {
  high: "high severity",
  medium: "medium severity",
  low: "low severity",
  info: "informational",
};

/** A single check row; explanation and evidence expand on demand. */
function CheckRow({ result }: { result: CheckResultWithMetadata }) {
  return (
    <li className="border-b border-rule last:border-b-0">
      <details>
        <summary className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3.5 text-left outline-none transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
          <CheckStatusBadge status={result.status} />
          <span className="flex-1 text-[14px] font-medium text-ink">{result.title}</span>
          <Badge tone={severityTone(result.severity)} size="sm">
            {SEVERITY_LABEL[result.severity]}
          </Badge>
          <span className="figure text-ink-3">
            {result.pointsEarned}/{result.pointsPossible}
          </span>
        </summary>

        <div className="flex flex-col gap-3 pb-4 pl-[7.6rem] max-sm:pl-0">
          <p className="max-w-[62ch] text-[13px] leading-relaxed text-ink-3">{result.description}</p>
          <p className="max-w-[62ch] text-[15px] leading-relaxed text-ink-2">{result.explanation}</p>

          {result.evidence && result.evidence.length > 0 ? (
            <div className="border-l border-rule-2 pl-4">
              <p className="text-[13px] font-semibold text-ink">Evidence</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {result.evidence.slice(0, 3).map((item, index) => (
                  <li key={index} className="figure text-ink-3">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.recommendation ? (
            <div className={cn("border-l-2 pl-4", TONE_RULE[statusTone(result.status)])}>
              <p className="text-[13px] font-semibold text-ink">What to do next</p>
              <p className="mt-1 max-w-[62ch] text-[15px] leading-relaxed text-ink-2">
                {result.recommendation}
              </p>
            </div>
          ) : null}

          {result.confidence ? (
            <p className="figure text-ink-3">{result.confidence} confidence</p>
          ) : null}
        </div>
      </details>
    </li>
  );
}

/** Detailed checks, grouped by category, with accessible filters. */
export function DetailedChecks({
  results,
  activeCategoryId,
  onCategoryChange,
}: {
  results: CheckResultWithMetadata[];
  activeCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
}) {
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");

  const matchesFilter =
    STATUS_FILTERS.find((filter) => filter.id === statusFilter)?.matches ?? (() => true);
  const filtered = results.filter((result) => matchesFilter(result.status));

  const categorySummaries = SCORING_CATEGORIES.map((category) => {
    const categoryResults = filtered.filter((result) => result.categoryId === category.id);
    const evaluated = categoryResults.filter((result) => result.pointsPossible > 0);
    return {
      category,
      categoryResults,
      earned: evaluated.reduce((sum, result) => sum + result.pointsEarned, 0),
      possible: evaluated.reduce((sum, result) => sum + result.pointsPossible, 0),
    };
  });

  const visibleCategories = categorySummaries.filter((entry) => entry.categoryResults.length > 0);
  const totalVisible = filtered.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        <div role="group" aria-label="Filter checks by result" className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((filter) => {
            const count = results.filter((result) => filter.matches(result.status)).length;
            const active = statusFilter === filter.id;
            return (
              <Button
                key={filter.id}
                type="button"
                size="sm"
                variant={active ? "primary" : "quiet"}
                aria-pressed={active}
                onClick={() => setStatusFilter(filter.id)}
              >
                {filter.label}
                <span className="tabular opacity-60">{count}</span>
              </Button>
            );
          })}
        </div>

        <div role="group" aria-label="Filter checks by category" className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="xs"
            variant={activeCategoryId === null ? "secondary" : "quiet"}
            aria-pressed={activeCategoryId === null}
            onClick={() => onCategoryChange(null)}
          >
            All categories
          </Button>
          {SCORING_CATEGORIES.map((category) => (
            <Button
              key={category.id}
              type="button"
              size="xs"
              variant={activeCategoryId === category.id ? "secondary" : "quiet"}
              aria-pressed={activeCategoryId === category.id}
              onClick={() =>
                onCategoryChange(activeCategoryId === category.id ? null : category.id)
              }
            >
              {category.name}
            </Button>
          ))}
        </div>
      </div>

      {totalVisible === 0 ? (
        <EmptyState
          tone="note"
          title="No checks match this filter"
          description="Try a different result filter or category. Every check is always shown under All."
        />
      ) : (
        <div className="slab px-5 sm:px-7 print-flat">
          {visibleCategories.map(({ category, categoryResults, earned, possible }) => (
            <AccordionItem
              key={category.id}
              defaultOpen={activeCategoryId === category.id || visibleCategories.length === 1}
              title={category.name}
              meta={
                <span className="figure text-ink-2">
                  {earned}/{possible}
                </span>
              }
            >
              <ul className="flex flex-col">
                {categoryResults.map((result) => (
                  <CheckRow key={result.checkId} result={result} />
                ))}
              </ul>
            </AccordionItem>
          ))}
        </div>
      )}

      <p className="text-[13px] leading-relaxed text-ink-3">
        Showing {totalVisible} of {results.length} checks. Set aside means there was not enough
        evidence — those points are excluded from the score, never counted as a failure.
      </p>
    </div>
  );
}