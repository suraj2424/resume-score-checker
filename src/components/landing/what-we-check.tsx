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

        {/*
          A real table, not a grid of divs with two labels above it.

          The `<span className="label">` headers were decorative: nothing tied
          them to the rows, and `hidden sm:grid` deleted them from the
          accessibility tree as well as the screen, so below 640px the rubric had
          no column headers at all. `sr-only sm:not-sr-only` keeps them announced
          at every width and visible once there is room for two columns.

          `table-fixed` with one fixed column holds the 15rem share rail at `sm`
          and splits 3/5–2/5 below it, so the ledger still reads as two columns
          on a 320px screen without adding a nested scrollbar.
        */}
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">
            Each scoring category, what it looks at, and how much of the {TOTAL_SCORE_WEIGHT}-point
            score it controls.
          </caption>
          <colgroup>
            <col className="w-3/5 sm:w-auto" />
            <col className="w-2/5 sm:w-60" />
          </colgroup>
          <thead className="sr-only sm:not-sr-only">
            <tr>
              <th scope="col" className="label border-t border-rule-2 pb-2 text-left font-semibold">
                Category and scope
              </th>
              <th
                scope="col"
                className="label border-t border-rule-2 pb-2 pl-4 text-left font-semibold sm:pl-0"
              >
                Share of score · checks
              </th>
            </tr>
          </thead>
          <tbody>
            {SCORING_CATEGORIES.map((category) => {
              const Icon = CATEGORY_ICONS[category.id as keyof typeof CATEGORY_ICONS] ?? LayoutList;
              const count = ALL_CHECKS.filter((c) => c.categoryId === category.id).length;
              return (
                <tr key={category.id}>
                  <th
                    scope="row"
                    className="border-t border-rule py-5 pr-4 text-left align-top font-normal"
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
                  </th>
                  <td className="border-t border-rule py-5 align-middle">
                    <span className="flex flex-col gap-2">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span
                          className="h-[5px] min-w-8 flex-1 bg-rule"
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
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="border-t border-rule pt-5">
          <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">What we cannot check.</span> Without a target
            job description, no tool can judge role fit. Relevance here means general skills
            signals — never a hiring guarantee, and never a rewrite of your bullets.
          </p>
        </div>
      </div>
    </section>
  );
}