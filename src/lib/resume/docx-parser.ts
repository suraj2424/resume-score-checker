import { strFromU8, unzipSync } from "fflate";
import mammoth from "mammoth";
import { AppError } from "../utils/errors";
import type { ParsingWarning, ResumeFileType, SourceDocument } from "./types";

/** Guard against pathological extraction sizes (the upload cap is 5 MB). */
const MAX_EXTRACTED_CHARS = 1_500_000;

interface DocxStructureFacts {
  tableCount: number;
  hasColumns: boolean;
  hasHeaderFooter: boolean;
  hyperlinkCount: number;
}

/**
 * Inspect the DOCX package for structural facts that affect how reliably text
 * can be extracted: tables, multi-column sections, headers/footers and
 * hyperlinks. The zip is read defensively; a malformed package only means the
 * structural facts are unavailable.
 */
function inspectDocxStructure(bytes: Uint8Array): DocxStructureFacts | null {
  try {
    const zip = unzipSync(bytes);
    const documentXml = strFromU8(zip["word/document.xml"] ?? new Uint8Array());
    if (documentXml.length === 0) return null;

    const tableCount = (documentXml.match(/<w:tbl>/g) ?? []).length;

    // A section with more than one text column, e.g. <w:cols w:num="2" .../>
    const columnSpecs = documentXml.match(/<w:cols[^>]*>/g) ?? [];
    const hasColumns = columnSpecs.some((spec) => {
      const num = spec.match(/w:num="(\d+)"/);
      return num ? Number(num[1]) > 1 : false;
    });

    const hasHeaderFooter = Object.keys(zip).some((path) =>
      /^word\/(header|footer)\d*\.xml$/.test(path),
    );

    const hyperlinkCount = (documentXml.match(/<w:hyperlink\b/g) ?? []).length;

    return { tableCount, hasColumns, hasHeaderFooter, hyperlinkCount };
  } catch {
    return null;
  }
}

/**
 * Extract text from a DOCX file using Mammoth (local, in-browser extraction)
 * plus a structural inspection of the underlying package.
 */
export async function extractDocxText(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<SourceDocument> {
  const warnings: ParsingWarning[] = [];

  let value: string;
  try {
    // `arrayBuffer` is used by the browser build of mammoth; `buffer` is used
    // by its Node build. Passing both keeps parsing identical in the browser
    // and in automated tests.
    const result = await mammoth.extractRawText({
      buffer,
      arrayBuffer: buffer,
    } as unknown as Parameters<typeof mammoth.extractRawText>[0]);
    value = result.value;
    for (const message of result.messages.slice(0, 3)) {
      warnings.push({
        code: `mammoth-${message.type}`,
        message: message.message,
      });
    }
  } catch (error) {
    throw new AppError({
      code: "parse-failed",
      message: "The DOCX file could not be read. It may be corrupted or not a real Word document.",
      hint: "Open the file in Word or Google Docs, re-save it as DOCX, then try again.",
      retryable: true,
      cause: error,
    });
  }

  const facts = inspectDocxStructure(new Uint8Array(buffer));

  let text = value;
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
    fileType: "docx" as ResumeFileType,
    text,
    // DOCX files do not store page counts; the analyzer estimates length.
    pageCount: undefined,
    structure: facts
      ? {
          tableCount: facts.tableCount,
          hasColumns: facts.hasColumns,
          hasHeaderFooter: facts.hasHeaderFooter,
          hyperlinkCount: facts.hyperlinkCount,
        }
      : undefined,
    warnings,
  };
}
