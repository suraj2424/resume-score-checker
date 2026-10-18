import { buildParsedResume } from "./analyze";
import { scoreResume } from "./score-engine";
import type { SourceDocument } from "./types";
import type { ParsedResume, ScoreReport } from "./types";
import { AppError } from "../utils/errors";

/**
 * Budget for the whole analysis, parsing included.
 *
 * It used to wrap the parser alone, which is the wrong half to measure: on a
 * large document the pure stages - normalize, section detection, 30 rules - are
 * where the time goes, and an un-wrapped throw there took down the upload with
 * an unhandled error instead of a message the uploader already knows how to
 * render.
 */
const ANALYSIS_TIMEOUT_MS = 60_000;

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
    }, ANALYSIS_TIMEOUT_MS);

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
 * Turn any failure in the pure stages into the error shape the uploader already
 * renders.
 *
 * A single rule that reads a field this analyzer does not produce should cost
 * the reader a sentence they can act on, not a blank screen: the file parsed
 * fine, so the message says what that means and what to try instead.
 */
function asAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError({
    code: "parse-failed",
    message:
      "This document could not be analyzed. The file was read successfully, but something in its content could not be measured.",
    hint: "Check that the document opens normally in its original editor, then upload it again. If it opens fine, a simpler export of the same resume will also work.",
    retryable: true,
    cause: error,
  });
}

/**
 * Validate, parse and score a resume file entirely on the device.
 *
 * The file's ArrayBuffer is read once, and both the validator and the parser are
 * loaded lazily: `file-validation` is the only zod user in the codebase, and a
 * static import here put a 5.9 MB on-disk dependency into the eagerly-loaded
 * graph for a ten-line schema. Nothing is uploaded, logged or stored.
 */
export async function analyzeResumeFile(file: File): Promise<ResumeAnalysisOutcome> {
  // Behind the dynamic boundary with the parsers, not at module scope.
  const { validateResumeFile } = await import("./file-validation");
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

  const isPdf = validation.value.fileType === "pdf";

  return withTimeout(
    (async (): Promise<ResumeAnalysisOutcome> => {
      const parse = isPdf
        ? await import("./pdf-parser").then((mod) => mod.extractPdfText(buffer, file.name))
        : await import("./docx-parser").then((mod) => mod.extractDocxText(buffer, file.name));

      if (!hasMeaningfulText(parse)) {
        throw new AppError({
          code: "no-text-extracted",
          message:
            "No readable text was found in this document. Scanned or image-only pages have no selectable text to analyze.",
          hint: "This tool does not perform OCR. Convert the resume to a text-based PDF or DOCX where the text is selectable (e.g. export or Print to PDF from the original editor, or run OCR there first), then upload again.",
        });
      }

      try {
        const resume = buildParsedResume(parse);
        const report = scoreResume(resume);
        return { resume, report };
      } catch (error) {
        throw asAppError(error);
      }
    })(),
    isPdf
      ? "Reading and scoring this PDF took too long and was stopped."
      : "Reading and scoring this DOCX took too long and was stopped.",
  );
}
