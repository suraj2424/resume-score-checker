import { ScoreRail } from "@/components/report/score-rail";
import { SCORING_CATEGORIES } from "@/config/scoring";
import type { ParsedResume, ScoreReport } from "@/lib/resume/types";

/**
 * The rail beside the check flow.
 *
 * It used to disappear the instant results rendered, which took the user's
 * orientation with it: the score left the screen, "Copy summary" and "Print"
 * became a scroll away, and the reassurance that nothing is uploaded stopped
 * being visible exactly when the user had a document full of personal details
 * open in front of them. This stays mounted for the whole session and swaps
 * what it holds.
 */

/**
 * What the tool does, in the order it does it. Read from config where a number
 * is involved, because the old copy hardcoded the word "five" in a template
 * literal that was never even interpolated.
 */
const WORKFLOW = [
  {
    title: "Parsed here, not on a server",
    body: "Sections, bullets and contact signals are extracted in this tab.",
  },
  {
    title: "Scored against the published checks",
    body: `Fixed checks across ${SCORING_CATEGORIES.length} categories. Nothing is guessed.`,
  },
  {
    title: "Evidence attached",
    body: "Every point shows what was found and what to change.",
  },
];

function WorkflowRail() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col border-t border-rule">
        <p className="label border-b border-rule py-3">What happens here</p>
        <ol className="flex flex-col">
          {WORKFLOW.map((step, index) => (
            <li key={step.title} className="flex gap-3 border-b border-rule py-3.5 last:border-b-0">
              <span className="figure shrink-0 pt-0.5 text-ink-3">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-[14px] font-semibold text-ink">{step.title}</span>
                <span className="max-w-[38ch] text-[13px] leading-relaxed text-ink-2">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-2">
        <p className="label">What happens to your file</p>
        <ul className="flex flex-col gap-1.5 text-[14px] leading-relaxed text-ink-2">
          <li>Parsed and scored in this tab — never uploaded.</li>
          <li>Never written to storage. Closing the tab discards it.</li>
          <li>Removed immediately with Remove or Clear report.</li>
        </ul>
        <p className="figure pt-1 text-ink-3">No OCR, no AI analysis, no external requests</p>
      </div>
    </div>
  );
}

export function CheckScoreRail({
  report,
  resume,
  onClearReport,
  activeCategoryId,
  onInspectCategory,
}: {
  report?: ScoreReport;
  resume?: ParsedResume;
  onClearReport: () => void;
  activeCategoryId: string | null;
  onInspectCategory: (categoryId: string | null) => void;
}) {
  if (report && resume) {
    // Hidden below `lg`, where the report's own sticky bottom bar already carries
    // the score, the fixes count and the section links. Two rails of the same
    // data on a phone is one rail too many.
    return (
      <div className="hidden min-w-0 flex-col gap-8 lg:sticky lg:top-24 lg:self-start lg:flex">
        <ScoreRail
          report={report}
          resume={resume}
          onClearReport={onClearReport}
          activeCategoryId={activeCategoryId}
          onInspectCategory={onInspectCategory}
        />
      </div>
    );
  }

  return (
    <aside
      aria-label="How the check runs and what happens to your file"
      className="flex min-w-0 flex-col gap-8 lg:sticky lg:top-24"
    >
      <WorkflowRail />
    </aside>
  );
}