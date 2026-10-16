import { validateResumeFile } from "./file-validation";
import { buildParsedResume } from "./analyze";
import { scoreResume } from "./score-engine";
import type { SourceDocument } from "./types";
import type { ParsedResume, ScoreReport } from "./types";
import { AppError } from "../utils/errors";

/** Safety net so parsing can never hang forever. */
const PARSE_TIMEOUT_MS = 60_000;

export interface ResumeAnalysisOutcome {
  resume: ParsedResume;
  report: ScoreReport;
}

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new AppError({
          code: "parse-failed",
          message,
          hint: "The file may be unusually large or complex. Try a different export and upload again.",
          retryable: true,
        }),
      );
    }, PARSE_TIMEOUT_MS);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Recognize documents whose text layer is effectively empty. */
function hasMeaningfulText(source: SourceDocument): boolean {
  return source.text.replace(/\s+/g, "").length >= 20;
}

/**
 * Validate, parse and score a resume file entirely on the device.
 *
 * The file's ArrayBuffer is read once, the parser is loaded lazily, and the
 * resulting text is analyzed in memory. Nothing is uploaded, logged or stored.
 */
export async function analyzeResumeFile(file: File): Promise<ResumeAnalysisOutcome> {
  const validation = await validateResumeFile(file);
  if (!validation.ok) {
    throw validation.error;
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new AppError({
      code: "parse-failed",
      message: "The file could not be read from your device.",
      retryable: true,
    });
  }

  const parse =
    validation.value.fileType === "pdf"
      ? await withTimeout(
          import("./pdf-parser").then((mod) => mod.extractPdfText(buffer, file.name)),
          "Reading the PDF took too long and was stopped.",
        )
      : await withTimeout(
          import("./docx-parser").then((mod) => mod.extractDocxText(buffer, file.name)),
          "Reading the DOCX took too long and was stopped.",
        );

  if (!hasMeaningfulText(parse)) {
    throw new AppError({
      code: "no-text-extracted",
      message:
        "No readable text was found in this document. Scanned or image-only pages have no selectable text to analyze.",
      hint: "This tool does not perform OCR. Convert the resume to a text-based PDF or DOCX where the text is selectable (e.g. export or Print to PDF from the original editor, or run OCR there first), then upload again.",
    });
  }

  const resume = buildParsedResume(parse);
  const report = scoreResume(resume);
  return { resume, report };
}
