import * as React from "react";
import { useRef } from "react";
import { ContentSnapshot } from "./content-snapshot";
import { DetailedChecks } from "./detailed-checks";
import { MarkedUpBullets } from "./marked-up-bullets";
import { PriorityFixes } from "./priority-fixes";
import { ReportActions } from "./report-actions";
import { ReportHeader } from "./report-header";
import { ScoreBreakdown } from "./score-breakdown";
import { MobileReportBar, REPORT_SECTIONS, ScoreRail, scrollToReportSection } from "./score-rail";
import { SectionHeading } from "@/components/ui/section-heading";
import { openAllDetails, restoreDetails } from "@/components/ui/accordion";
import type { ParsedResume, ScoreReport } from "@/lib/resume/types";

type ReportSectionId = (typeof REPORT_SECTIONS)[number]["id"];

/** Titles live in the rail's list so a section cannot exist without a nav entry. */
function sectionTitle(id: ReportSectionId): string {
  const match = REPORT_SECTIONS.find((section) => section.id === id);
  if (!match) {
    throw new Error(`Unknown report section: ${id}`);
  }
  return match.title;
}

/**
 * Sections on the sheet are separated by a hairline and a plain heading. They
 * are not a numbered sequence, so they carry no numbers.
 */
function ReportSection({
  title,
  description,
  id,
  focusTarget = false,
  children,
}: {
  title: string;
  description: string;
  id: ReportSectionId;
  /**
   * Programmatic focus target for the rail's filter. `tabIndex={-1}` keeps it
   * out of the tab order while letting `.focus()` land here, which is what makes
   * "scroll and move focus together" possible at all.
   */
  focusTarget?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      tabIndex={focusTarget ? -1 : undefined}
      aria-label={title}
      className="flex scroll-mt-24 flex-col gap-6 border-t border-rule pt-10"
    >
      {/* No `size` prop: the report used to carry its own h2 scale and read a
          step larger than every other page on the site. */}
      <SectionHeading title={title} description={description} />
      {children}
    </section>
  );
}

export function ReportView({
  report,
  resume,
  onCheckAnother,
  onClearReport,
  rail = true,
  controlledCategoryId,
  onActiveCategoryIdChange,
  onInspectCategory,
}: {
  report: ScoreReport;
  resume: ParsedResume;
  onCheckAnother: () => void;
  onClearReport: () => void;
  /**
   * Whether this component draws the report's own two-column shell. `/check`
   * turns it off because the page shell already owns a sticky right column and
   * rendering both would leave the body of the report about 240px wide.
   */
  rail?: boolean;
  /** Supplied by the page shell when the rail lives outside this component. */
  controlledCategoryId?: string | null;
  onActiveCategoryIdChange?: (categoryId: string | null) => void;
  onInspectCategory?: (categoryId: string) => void;
}) {
  const [localCategoryId, setLocalCategoryId] = React.useState<string | null>(null);
  const activeCategoryId = controlledCategoryId !== undefined ? controlledCategoryId : localCategoryId;
  const selectCategory = onActiveCategoryIdChange ?? setLocalCategoryId;
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
    if (onInspectCategory) {
      onInspectCategory(categoryId);
      return;
    }
    setLocalCategoryId(categoryId);
    scrollToReportSection("detailed-checks");
  };

  const sections = (
    <>
      <ReportSection
        id="score-breakdown"
        title={sectionTitle("score-breakdown")}
        description="Each category is the sum of its checks. Inspect a row to jump to its evidence."
      >
        <ScoreBreakdown categories={report.categories} onInspect={inspect} />
      </ReportSection>

      <ReportSection
        id="priority-fixes"
        title={sectionTitle("priority-fixes")}
        description="Ordered by severity, detection confidence and recoverable points, with ties broken by title. These are suggestions, not rewrites."
      >
        <PriorityFixes recommendations={report.recommendations} />
      </ReportSection>

      <ReportSection
        id="marked-up-bullets"
        title={sectionTitle("marked-up-bullets")}
        description="Each flag points at the exact words. The marks show what to change, not a replacement — nothing here rewrites your resume for you."
      >
        <MarkedUpBullets bullets={resume.bullets} />
      </ReportSection>

      <ReportSection
        id="detailed-checks"
        title={sectionTitle("detailed-checks")}
        description="Filter by result or category. Each check shows what was found and what to do next."
        focusTarget
      >
        <DetailedChecks
          results={report.results}
          categories={report.categories}
          activeCategoryId={activeCategoryId}
          onCategoryChange={selectCategory}
        />
      </ReportSection>

      <ReportSection
        id="content-snapshot"
        title={sectionTitle("content-snapshot")}
        description="Sections, skill terms and parsing notes. Contact details are never displayed."
      >
        <ContentSnapshot resume={resume} />
      </ReportSection>
    </>
  );

  const mobileBar = (
    <MobileReportBar
      report={report}
      activeCategoryId={activeCategoryId}
      onInspectCategory={(categoryId) => {
        selectCategory(categoryId);
        if (categoryId) scrollToReportSection("detailed-checks");
      }}
    />
  );

  // The header only carries the output actions when it owns the rail. In the
  // `/check` shell the rail next to it already has Copy, Print and Clear, and
  // two sets of buttons for the same three jobs is how one of them stops being
  // used.
  const header = (withActions: boolean) => (
    <div id="score-summary" className="scroll-mt-24">
      <ReportHeader
        report={report}
        onCheckAnother={onCheckAnother}
        actions={withActions ? <ReportActions report={report} resume={resume} /> : undefined}
      />
    </div>
  );

  if (!rail) {
    return (
      <>
        <div ref={containerRef} className="flex flex-col gap-10">
          {header(false)}
          {sections}
        </div>
        {mobileBar}
      </>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-14"
      >
        <div className="flex min-w-0 flex-col gap-10">
          {header(true)}
          {sections}
        </div>

        <aside
          aria-label="Score and report navigation"
          // Below `lg` this column would stack under the whole report and push
          // the sticky bar's job into a second copy of the score. `MobileReportBar`
          // is the only rail at those widths.
          className="hidden min-w-0 lg:sticky lg:top-24 lg:self-start lg:block"
        >
          <ScoreRail
            report={report}
            resume={resume}
            onClearReport={onClearReport}
            activeCategoryId={activeCategoryId}
            onInspectCategory={(categoryId) => {
              selectCategory(categoryId);
              if (categoryId) scrollToReportSection("detailed-checks");
            }}
          />
        </aside>
      </div>
      {mobileBar}
    </>
  );
}