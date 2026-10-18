import { SCORING_CATEGORIES, TOTAL_SCORE_WEIGHT } from "@/config/scoring";
import { ALL_CHECKS } from "@/lib/resume/rules";
import { SectionHeading } from "@/components/ui/section-heading";

const CHECK_COUNT = ALL_CHECKS.length;

const STEPS = [
  {
    title: "Choose a file",
    body: "PDF or DOCX, read directly by this page. The file never leaves your browser and nothing is written to storage.",
    figure: "No sign-up",
  },
  {
    title: "Run the checks",
    body: `The document is parsed into sections, bullets and contact signals, then scored against ${CHECK_COUNT} fixed checks. The same file and version always give the same score.`,
    figure: `${SCORING_CATEGORIES.length} categories`,
  },
  {
    title: "Work the list",
    body: "Priority fixes first, then every check with the evidence behind it. Edit the file, check it again, compare the two reports.",
    figure: "Evidence attached",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-t border-edge py-14 lg:py-20"
    >
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <SectionHeading
            title="Upload to a marked-up report."
            description="No queue, no account, no model guessing. The whole check runs on your device."
          />
        </div>

        <ol className="flex flex-col">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="grid gap-3 border-t border-edge py-7 sm:grid-cols-[2.5rem_1fr] sm:gap-5"
            >
              <span className="figure text-ink-3">{String(index + 1).padStart(2, "0")}</span>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="text-[17px] font-semibold tracking-[-0.016em] text-ink">
                    {step.title}
                  </h3>
                  <span className="figure text-ink-3">{step.figure}</span>
                </div>
                <p className="max-w-[66ch] text-[15px] leading-relaxed text-ink-2">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Methodology() {
  return (
    <section className="border-t border-edge py-14 lg:py-20">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <div className="flex flex-col gap-4">
          <SectionHeading
            title="How the score is calculated."
            description={`${TOTAL_SCORE_WEIGHT} points across ${SCORING_CATEGORIES.length} weighted categories and ${CHECK_COUNT} checks. Checks that cannot be evaluated are set aside, never counted as failures.`}
          />
        </div>

        <ul className="flex flex-col">
          {SCORING_CATEGORIES.map((category) => {
            const count = ALL_CHECKS.filter((c) => c.categoryId === category.id).length;
            return (
              <li
                key={category.id}
                className="grid grid-cols-[1fr_auto] items-baseline gap-x-5 gap-y-1 border-t border-edge py-3.5 last:border-b"
              >
                {/* A category name is the heading of its own row. As a bare
                    `<span>` it sat at two outline depths from `SectionHeading`
                    above it — same information, two depths, so a screen reader
                    walking the page read the rubric as an unlabelled list. */}
                <h3 className="text-[15px] font-semibold tracking-[-0.012em] text-ink">
                  {category.name}
                </h3>
                <span className="figure text-ink-2">
                  {category.weight} pts, {count} checks
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}