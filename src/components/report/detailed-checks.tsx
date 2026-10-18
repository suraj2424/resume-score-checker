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
import type {
  CheckResultWithMetadata,
  CheckStatus,
  Confidence,
  ScoreCategory,
} from "@/lib/resume/types";

type StatusFilter =
  | "all"
  | "issues"
  | "warnings"
  | "passed"
  | "not-applicable"
  | "unable-to-verify";

/**
 * Six filters in two groups, because "set aside" was one label for two
 * opposite facts. A check that had nothing to look at answered perfectly; a
 * check the extraction would not support did not. Filing them under one word
 * told a resume with no summary section that its text extraction had failed.
 */
interface StatusFilterOption {
  id: StatusFilter;
  label: string;
  matches: (status: CheckStatus) => boolean;
}

const RESULT_FILTERS: StatusFilterOption[] = [
  { id: "all", label: "All", matches: () => true },
  { id: "issues", label: "Issues", matches: (status) => status === "issue" },
  { id: "warnings", label: "Warnings", matches: (status) => status === "warning" },
  { id: "passed", label: "Passed", matches: (status) => status === "pass" },
];

const EXCLUDED_FILTERS: StatusFilterOption[] = [
  {
    id: "not-applicable",
    label: "Did not apply",
    matches: (status) => status === "not-applicable",
  },
  {
    id: "unable-to-verify",
    label: "Could not be evaluated",
    matches: (status) => status === "unable-to-verify",
  },
];

const ALL_STATUS_FILTERS: StatusFilterOption[] = [...RESULT_FILTERS, ...EXCLUDED_FILTERS];

const SEVERITY_LABEL: Record<CheckResultWithMetadata["severity"], string> = {
  high: "high severity",
  medium: "medium severity",
  low: "low severity",
  info: "informational",
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

/** A single check row; explanation and evidence expand on demand. */
function CheckRow({ result }: { result: CheckResultWithMetadata }) {
  const scored = result.pointsPossible > 0;

  return (
    <li className="border-b border-rule last:border-b-0">
      {/*
        `outline-none` without a replacement is what made 36 check rows
        keyboard-invisible. The unlayered global `:focus-visible` restores an
        outline, but this list is the report's primary interaction and gets the
        same explicit ring the Button uses, so it reads the same everywhere.
      */}
      <summary className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3.5 text-left outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring [&::-webkit-details-marker]:hidden">
        <CheckStatusBadge status={result.status} />
        <span className="min-w-0 flex-1 text-[14px] font-medium text-ink">{result.title}</span>
        <Badge tone={severityTone(result.severity)}>
          {SEVERITY_LABEL[result.severity]}
        </Badge>
        {/*
          `0/0` is not a score. A check that was excluded from the denominator
          has no reading, and printing a zero there is the same conflation the
          two exclusion statuses exist to remove.
        */}
        <span className="figure text-ink-3">
          {scored ? `${result.pointsEarned}/${result.pointsPossible}` : "not scored"}
        </span>
      </summary>

      {/*
        `accordion-content` is the print CSS's only lever for revealing a closed
        disclosure. Without it this body's visibility depended entirely on the
        JS `beforeprint` hook, so no JS â€” or any print path that skips the hook
        â€” silently dropped every explanation, every piece of evidence and every
        recommendation from the page.

        The gutter is a grid column rather than `pl-[7.6rem]`: the old padding
        matched the desktop summary only while that summary did not wrap, and it
        is `flex flex-wrap`, so a long title indented the body 121px into
        whitespace.
      */}
      <div className="accordion-content grid gap-x-4 gap-y-3 pb-4 sm:grid-cols-[auto_minmax(0,1fr)] max-sm:pl-0">
        <div className="flex sm:justify-end">
          {result.confidence ? (
            <Badge tone="mute" dot={false}>
              {CONFIDENCE_LABEL[result.confidence]}
            </Badge>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
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
        </div>
      </div>
    </li>
  );
}

/** Detailed checks, grouped by category, with accessible filters. */
export function DetailedChecks({
  results,
  categories,
  activeCategoryId,
  onCategoryChange,
}: {
  results: CheckResultWithMetadata[];
  categories: ScoreCategory[];
  activeCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
}) {
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");

  const matchesFilter =
    ALL_STATUS_FILTERS.find((filter) => filter.id === statusFilter)?.matches ?? (() => true);
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

  const activeFilter = ALL_STATUS_FILTERS.find((filter) => filter.id === statusFilter);
  const activeCategoryName = categories.find((category) => category.id === activeCategoryId);

  const renderFilterButton = (filter: StatusFilterOption) => {
    const count = results.filter((result) => filter.matches(result.status)).length;
    const active = statusFilter === filter.id;
    return (
      <Button
        key={filter.id}
        type="button"
       
        variant={active ? "primary" : "quiet"}
        aria-pressed={active}
        onClick={() => setStatusFilter(filter.id)}
      >
        {filter.label}
        <span className="tabular opacity-60">{count}</span>
      </Button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        <div role="group" aria-label="Filter checks by result" className="flex flex-col gap-2">
          <p className="label">Results</p>
          <div className="flex flex-wrap gap-1.5">{RESULT_FILTERS.map(renderFilterButton)}</div>
        </div>

        <div role="group" aria-label="Checks left out of the score" className="flex flex-col gap-2">
          <p className="label">Left out of the score</p>
          <div className="flex flex-wrap gap-1.5">{EXCLUDED_FILTERS.map(renderFilterButton)}</div>
        </div>

        <div role="group" aria-label="Filter checks by category" className="flex flex-col gap-2">
          <p className="label">Category</p>
          <div className="flex flex-wrap gap-1.5">
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
                <span className="figure text-ink-2">{possible > 0 ? `${earned}/${possible}` : "â€”"}</span>
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

      {/*
        The live region. Filtering used to move the scroll position and nothing
        else: a keyboard or screen-reader user was left at an empty spot about a
        screen below where focus still was, with no word about why. This line is
        the one place in the report that says what the list is now showing, and
        it is a `role="status"` so every filter change announces itself.
      */}
      <p role="status" aria-live="polite" className="text-[13px] leading-relaxed text-ink-3">
        Showing {totalVisible} of {results.length} checks
        {activeFilter && activeFilter.id !== "all" ? ` Â· filter: ${activeFilter.label}` : ""}
        {activeCategoryName ? ` Â· category: ${activeCategoryName.name}` : ""}.
      </p>

      <p className="max-w-[62ch] text-[13px] leading-relaxed text-ink-3">
        <strong className="font-semibold text-ink-2">Did not apply</strong> means the check had
        nothing to look at on this document â€” a professional summary that is not there, for
        example. <strong className="font-semibold text-ink-2">Could not be evaluated</strong>{" "}
        means the check wanted to run and the extracted text would not let it. Both remove their
        points from earned and available alike, so neither is ever counted as a failure.
      </p>
    </div>
  );
}