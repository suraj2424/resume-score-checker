import { z } from "zod";
import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/config/scoring";
import type { ResumeFileType } from "./types";
import { AppError } from "../utils/errors";

const EXTENSION_TO_TYPE: Record<AcceptedExtensionLike, ResumeFileType> = {
  pdf: "pdf",
  docx: "docx",
};

type AcceptedExtensionLike = (typeof ACCEPTED_EXTENSIONS)[number];

/** Structured validation of the file's declared metadata. */
export const resumeFileSchema = z.object({
  fileName: z.string().min(1, "File name is missing."),
  fileSize: z
    .number()
    .int("File size is invalid.")
    .nonnegative("File size is invalid.")
    .max(MAX_UPLOAD_BYTES, "The file is larger than the 5 MB limit."),
  extension: z.enum(ACCEPTED_EXTENSIONS),
});

export type ResumeFileSchema = z.infer<typeof resumeFileSchema>;

export interface ValidatedResumeFile {
  fileType: ResumeFileType;
  fileName: string;
  fileSize: number;
}

export type FileValidationResult =
  | { ok: true; value: ValidatedResumeFile }
  | { ok: false; error: AppError };

const MAGIC_SIGNATURES: Array<{ fileType: ResumeFileType; bytes: number[] }> = [
  { fileType: "pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { fileType: "docx", bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK\x03\x04 (ZIP container)
];

function matchesSignature(header: Uint8Array, fileType: ResumeFileType): boolean {
  const signature = MAGIC_SIGNATURES.find((entry) => entry.fileType === fileType);
  if (!signature) return false;
  return signature.bytes.every((byte, index) => header[index] === byte);
}

function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
}

/**
 * Validate an uploaded file by extension, size and magic bytes.
 *
 * The browser-provided MIME type is never trusted: DOCX and PDF files are
 * both binary containers, so the first bytes of the file are checked against
 * known signatures to catch renamed or corrupted files.
 */
export async function validateResumeFile(file: File): Promise<FileValidationResult> {
  const extension = extensionOf(file.name);

  const parsed = resumeFileSchema.safeParse({
    fileName: file.name,
    fileSize: file.size,
    extension,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const code = issue?.path[0] === "fileSize" ? "file-too-large" : "unsupported-type";
    const message =
      code === "file-too-large"
        ? "The file is larger than the 5 MB limit. Try saving a compressed or optimized PDF."
        : "That file type is not supported. Upload a PDF or DOCX file.";
    return {
      ok: false,
      error: new AppError({ code, message, retryable: false }),
    };
  }

  if (file.size === 0) {
    return {
      ok: false,
      error: new AppError({
        code: "empty-file",
        message: "That file appears to be empty. Choose a file that contains your resume.",
      }),
    };
  }

  let header: Uint8Array;
  try {
    const buffer = await file.slice(0, 16).arrayBuffer();
    header = new Uint8Array(buffer);
  } catch {
    return {
      ok: false,
      error: new AppError({
        code: "unknown",
        message: "The file could not be read from your device.",
      }),
    };
  }

  const expectedType = EXTENSION_TO_TYPE[parsed.data.extension];
  const hasExpectedSignature = matchesSignature(header, expectedType);
  const hasAnyKnownSignature = MAGIC_SIGNATURES.some((signature) =>
    matchesSignature(header, signature.fileType),
  );

  if (!hasExpectedSignature) {
    if (hasAnyKnownSignature) {
      return {
        ok: false,
        error: new AppError({
          code: "unsupported-type",
          message: `The file extension (.${parsed.data.extension}) does not match its contents. Upload a PDF or DOCX file whose extension matches the actual format.`,
        }),
      };
    }
    return {
      ok: false,
      error: new AppError({
        code: "unsupported-type",
        message:
          "That file does not look like a valid PDF or DOCX document. If you exported it from another app, re-export it as PDF or DOCX.",
      }),
    };
  }

  return {
    ok: true,
    value: {
      fileType: parsed.data.extension === "pdf" ? "pdf" : "docx",
      fileName: file.name,
      fileSize: file.size,
    },
  };
}
