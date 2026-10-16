import { describe, expect, it } from "vitest";
import { analyzeResumeFile } from "@/lib/resume/analyze-file";
import { buildParsedResume } from "@/lib/resume/analyze";
import { extractDocxText } from "@/lib/resume/docx-parser";
import { extractPdfText } from "@/lib/resume/pdf-parser";
import { createDocx, createPdf, toFile } from "./document-fixtures";
import { EXPERIENCED_RESUME, FRESHER_RESUME, sourceFromText } from "./resume-fixtures";
import { isAppError } from "@/lib/utils/errors";

describe("PDF parsing", () => {
  it("extracts selectable text from a real PDF", async () => {
    const pdf = createPdf([
      ["Jane Doe", "jane.doe@example.com"],
      ["EXPERIENCE", "Senior Engineer, Acme, Mar 2021 - Present"],
    ]);
    const result = await extractPdfText(pdf.buffer as ArrayBuffer, "resume.pdf");

    expect(result.fileType).toBe("pdf");
    expect(result.pageCount).toBe(2);
    expect(result.text).toContain("Jane Doe");
    expect(result.text).toContain("jane.doe@example.com");
    expect(result.text).toContain("Senior Engineer");
    expect(result.structure?.imageOnlyPages).toEqual([]);
  });

  it("keeps page boundaries as blank lines", async () => {
    const pdf = createPdf([["page one line"], ["page two line"]]);
    const result = await extractPdfText(pdf.buffer as ArrayBuffer, "resume.pdf");
    expect(result.text).toContain("page one line\n\npage two line");
  });

  it("reports pages that contain images but no text", async () => {
    const pdf = createPdf([["First page with text"], []], { imageOnLastPage: true });
    const result = await extractPdfText(pdf.buffer as ArrayBuffer, "scanned.pdf");
    expect(result.structure?.imageOnlyPages).toEqual([2]);
    expect(result.warnings.some((warning) => warning.code === "image-only-pages")).toBe(true);
  });

  it("does not attempt OCR and surfaces the limitation in parsing warnings", async () => {
    const pdf = createPdf([[]], { imageOnLastPage: true });
    const result = await extractPdfText(pdf.buffer as ArrayBuffer, "scanned.pdf");
    const warning = result.warnings.find((entry) => entry.code === "image-only-pages");
    expect(warning?.message.toLowerCase()).toContain("does not perform ocr");
  });
});

describe("DOCX parsing", () => {
  it("extracts paragraphs and detects structure", async () => {
    const docx = createDocx({
      blocks: [
        { text: "Jane Doe", heading: false },
        { text: "EXPERIENCE", heading: true },
        { text: "Engineer, Acme, Mar 2021 - Present" },
      ],
      tables: [["Skill", "Years"]],
      columns: true,
      header: true,
      hyperlinks: ["https://example.com/portfolio"],
    });

    const result = await extractDocxText(docx.buffer as ArrayBuffer, "resume.docx");

    expect(result.fileType).toBe("docx");
    expect(result.text).toContain("Jane Doe");
    expect(result.text).toContain("EXPERIENCE");
    expect(result.text).toContain("Engineer, Acme");
    expect(result.text).toContain("Skill");
    expect(result.text).toContain("https://example.com/portfolio");
    expect(result.structure?.tableCount).toBe(1);
    expect(result.structure?.hasColumns).toBe(true);
    expect(result.structure?.hasHeaderFooter).toBe(true);
    expect(result.structure?.hyperlinkCount).toBe(1);
    expect(result.pageCount).toBeUndefined();
  });

  it("treats a document without tables or columns as single flow", async () => {
    const docx = createDocx({ blocks: [{ text: "Only text" }] });
    const result = await extractDocxText(docx.buffer as ArrayBuffer, "plain.docx");
    expect(result.structure?.tableCount).toBe(0);
    expect(result.structure?.hasColumns).toBe(false);
    expect(result.structure?.hasHeaderFooter).toBe(false);
  });

  it("raises a recoverable error for a corrupted DOCX", async () => {
    const bytes = new TextEncoder().encode("this is not a zip file at all");
    await expect(extractDocxText(bytes.buffer as ArrayBuffer, "broken.docx")).rejects.toSatisfy(
      isAppError,
    );
  });
});

describe("full analysis pipeline", () => {
  it("validates, parses and scores a real PDF end to end", async () => {
    const lines = EXPERIENCED_RESUME.split("\n");
    const pdf = createPdf([lines]);
    const file = toFile(pdf, "experienced.pdf", "application/pdf");

    const { resume, report } = await analyzeResumeFile(file);

    expect(resume.fileName).toBe("experienced.pdf");
    expect(report.fileName).toBe("experienced.pdf");
    expect(report.score).toBeGreaterThanOrEqual(70);
    expect(report.categories).toHaveLength(5);
    expect(resultsFor(report, "contact-email").status).toBe("pass");
  });

  it("validates, parses and scores a real DOCX end to end", async () => {
    const docx = createDocx({
      blocks: FRESHER_RESUME.split("\n").map((text) => ({ text })),
    });
    const file = toFile(docx, "fresher.docx");

    const { report } = await analyzeResumeFile(file);
    expect(report.score).toBeGreaterThan(0);
    expect(resultsFor(report, "structure-experience").status).toBe("pass");
  });

  it("rejects a renamed DOCX uploaded as PDF", async () => {
    const docx = createDocx();
    const file = toFile(docx, "resume.pdf", "application/pdf");
    await expect(analyzeResumeFile(file)).rejects.toSatisfy(isAppError);
  });

  it("reports a document with no extractable text as a distinct, recoverable error", async () => {
    const pdf = createPdf([[]]);
    const file = toFile(pdf, "blank.pdf", "application/pdf");

    await expect(analyzeResumeFile(file)).rejects.toMatchObject({
      code: "no-text-extracted",
    });
  });

  it("produces identical reports when the same document is analyzed twice", async () => {
    const docx = createDocx({
      blocks: FRESHER_RESUME.split("\n").map((text) => ({ text })),
    });
    const first = await analyzeResumeFile(toFile(docx, "resume.docx"));
    const second = await analyzeResumeFile(toFile(docx, "resume.docx"));
    expect(first.report.score).toBe(second.report.score);
    expect(first.report.results.map((r) => r.status)).toEqual(
      second.report.results.map((r) => r.status),
    );
  });

  it("normalizes before scoring so identical text with different whitespace scores the same", () => {
    const tidy = buildParsedResume(sourceFromText(EXPERIENCED_RESUME));
    const messy = buildParsedResume(
      sourceFromText(EXPERIENCED_RESUME.replace(/\n/g, "\r\n \t ").replace(/ {2,}/g, "  ")),
    );
    expect(tidy.normalizedText).toBe(messy.normalizedText);
  });
});

function resultsFor(
  report: { results: Array<{ checkId: string; status: string }> },
  checkId: string,
) {
  const result = report.results.find((entry) => entry.checkId === checkId);
  if (!result) throw new Error(`Missing check: ${checkId}`);
  return result;
}
