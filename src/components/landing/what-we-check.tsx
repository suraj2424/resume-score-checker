import { AlignLeft, Contact, Eye, LayoutList, Tags } from "lucide-react";
import { SCORING_CATEGORIES, TOTAL_SCORE_WEIGHT } from "@/config/scoring";
import { ALL_CHECKS } from "@/lib/resume/rules";
import { SectionHeading } from "@/components/ui/section-heading";

const CATEGORY_ICONS = {
  structure: LayoutList,
  content: AlignLeft,
  contact: Contact,
  readability: Eye,
  skills: Tags,
} as const;

const CATEGORY_SCOPE: Record<string, string> = {
  structure: "Sections present, and headings a recruiter can find",
  content: "Action verbs, scannable bullets, stated outcomes",
  contact: "Email, phone, LinkedIn and portfolio signals",
  readability: "Selectable text, date consistency, layout risk",
  skills: "A findable skills section, and recognized terms",
};

/**
 * The published rubric as a ledger: name, what it looks at, its share of the
 * score. The bar length is the category's weight drawn to the same scale as the
 * score, so the two figures on this page are comparable.
 */
export function WhatWeCheck() {
  const total = ALL_CHECKS.length;

  return (
    <section id="what-we-check" className="scroll-mt-24 border-t border-edge py-14 lg:py-20">
      <div className="flex flex-col gap-8">
        <SectionHeading
          title={`${SCORING_CATEGORIES.length} categories, ${total} checks, ${TOTAL_SCORE_WEIGHT} points.`}
          description="Each row shows what the category looks at and how much of the score it controls. Open a report to see the evidence behind any row."
        />

        <div className="flex flex-col">
          <div className="hidden grid-cols-[1fr_15rem] gap-6 border-t border-rule-2 pb-2 sm:grid">
            <span className="label">Category and scope</span>
            <span className="label">Share of score · checks</span>
          </div>

          <ul className="flex flex-col">
            {SCORING_CATEGORIES.map((category) => {
              const Icon = CATEGORY_ICONS[category.id as keyof typeof CATEGORY_ICONS] ?? LayoutList;
              const count = ALL_CHECKS.filter((c) => c.categoryId === category.id).length;
              return (
                <li
                  key={category.id}
                  className="grid gap-3 border-t border-rule py-5 sm:grid-cols-[1fr_15rem] sm:items-center sm:gap-6"
                >
                  <div className="flex items-start gap-3.5">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-8 shrink-0 items-center justify-center border border-rule bg-sheet-tint text-ink-2"
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <h3 className="text-[15px] font-semibold tracking-[-0.012em] text-ink">
                        {category.name}
                      </h3>
                      <p className="max-w-[46ch] text-[14px] leading-relaxed text-ink-2">
                        {CATEGORY_SCOPE[category.id] ?? category.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="flex items-center gap-3">
                      <span
                        className="h-[5px] flex-1 bg-rule"
                        role="img"
                        aria-label={`${category.name} controls ${category.weight} of ${TOTAL_SCORE_WEIGHT} points`}
                      >
                        <span
                          className="block h-full bg-ink"
                          style={{ width: `${category.weight}%` }}
                        />
                      </span>
                      <span className="figure shrink-0 text-ink-2">{category.weight}</span>
                      <span className="figure shrink-0 text-ink-3">of {TOTAL_SCORE_WEIGHT}</span>
                    </span>
                    <span className="figure text-ink-3">
                      {count} {count === 1 ? "check" : "checks"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-t border-rule pt-5">
          <p className="max-w-[76ch] text-[15px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">What we cannot check.</span> Without a target
            job description, no tool can judge role fit. Relevance here means general skills
            signals — never a hiring guarantee, and never a rewrite of your bullets.
          </p>
        </div>
      </div>
    </section>
  );
}