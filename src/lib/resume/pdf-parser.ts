// The shim must evaluate before pdfjs-dist is loaded.
import "./promise-shims";
import { AppError } from "../utils/errors";
import type { ParsingWarning, ResumeFileType, SourceDocument } from "./types";

/** Guard against pathological extraction sizes (the upload cap is 5 MB). */
const MAX_EXTRACTED_CHARS = 1_500_000;

interface PdfjsNamespace {
  GlobalWorkerOptions: { workerSrc?: string };
  getDocument: (params: { data: Uint8Array; isEvalSupported: boolean }) => {
    promise: Promise<PdfDocument>;
  };
  OPS: Record<string, number | undefined>;
}

interface PdfDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
}

interface PdfPage {
  getTextContent: () => Promise<TextContent>;
  getOperatorList: () => Promise<OperatorList>;
}

interface TextItem {
  str: string;
  transform: number[];
  hasEOL?: boolean;
}

interface TextContent {
  items: Array<TextItem | { str?: undefined }>;
}

interface OperatorList {
  fnArray: number[];
}

/**
 * The PDF worker is loaded from the bundled copy of pdfjs-dist, so no network
 * request is needed at runtime and the document never leaves the browser.
 */
const WORKER_URL = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

let pdfjsPromise: Promise<PdfjsNamespace> | null = null;

/**
 * Load pdf.js on demand.
 *
 * Browsers use the modern build with a bundled worker. Node (automated
 * tests) requires pdf.js's legacy build, which is why this is a runtime
 * decision instead of a static import.
 */
async function loadPdfjs(): Promise<PdfjsNamespace> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      if (typeof window !== "undefined") {
        const modern = (await import("pdfjs-dist")) as unknown as PdfjsNamespace;
        modern.GlobalWorkerOptions.workerSrc = WORKER_URL;
        return modern;
      }
      const legacy = (await import(
        "pdfjs-dist/legacy/build/pdf.mjs"
      )) as unknown as PdfjsNamespace;
      return legacy;
    })();
  }
  return pdfjsPromise;
}

/** pdf.js marks password-protected documents by name and by error code 1. */
function isPasswordException(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: string; code?: number };
  return candidate.name === "PasswordException" || candidate.code === 1;
}

/**
 * Extract text from a PDF, preserving line and page structure.
 *
 * Returns the page count, the extracted text, and which pages contain no text
 * at all (which usually means the page is an image and would need OCR, a
 * capability this tool deliberately does not have).
 */
export async function extractPdfText(buffer: ArrayBuffer, fileName: string): Promise<SourceDocument> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(buffer);
  const warnings: ParsingWarning[] = [];

  let document: PdfDocument;
  try {
    const loadingTask = pdfjs.getDocument({ data, isEvalSupported: false });
    document = await loadingTask.promise;
  } catch (error) {
    if (isPasswordException(error)) {
      throw new AppError({
        code: "parse-failed",
        message: "This PDF is password protected and could not be opened.",
        hint: "Remove the password, or export a new PDF without protection, and try again.",
        retryable: true,
        cause: error,
      });
    }
    throw new AppError({
      code: "parse-failed",
      message: "The PDF could not be read. It may be corrupted or use an unsupported format.",
      hint: "Try re-exporting the file as a new PDF, then upload again.",
      retryable: true,
      cause: error,
    });
  }

  const pageTexts: string[] = [];
  const imageOnlyPages: number[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();

      const lines = reconstructLines(textContent.items);
      if (lines.length === 0 && (await pageHasImages(page, pdfjs))) {
        imageOnlyPages.push(pageNumber);
      }
      pageTexts.push(lines.join("\n"));
    }
  } catch (error) {
    throw new AppError({
      code: "parse-failed",
      message: "The PDF could not be read completely. Some pages may be corrupted.",
      hint: "Try re-exporting the file, then upload again.",
      retryable: true,
      cause: error,
    });
  } finally {
    void document.destroy().catch(() => undefined);
  }

  if (imageOnlyPages.length > 0) {
    warnings.push({
      code: "image-only-pages",
      message: `Page ${imageOnlyPages.join(", ")} ${imageOnlyPages.length === 1 ? "contains" : "contain"} no selectable text. This tool does not perform OCR, so image-based content cannot be analyzed.`,
    });
  }

  let text = pageTexts.join("\n\n");
  if (text.length > MAX_EXTRACTED_CHARS) {
    text = text.slice(0, MAX_EXTRACTED_CHARS);
    warnings.push({
      code: "text-truncated",
      message:
        "The document is very large. Only the beginning of the extracted text was analyzed.",
    });
  }

  return {
    fileName,
    fileType: "pdf" as ResumeFileType,
    text,
    pageCount: Number.isFinite(document.numPages) ? document.numPages : 0,
    structure: { imageOnlyPages },
    warnings,
  };
}

/** Group text items into lines using their vertical position. */
function reconstructLines(items: Array<TextItem | { str?: undefined }>): string[] {
  const lines: string[] = [];
  let current: string[] = [];
  let lastY: number | null = null;

  const flush = () => {
    const text = current.join("").replace(/\s+/g, " ").trim();
    if (text.length > 0) lines.push(text);
    current = [];
    lastY = null;
  };

  for (const item of items) {
    const textItem = item as TextItem;
    if (typeof textItem.str !== "string") continue;
    const y = textItem.transform?.[5];
    if (typeof y !== "number") {
      current.push(textItem.str);
      continue;
    }
    if (lastY !== null && Math.abs(y - lastY) > 2.5) {
      flush();
    }
    current.push(textItem.str);
    lastY = y;
    if (textItem.hasEOL) {
      flush();
    }
  }
  flush();
  return lines;
}

async function pageHasImages(page: PdfPage, pdfjs: PdfjsNamespace): Promise<boolean> {
  try {
    const operatorList = await page.getOperatorList();
    const imageOps = [
      pdfjs.OPS.paintImageXObject,
      pdfjs.OPS.paintInlineImageXObject,
      pdfjs.OPS.paintImageMaskXObject,
    ].filter((op): op is number => typeof op === "number");
    return operatorList.fnArray.some((fn) => imageOps.includes(fn));
  } catch {
    return false;
  }
}
