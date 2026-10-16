import { describe, expect, it } from "vitest";
import { buildParsedResume } from "@/lib/resume/analyze";
import { scoreResume } from "@/lib/resume/score-engine";
import { WARNING_CREDIT } from "@/config/scoring";
import { sourceFromText } from "./resume-fixtures";
import {
  DUPLICATE_BULLETS_RESUME,
  EXPERIENCED_RESUME,
  FIRST_PERSON_RESUME,
  FRESHER_RESUME,
  GENERIC_SKILLS_RESUME,
  INCONSISTENT_DATES_RESUME,
  MINIMAL_RESUME,
  MIXED_HEADINGS_RESUME,
  NO_SECTIONS_RESUME,
  SCANNED_LIKE_RESUME,
  WEAK_WORDING_RESUME,
  CLEAN_PUNCTUATION_RESUME,
  GLYPH_HEAVY_RESUME,
  LONG_SUMMARY_RESUME,
  OUT_OF_ORDER_RESUME,
} from "./resume-fixtures";
import type { ScoreReport } from "@/lib/resume/types";

function reportFor(text: string): ScoreReport {
  return scoreResume(buildParsedResume(sourceFromText(text)));
}

function resultFor(report: ScoreReport, checkId: string) {
  const result = report.results.find((entry) => entry.checkId === checkId);
  if (!result) throw new Error(`Missing check result: ${checkId}`);
  return result;
}

describe("structure rules", () => {
  it("passes every structure check for a complete experienced resume", () => {
    const report = reportFor(EXPERIENCED_RESUME);
    for (const checkId of [
      "structure-experience",
      "structure-education",
      "structure-skills-section",
      "structure-projects",
      "structure-recognizable-headings",
    ]) {
      expect(resultFor(report, checkId).status).toBe("pass");
    }
  });

  it("does not penalize freshers for lacking employment history", () => {
    const report = reportFor(FRESHER_RESUME);
    const experience = resultFor(report, "structure-experience");
    expect(experience.status).toBe("pass");
    expect(experience.explanation.toLowerCase()).toContain("internship");
    expect(resultFor(report, "structure-education").status).toBe("pass");
    expect(resultFor(report, "structure-projects").status).toBe("pass");
  });

  it("flags a missing experience section as an issue when there is no equivalent", () => {
    const report = reportFor(NO_SECTIONS_RESUME);
    const experience = resultFor(report, "structure-experience");
    expect(experience.status).toBe("issue");
    expect(experience.recommendation).toBeTruthy();
  });

  it("marks structure checks unable-to-verify for documents with almost no text", () => {
    const report = reportFor(MINIMAL_RESUME);
    expect(resultFor(report, "structure-experience").status).toBe("unable-to-verify");
    expect(resultFor(report, "structure-education").status).toBe("unable-to-verify");
    expect(report.coverage.checksEvaluated).toBeLessThan(report.coverage.checksTotal);
  });

  it("marks projects not-applicable for experienced profiles without a projects section", () => {
    const resume = `Alex Chen
alex.chen@example.com | +1 555 010 1010 | linkedin.com/in/alexchen

SUMMARY
Platform engineer with five years of experience operating large distributed systems in production environments.

EXPERIENCE
Staff Engineer, Example Cloud, Jan 2020 - Dec 2023
- Built internal developer tooling used daily by 200 engineers
- Migrated 14 services to Kubernetes with zero downtime
- Reduced infrastructure spend by 18% through right-sizing and autoscaling
- Mentored 4 engineers through the promotion cycle

Senior Engineer, Example Data, Mar 2017 - Dec 2019
- Operated a 60 node Hadoop cluster with 99.9% uptime
- Automated cluster provisioning, cutting setup time from 3 days to 2 hours

EDUCATION
B.S. Software Engineering, Example University, Sep 2013 - Jun 2017

SKILLS
Python, Go, Kubernetes, Terraform, AWS, Docker, Linux, PostgreSQL, Redis, CI/CD, observability, Grafana, Prometheus`;
    const report = reportFor(resume);
    const projects = resultFor(report, "structure-projects");
    expect(projects.status).toBe("not-applicable");
    expect(projects.pointsPossible).toBe(0);
  });

  it("never claims every bullet needs a number", () => {
    const report = reportFor(
      [
        "Dana Fox",
        "dana.fox@example.com | 555-010-7777",
        "",
        "EXPERIENCE",
        "Analyst, Example Retail, Mar 2022 - Present",
        "- Cleaned and reconciled daily sales reports for 8 storefronts",
        "- Built a weekly inventory forecast used by the buying team",
        "- Standardized the vendor onboarding checklist for the region",
        "- Supported month-end close reporting for the finance team",
        "- Documented the new returns process for store staff",
        "- Coordinated the migration of a legacy reporting system",
        "- Trained new analysts on reporting standards",
        "- Reviewed weekly dashboards for data quality issues",
        "",
        "EDUCATION",
        "B.A. Economics, Example College, Sep 2018 - Jun 2022",
        "",
        "SKILLS",
        "Excel, SQL, forecasting, data analysis, process documentation, stakeholder management",
      ].join("\n"),
    );
    const quantified = resultFor(report, "content-quantified-outcomes");
    expect(["warning", "issue"]).toContain(quantified.status);
    expect(quantified.recommendation?.toLowerCase()).not.toContain("must");
    expect(quantified.recommendation?.toLowerCase()).toContain("not every bullet needs a number");
  });
});

describe("content rules", () => {
  it("passes bullet quality checks for a strong resume", () => {
    const report = reportFor(EXPERIENCED_RESUME);
    for (const checkId of [
      "content-bullet-formatting",
      "content-bullet-length",
      "content-bullet-conciseness",
      "content-action-verbs",
      "content-quantified-outcomes",
      "content-duplicate-bullets",
      "content-first-person",
      "content-weak-wording",
    ]) {
      expect(resultFor(report, checkId).status).toBe("pass");
    }
  });

  it("flags weak wording", () => {
    const report = reportFor(WEAK_WORDING_RESUME);
    expect(resultFor(report, "content-weak-wording").status).toBe("issue");
  });

  it("flags first-person language", () => {
    const report = reportFor(FIRST_PERSON_RESUME);
    const status = resultFor(report, "content-first-person").status;
    expect(["warning", "issue"]).toContain(status);
  });

  it("flags repeated bullet wording without duplicating points", () => {
    const report = reportFor(DUPLICATE_BULLETS_RESUME);
    const duplicates = resultFor(report, "content-duplicate-bullets");
    expect(["warning", "issue"]).toContain(duplicates.status);
    expect(duplicates.pointsEarned).toBeLessThanOrEqual(duplicates.pointsPossible * WARNING_CREDIT + 0.001);
  });

  it("treats paragraph resumes as missing bullets, not as invented content", () => {
    const report = reportFor(NO_SECTIONS_RESUME);
    expect(resultFor(report, "content-bullet-formatting").status).toBe("issue");
    expect(resultFor(report, "content-action-verbs").status).toBe("not-applicable");
    // Never rewrites or invents achievements.
    expect(resultFor(report, "content-quantified-outcomes").status).toBe("not-applicable");
  });

  it("never rewrites bullets into invented achievements", () => {
    const issue = reportFor(WEAK_WORDING_RESUME);
    const quantified = resultFor(issue, "content-quantified-outcomes");
    expect(quantified.recommendation?.toLowerCase()).toContain("never invent");
  });
});

describe("contact rules", () => {
  it("passes every contact check when everything is present", () => {
    const report = reportFor(EXPERIENCED_RESUME);
    for (const checkId of ["contact-email", "contact-phone", "contact-linkedin", "contact-additional-links"]) {
      expect(resultFor(report, checkId).status).toBe("pass");
    }
  });

  it("treats a missing LinkedIn as a warning, not an issue, when email and phone exist", () => {
    const report = reportFor(FRESHER_RESUME);
    const linkedin = resultFor(report, "contact-linkedin");
    expect(linkedin.status).toBe("warning");
    expect(linkedin.explanation.toLowerCase()).toContain("not a requirement");
  });

  it("flags a missing email as an issue", () => {
    const report = reportFor(
      `Robin Ash\nrobin\n+1 555 010 2222\n\nEXPERIENCE\nAssistant, Example Co, Jan 2020 - Dec 2022\n- Handled 40 customer calls per week`,
    );
    expect(resultFor(report, "contact-email").status).toBe("issue");
    expect(resultFor(report, "contact-phone").status).toBe("pass");
  });

  it("does not display personal contact data in evidence", () => {
    const report = reportFor(EXPERIENCED_RESUME);
    const serialized = JSON.stringify(report.results);
    expect(serialized).not.toContain("jane.doe@example.com");
    expect(serialized).not.toContain("555");
    expect(serialized).not.toContain("linkedin.com/in/janedoe");
  });
});

describe("readability rules", () => {
  it("passes date and heading consistency for a clean resume", () => {
    const report = reportFor(EXPERIENCED_RESUME);
    expect(resultFor(report, "readability-date-format").status).toBe("pass");
    expect(resultFor(report, "readability-heading-consistency").status).toBe("pass");
  });

  it("flags inconsistent date formats", () => {
    const report = reportFor(INCONSISTENT_DATES_RESUME);
    const dates = resultFor(report, "readability-date-format");
    expect(["issue", "warning"]).toContain(dates.status);
  });

  it("flags mixed heading casing", () => {
    const report = reportFor(MIXED_HEADINGS_RESUME);
    const headings = resultFor(report, "readability-heading-consistency");
    expect(headings.status).not.toBe("pass");
  });

  it("flags documents whose text cannot be extracted meaningfully", () => {
    const report = reportFor(SCANNED_LIKE_RESUME);
    expect(resultFor(report, "readability-extractable-text").status).toBe("issue");
  });

  it("never describes a layout risk as a proven ATS rejection", () => {
    const signals = buildParsedResume(sourceFromText(SCANNED_LIKE_RESUME)).formattingSignals;
    const explanations = signals.map((signal) => signal.explanation).join(" ");
    expect(explanations.toLowerCase()).not.toContain("will reject");
    expect(explanations.toLowerCase()).not.toContain("guarantee");
  });

  it("marks date consistency unable-to-verify when fewer than two dates exist", () => {
    const report = reportFor(MINIMAL_RESUME);
    expect(resultFor(report, "readability-date-format").status).toBe("unable-to-verify");
  });
});

describe("skills rules", () => {
  it("passes skills checks for a specific, well-listed skills section", () => {
    const report = reportFor(EXPERIENCED_RESUME);
    // Presence is measured once in structure (`structure-skills-section`);
    // the skills category measures breadth, specificity and scannability.
    expect(resultFor(report, "structure-skills-section").status).toBe("pass");
    for (const checkId of [
      "skills-term-breadth",
      "skills-generic-overuse",
      "skills-listed-clearly",
    ]) {
      expect(resultFor(report, checkId).status).toBe("pass");
    }
  });

  it("flags resumes that rely on generic buzzwords", () => {
    const report = reportFor(GENERIC_SKILLS_RESUME);
    const overuse = resultFor(report, "skills-generic-overuse");
    expect(["warning", "issue"]).toContain(overuse.status);
    expect(resultFor(report, "skills-term-breadth").status).toBe("issue");
  });

  it("does not fail the skills formatting check when there is no skills section", () => {
    const report = reportFor(
      `Kim Park\nkim@example.com\n\nEXPERIENCE\nEngineer, Example Co, Jan 2020 - Dec 2022\n- Built tools in Python and Docker`,
    );
    expect(resultFor(report, "skills-listed-clearly").status).toBe("not-applicable");
  });
});

/* ------------------------------------------------------------------ */
/* Tech Interview Handbook validations                                 */
/* ------------------------------------------------------------------ */

describe("handbook-derived rules", () => {
  it("flags roles listed oldest first", () => {
    const outOfOrder = resultFor(reportFor(OUT_OF_ORDER_RESUME), "structure-role-chronology");
    expect(["warning", "issue"]).toContain(outOfOrder.status);

    const ordered = resultFor(reportFor(EXPERIENCED_RESUME), "structure-role-chronology");
    expect(["pass", "unable-to-verify"]).toContain(ordered.status);
  });

  it("names the offending role so the finding is actionable", () => {
    const result = resultFor(reportFor(OUT_OF_ORDER_RESUME), "structure-role-chronology");
    expect(result.evidence?.length ?? 0).toBeGreaterThan(0);
    expect(result.recommendation).toBeTruthy();
  });

  it("sets aside the chronology check when there is nothing to compare", () => {
    const result = resultFor(reportFor(MINIMAL_RESUME), "structure-role-chronology");
    expect(["unable-to-verify", "not-applicable"]).toContain(result.status);
    expect(result.pointsPossible).toBe(0);
  });

  it("flags symbols in section headings", () => {
    const decorated = resultFor(reportFor(GLYPH_HEAVY_RESUME), "structure-plain-headings");
    expect(decorated.status).toBe("warning");
    expect(decorated.explanation).toContain("symbol");

    const clean = resultFor(reportFor(EXPERIENCED_RESUME), "structure-plain-headings");
    expect(clean.status).toBe("pass");
  });

  it("flags a summary longer than the 50-word guidance", () => {
    const long = resultFor(reportFor(LONG_SUMMARY_RESUME), "structure-summary-length");
    expect(["warning", "issue"]).toContain(long.status);
    expect(long.explanation).toMatch(/\d+ words/);
  });

  it("excludes the summary check rather than penalizing resumes without one", () => {
    const result = resultFor(reportFor(EXPERIENCED_RESUME), "structure-summary-length");
    expect(["not-applicable", "pass"]).toContain(result.status);
  });

  it("flags pictographic characters that a plain-text copy would mangle", () => {
    const glyphs = resultFor(reportFor(GLYPH_HEAVY_RESUME), "readability-character-set");
    expect(glyphs.status).toBe("warning");
    expect(glyphs.explanation).toMatch(/emoji/i);

    const clean = resultFor(reportFor(EXPERIENCED_RESUME), "readability-character-set");
    expect(clean.status).toBe("pass");
  });

it("does not mistake ordinary punctuation for pictographs", () => {
    const report = reportFor(CLEAN_PUNCTUATION_RESUME);
    expect(resultFor(report, "readability-character-set").status).toBe("pass");
    expect(resultFor(report, "structure-plain-headings").status).toBe("pass");
  });
});
