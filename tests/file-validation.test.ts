import { describe, expect, it } from "vitest";
import { validateResumeFile } from "@/lib/resume/file-validation";
import { MAX_UPLOAD_BYTES } from "@/config/scoring";
import { createDocx, createPdf, toFile } from "./document-fixtures";

function fileFrom(name: string, bytes: Uint8Array, type = "application/pdf"): File {
  return toFile(bytes, name, type);
}

describe("validateResumeFile", () => {
  it("accepts a real PDF", async () => {
    const pdf = createPdf([["Jane Doe", "jane.doe@example.com"]]);
    const result = await validateResumeFile(fileFrom("resume.pdf", pdf));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fileType).toBe("pdf");
      expect(result.value.fileName).toBe("resume.pdf");
    }
  });

  it("accepts a real DOCX", async () => {
    const docx = createDocx({ blocks: [{ text: "Jane Doe" }] });
    const result = await validateResumeFile(
      fileFrom("resume.docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.fileType).toBe("docx");
  });

  it("rejects unsupported extensions", async () => {
    const result = await validateResumeFile(fileFrom("resume.txt", new TextEncoder().encode("hello")));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unsupported-type");
  });

  it("rejects empty files", async () => {
    const result = await validateResumeFile(fileFrom("resume.pdf", new Uint8Array()));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("empty-file");
  });

  it("rejects files over the size limit", async () => {
    const oversized = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    const result = await validateResumeFile(fileFrom("resume.pdf", oversized));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("file-too-large");
      expect(result.error.message).toContain("5 MB");
    }
  });

  it("rejects a renamed file whose contents do not match the extension", async () => {
    const docx = createDocx();
    const result = await validateResumeFile(fileFrom("resume.pdf", docx));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unsupported-type");
      expect(result.error.message).toContain("does not match");
    }
  });

  it("rejects a file that looks like neither PDF nor DOCX", async () => {
    const result = await validateResumeFile(fileFrom("resume.pdf", new TextEncoder().encode("%DOC not really")));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unsupported-type");
  });

  it("does not trust the browser-provided mime type", async () => {
    const pdf = createPdf([["text"]]);
    const result = await validateResumeFile(toFile(pdf, "resume.docx", "application/pdf"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("unsupported-type");
  });
});
