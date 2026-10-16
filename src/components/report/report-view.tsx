import * as React from "react";
import { useRef } from "react";
import { ContentSnapshot } from "./content-snapshot";
import { DetailedChecks } from "./detailed-checks";
import { MarkedUpBullets } from "./marked-up-bullets";
import { PriorityFixes } from "./priority-fixes";
import { ReportActions } from "./report-actions";
import { ReportHeader } from "./report-header";
import { ScoreBreakdown } from "./score-breakdown";
import { openAllDetails, restoreDetails } from "@/components/ui/accordion";
import type { ParsedResume, ScoreReport } from "@/lib/resume/types";

/**
 * Sections on the sheet are separated by a hairline and a plain heading. They
 * are not a numbered sequence, so they carry no numbers.
 */
function ReportSection({
  title,
  description,
  id,
  children,
}: {
  title: string;
  description: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-6 border-t border-rule pt-10">
      <div className="flex flex-col gap-2">
        <h2 className="max-w-[26ch] text-[1.375rem] font-semibold leading-[1.15] tracking-[-0.022em] text-ink sm:text-[1.75rem]">
          {title}
        </h2>
        <p className="max-w-[58ch] text-[15px] leading-relaxed text-ink-2">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function ReportView({
  report,
  resume,
  onCheckAnother,
  onClearReport,
}: {
  report: ScoreReport;
  resume: ParsedResume;
  onCheckAnother: () => void;
  onClearReport: () => void;
}) {
  const [activeCategoryId, setActiveCategoryId] = React.useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleBeforePrint = () => {
      const previous = openAllDetails(containerRef.current);
      const restore = () => restoreDetails(previous);
      window.addEventListener("afterprint", restore, { once: true });
    };
    window.addEventListener("beforeprint", handleBeforePrint);
    return () => window.removeEventListener("beforeprint", handleBeforePrint);
  }, []);

  const inspect = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    const target = document.getElementById("detailed-checks");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-10">
      <ReportHeader
        report={report}
        onCheckAnother={onCheckAnother}
        onClearReport={onClearReport}
        actions={<ReportActions report={report} resume={resume} />}
      />

      <ReportSection
        id="score-breakdown"
        title="Where the points come from"
        description="Each category is the sum of its checks. Inspect a row to jump to its evidence."
      >
        <ScoreBreakdown categories={report.categories} onInspect={inspect} />
      </ReportSection>

      <ReportSection
        id="priority-fixes"
        title="What to improve first"
        description="Ordered by severity, recoverable points and confidence. These are suggestions, not rewrites."
      >
        <PriorityFixes recommendations={report.recommendations} />
      </ReportSection>

      <ReportSection
        id="marked-up-bullets"
        title="Your bullets, marked up"
        description="Each flag points at the exact words. The marks show what to change, not a replacement — nothing here rewrites your resume for you."
      >
        <MarkedUpBullets bullets={resume.bullets} />
      </ReportSection>

      <ReportSection
        id="detailed-checks"
        title="Every check, with its evidence"
        description="Filter by result or category. Each check shows what was found and what to do next."
      >
        <DetailedChecks
          results={report.results}
          activeCategoryId={activeCategoryId}
          onCategoryChange={setActiveCategoryId}
        />
      </ReportSection>

      <ReportSection
        id="content-snapshot"
        title="What was detected"
        description="Sections, skill terms and parsing notes. Contact details are never displayed."
      >
        <ContentSnapshot resume={resume} />
      </ReportSection>
    </div>
  );
}