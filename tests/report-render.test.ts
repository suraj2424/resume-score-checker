/**
 * Component-level render tests for the report dashboard.
 *
 * These run in jsdom and render the real `ReportView` with a real computed
 * report, so the results UI is verified against actual scored data rather
 * than mocked output. Written with `createElement` because the project's
 * tsconfig uses `jsx: "preserve"` for Next.js.
 *
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ReportView } from "@/components/report/report-view";
import { buildParsedResume } from "@/lib/resume/analyze";
import { scoreResume } from "@/lib/resume/score-engine";
import { EXPERIENCED_RESUME, WEAK_WORDING_RESUME, sourceFromText } from "./resume-fixtures";
import { openAllDetails } from "@/components/ui/accordion";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderReport(text: string) {
  const resume = buildParsedResume(sourceFromText(text));
  const report = scoreResume(resume);
  await act(async () => {
    root.render(
      createElement(ReportView, {
        report,
        resume,
        onCheckAnother: () => {},
        onClearReport: () => {},
      }),
    );
  });
  return { report, resume };
}

function buttonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  );
}

describe("ReportView rendering", () => {
  it("renders the computed score, band and category breakdown", async () => {
    const { report } = await renderReport(EXPERIENCED_RESUME);

    expect(container.textContent).toContain(`${report.score}`);
    expect(container.textContent).toContain("/ 100");
    expect(container.textContent).toContain(report.scoreBand.label);
    expect(container.textContent).toContain("Structure and completeness");
    expect(container.textContent).toContain("Email address");

    // Category rows show real computed values, not placeholders.
    for (const category of report.categories) {
      expect(container.textContent).toContain(`${category.earned}/${category.possible}`);
    }
  });

  it("renders the file name of the analyzed document", async () => {
    await renderReport(EXPERIENCED_RESUME);
    expect(container.textContent).toContain("fixture-resume.docx");
  });

  it("shows priority fixes for a resume with issues", async () => {
    const { report } = await renderReport(WEAK_WORDING_RESUME);
    expect(report.recommendations.length).toBeGreaterThan(0);
    for (const recommendation of report.recommendations.slice(0, 3)) {
      expect(container.textContent).toContain(recommendation.title);
    }
    expect(container.textContent).toContain("What to do next");
  });

  it("filters detailed checks by status", async () => {
    const { report } = await renderReport(WEAK_WORDING_RESUME);

    await act(async () => {
      buttonByText("Issues")?.click();
    });

    expect(report.results.filter((result) => result.status === "issue").length).toBeGreaterThan(0);
    expect(container.textContent).toContain("Issue");

    await act(async () => {
      buttonByText("Passed")?.click();
    });
    expect(container.textContent).toContain("Passed");
  });

  it("shows an empty state when a filter matches nothing", async () => {
    const { report } = await renderReport(EXPERIENCED_RESUME);
    expect(report.results.filter((result) => result.status === "issue").length).toBe(0);

    await act(async () => {
      buttonByText("Issues")?.click();
    });
    expect(container.textContent).toContain("No checks match this filter");
  });

  it("expands every check for printing", async () => {
    await renderReport(EXPERIENCED_RESUME);
    expect(container.querySelectorAll("details").length).toBeGreaterThan(0);

    const previous = openAllDetails(container);
    expect(Array.from(container.querySelectorAll("details")).every((item) => item.open)).toBe(true);
    for (const [item, wasOpen] of previous) {
      item.open = wasOpen;
    }
  });

  it("displays parsing notes and detected sections in the snapshot", async () => {
    const { resume } = await renderReport(EXPERIENCED_RESUME);
    expect(container.textContent).toContain("Recognized sections");
    for (const section of resume.sections) {
      expect(container.textContent).toContain(section.heading);
    }
    expect(container.textContent).toContain("Words extracted");
  });

  it("never displays personal contact data anywhere in the report", async () => {
    await renderReport(EXPERIENCED_RESUME);
    const text = container.textContent ?? "";
    expect(text).not.toContain("jane.doe@example.com");
    expect(text).not.toContain("123-4567");
    expect(text).not.toContain("linkedin.com/in");
  });

  it("redacts contact details even when they appear inside a marked-up bullet", async () => {
    // The marked-up ledger renders whole bullet lines for the first time, so a
    // contact detail hidden inside a bullet must still never reach the report.
    const leaky = [
      "Jordan Avery",
      "jordan.avery@example.com",
      "",
      "EXPERIENCE",
      "- Responsible for the billing platform, contact 555-010-9944 or see linkedin.com/in/jordan",
      "- Worked on the migration with the team",
      "- Helped with on-call for the ledger service",
      "- Migrated the invoices table, reachable at jordan.avery@example.com for details",
      "",
      "EDUCATION",
      "BSc Computer Science, Example University, 2014 - 2018",
      "",
      "SKILLS",
      "Python, Go, Postgres, Redis, Kafka, Docker, Kubernetes, AWS, Terraform, React",
    ].join("\n");

    const { resume } = await renderReport(leaky);
    // The engine still sees the real text, which is why contact checks can pass.
    expect(resume.contact.hasEmail).toBe(true);

    const text = container.textContent ?? "";
    expect(text).toContain("marked up");
    expect(text).not.toContain("jordan.avery@example.com");
    expect(text).not.toContain("555-010-9944");
    expect(text).not.toContain("linkedin.com/in/jordan");
    expect(text).toContain("[email removed]");
    expect(text).toContain("[phone removed]");
    expect(text).toContain("[link removed]");
    // A truncated label is worse than none: it tells the reader nothing.
    expect(text).not.toMatch(/\[(email|link|phone)[a-z ]*…/i);
  });
});
