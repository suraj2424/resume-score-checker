// The shim must evaluate before pdfjs-dist is loaded.
import "./promise-shims";
import { AppError } from "../utils/errors";
import type { ParsingWarning, ResumeFileType, SourceDocument } from "./types";

/** Guard against pathological extraction sizes (the upload cap is 5 MB). */
const MAX_EXTRACTED_CHARS = 1_500_000;

/**
 * Page budget. A resume is one or two pages; the cap bounds the per-page
 * round trips so a pathological file cannot spin here indefinitely.
 */
const MAX_EXTRACTED_PAGES = 400;

/**
 * Text runs kept per page. A resume page holds a few hundred. The cap bounds
 * the sort, and the page that trips it is reported as ambiguous, because past
 * this point reading order is no longer observed but guessed.
 */
const MAX_TEXT_RUNS_PER_PAGE = 20_000;

/**
 * `getOperatorList` is a second full decode of the page's content stream.
 * Probing a few text-less pages tells a scanned resume from a blank one;
 * probing all of them is what makes a 200-page scan burn seconds before the
 * first rule runs.
 */
const MAX_IMAGE_PROBE_PAGES = 5;

/** A link target is a contact detail, not prose; only a few are folded in. */
const MAX_ANNOTATION_CONTACT_TOKENS = 8;
const MAX_ANNOTATION_LINK_LENGTH = 200;

/** Two runs further apart than this in y are on different lines. */
const LINE_Y_TOLERANCE = 2.5;

/**
 * A gap wider than this many ems is a gutter, not a word space: the widest
 * inter-word space in a proportional face is roughly a third of an em.
 */
const COLUMN_GAP_EM = 1.5;

/** ...with an absolute floor so small text does not flag every word gap. */
const MIN_COLUMN_GAP_PT = 8;

/**
 * A single split row proves nothing. Right-aligned dates sit in their own band
 * on a handful of rows of a strictly single-column resume, so a split is only
 * called a column when the same gutter repeats down the page.
 */
const MIN_COLUMN_SPLIT_ROWS = 3;
const MIN_COLUMN_SPLIT_RATIO = 0.5;

/** How far the gutter is allowed to wander between split rows. */
const COLUMN_EDGE_TOLERANCE_PT = 6;

/**
 * Box-drawing separator emitted between the bands of a split row. Ordinary text
 * never contains it, so the analyzer can tell a fused column apart from a
 * paragraph that simply wrapped.
 */
const COLUMN_BREAK_SENTINEL = "\u2502";

/** Rough advance width of a character, as a fraction of font size. */
const AVERAGE_CHAR_WIDTH_RATIO = 0.5;

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
  getAnnotations: (parameters?: { intent?: string }) => Promise<AnnotationData[]>;
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

/** Only the fields contact detection can use; the rest is pdf.js plumbing. */
interface AnnotationData {
  url?: string;
}

interface TextRun {
  str: string;
  x: number;
  y: number;
  fontSize: number;
}

interface PageLayout {
  lines: string[];
  /**
   * Lines the page's own gutter explains: split rows that repeat at the same
   * horizontal position. Raw split rows are not reported, because a
   * right-aligned date also sits in its own band and is not a column.
   */
  columnLineCount: number;
  /** The runs could not be ordered into lines with confidence. */
  ambiguous: boolean;
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
 *
 * The structural facts travel alongside the text because they are the only
 * evidence of reading order: how many lines were fused across a column gutter,
 * whether the layout is columnar, and which pages could not be ordered
 * confidently at all.
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
  const contactTokens: string[] = [];
  let inspectedPages = 0;
  let inferredPages = 0;
  let interleavedLineCount = 0;
  let ambiguousPageCount = 0;
  let detectedColumns = false;

  try {
    const pageCount = Math.min(document.numPages, MAX_EXTRACTED_PAGES);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();

      const layout = readPageLayout(textContent.items);
      interleavedLineCount += layout.columnLineCount;
      if (layout.ambiguous) ambiguousPageCount += 1;
      // A single-page document is all the evidence there is, and a page whose
      // own gutter explains half its rows is a column layout; a larger document
      // has to repeat the gutter on at least a few separate pages-worth of rows
      // before it is called one.
      if (
        layout.columnLineCount >= MIN_COLUMN_SPLIT_ROWS ||
        (pageCount === 1 && layout.columnLineCount > 0)
      ) {
        detectedColumns = true;
      }

      if (layout.lines.length === 0) {
        if (inspectedPages < MAX_IMAGE_PROBE_PAGES) {
          inspectedPages += 1;
          if (await pageHasImages(page, pdfjs)) imageOnlyPages.push(pageNumber);
        } else {
          // Past the probe budget a text-less page is reported on the
          // inference the probe would have made, and how many pages were
          // inferred rather than inspected is disclosed below.
          inferredPages += 1;
          imageOnlyPages.push(pageNumber);
        }
      }

      for (const token of await readContactLinkTokens(page)) {
        if (!contactTokens.includes(token)) contactTokens.push(token);
      }

      pageTexts.push(layout.lines.join("\n"));
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

  if (document.numPages > MAX_EXTRACTED_PAGES) {
    warnings.push({
      code: "pages-truncated",
      message: `This PDF has more than ${MAX_EXTRACTED_PAGES} pages. Only the first ${MAX_EXTRACTED_PAGES} were analyzed.`,
    });
  }

  if (imageOnlyPages.length > 0) {
    warnings.push({
      code: "image-only-pages",
      message: `Page ${imageOnlyPages.join(", ")} ${imageOnlyPages.length === 1 ? "contains" : "contain"} no selectable text. This tool does not perform OCR, so image-based content cannot be analyzed.`,
    });
  }

  if (inferredPages > 0) {
    warnings.push({
      code: "image-pages-inferred",
      message: `Only ${MAX_IMAGE_PROBE_PAGES} text-less pages could be inspected for images. ${inferredPages} further text-less ${inferredPages === 1 ? "page was" : "pages were"} reported the same way by inference.`,
    });
  }

  let text = pageTexts.join("\n\n");
  // Link targets carry the email and portfolio a resume keeps only as a
  // clickable annotation. They are appended as their own paragraph so they
  // reach contact detection without fusing into the resume's last line.
  if (contactTokens.length > 0) {
    text += `\n\n${contactTokens.slice(0, MAX_ANNOTATION_CONTACT_TOKENS).join("\n")}`;
  }

  if (text.length > MAX_EXTRACTED_CHARS) {
    warnings.push({
      code: "text-truncated",
      message:
        "The document is very large. Only the beginning of the extracted text was analyzed.",
    });
  }
  text = clampExtractedText(text);

  return {
    fileName,
    fileType: "pdf" as ResumeFileType,
    text,
    pageCount: Number.isFinite(document.numPages) ? document.numPages : 0,
    structure: {
      imageOnlyPages,
      hasColumns: detectedColumns,
      interleavedLineCount,
      ambiguousPageCount,
    },
    warnings,
  };
}

/**
 * Order one page's runs into lines.
 *
 * y alone is not enough: a two-column page puts two independent text flows on
 * the same visual row, and joining them produced a line no human ever wrote -
 * the exact "read in the wrong order" fault the analyzer warns about. Runs are
 * therefore bucketed by y, sorted by x inside the row, and split wherever the
 * gap between two runs is far wider than a word space.
 */
function readPageLayout(items: Array<TextItem | { str?: undefined }>): PageLayout {
  const runs: TextRun[] = [];
  let ambiguous = false;

  for (const item of items) {
    const textItem = item as TextItem;
    if (typeof textItem.str !== "string" || textItem.str.length === 0) continue;

    const transform = textItem.transform;
    const y = transform?.[5];
    const x = transform?.[4];
    if (
      typeof y !== "number" ||
      !Number.isFinite(y) ||
      typeof x !== "number" ||
      !Number.isFinite(x)
    ) {
      // No position means the line break is guesswork, which is exactly what
      // an ambiguous page is: the page is reported, not silently smoothed over.
      ambiguous = true;
      continue;
    }

    if (runs.length >= MAX_TEXT_RUNS_PER_PAGE) {
      ambiguous = true;
      continue;
    }

    const height = Math.hypot(transform?.[0] ?? 0, transform?.[3] ?? 0);
    runs.push({
      str: textItem.str,
      x,
      y,
      fontSize: height > 0 ? height : 1,
    });
  }

  const rows: TextRun[][] = [];
  let current: TextRun[] = [];
  let lastY: number | null = null;

  for (const run of runs) {
    if (lastY !== null && Math.abs(run.y - lastY) > LINE_Y_TOLERANCE) {
      rows.push(current);
      current = [];
    }
    current.push(run);
    lastY = run.y;
  }
  rows.push(current);

  const lines: string[] = [];
  const edgeCandidates: number[] = [];

  for (const row of rows) {
    const sorted = [...row].sort((left, right) => left.x - right.x);
    const bandStarts = detectBandStarts(sorted);

    if (bandStarts.length === 0) {
      const line = normalizeLine(sorted.map((run) => run.str));
      if (line !== null) lines.push(line);
      continue;
    }

    // The bands are separate text flows that merely share a baseline; each one
    // becomes its own line so nothing is fused across the gutter.
    let bandStart = 0;
    for (let band = 0; band <= bandStarts.length; band += 1) {
      const start = band < bandStarts.length ? bandStarts[band] : sorted.length;
      if (start === undefined) continue;
      const line = normalizeLine(sorted.slice(bandStart, start).map((run) => run.str));
      if (line !== null) {
        lines.push(bandStart === 0 ? line : `${COLUMN_BREAK_SENTINEL} ${line}`);
      }
      const edgeRun = sorted[start];
      if (edgeRun !== undefined) edgeCandidates.push(edgeRun.x);
      bandStart = start;
    }
  }

  return {
    lines,
    columnLineCount: countDominantEdges(edgeCandidates, rows.length),
    ambiguous,
  };
}

/**
 * Indexes at which a new horizontal band starts inside one visual row, or an
 * empty array when the row is a single band.
 *
 * A run's width is estimated from its character count because the raw text
 * items do not carry a reliable advance width; the estimate only has to tell a
 * gutter from a word space, and the caller refuses to trust a single split.
 */
function detectBandStarts(row: TextRun[]): number[] {
  const starts: number[] = [];
  for (let index = 1; index < row.length; index += 1) {
    const previous = row[index - 1];
    const current = row[index];
    if (previous === undefined || current === undefined) continue;

    const claimed = previous.str.length * previous.fontSize * AVERAGE_CHAR_WIDTH_RATIO;
    const fontSize = Math.max(previous.fontSize, current.fontSize);
    const gap = current.x - (previous.x + claimed);
    if (gap > Math.max(COLUMN_GAP_EM * fontSize, MIN_COLUMN_GAP_PT)) starts.push(index);
  }
  return starts;
}

/**
 * Count split rows that share the page's dominant gutter position. The mode,
 * not the average, so one outlier gutter cannot pull the answer off the real
 * column edge.
 */
function countDominantEdges(edges: number[], rowCount: number): number {
  if (edges.length === 0) return 0;
  if (rowCount > 0 && edges.length / rowCount < MIN_COLUMN_SPLIT_RATIO) return 0;

  let bestCount = 0;
  for (const candidate of edges) {
    let count = 0;
    for (const edge of edges) {
      if (Math.abs(edge - candidate) <= COLUMN_EDGE_TOLERANCE_PT) count += 1;
    }
    if (count > bestCount) bestCount = count;
  }
  return bestCount;
}

function normalizeLine(parts: string[]): string | null {
  const line = parts.join("").replace(/\s+/g, " ").trim();
  return line.length > 0 ? line : null;
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

/**
 * Read link targets off the page's annotations.
 *
 * A contact detail that exists only as a clickable link is still a contact
 * detail - an email written as a `mailto:` annotation is missing from the text
 * layer entirely, and the checks that read it cannot see what the reader sees.
 * Only the link target is folded in: annotation prose ("Click here") is
 * document chrome, and mixing it into the text would show up as resume content.
 */
async function readContactLinkTokens(page: PdfPage): Promise<string[]> {
  try {
    const annotations = await page.getAnnotations({ intent: "display" });
    const tokens: string[] = [];
    for (const annotation of annotations) {
      const url = annotation.url;
      if (typeof url !== "string" || url.length === 0) continue;
      const token = contactTokenFromUrl(url);
      if (token === null || tokens.includes(token)) continue;
      tokens.push(token);
      if (tokens.length >= MAX_ANNOTATION_CONTACT_TOKENS) break;
    }
    return tokens;
  } catch {
    return [];
  }
}

function contactTokenFromUrl(raw: string): string | null {
  if (raw.length > MAX_ANNOTATION_LINK_LENGTH) return null;

  const mailto = /^mailto:/i.exec(raw);
  if (mailto) {
    const address = decodeUriSafely(raw.slice(7).split("?")[0] ?? "").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? address : null;
  }

  const tel = /^tel:/i.exec(raw);
  if (tel) {
    const number = decodeUriSafely(raw.slice(4).split("?")[0] ?? "").replace(/[^\d+]/g, "");
    return number.length >= 7 ? number : null;
  }

  if (!/^https?:\/\//i.test(raw)) return null;
  const withoutScheme = raw.replace(/^https?:\/\//i, "");
  const host = (withoutScheme.split(/[/?#]/)[0] ?? "").toLowerCase();
  if (host.length === 0) return null;
  const path = withoutScheme.split(/[?#]/)[0] ?? "";
  return `${host}${path}`.replace(/\s+/g, " ").trim();
}

function decodeUriSafely(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Clamp to the extraction cap without leaving half a character behind.
 *
 * `slice` can cut between the two halves of an astral character, and the
 * orphaned surrogate is read as U+FFFD downstream - which the readability rules
 * would then report as an encoding fault in a file that encodes perfectly well.
 * The same helper exists in `docx-parser.ts`; the two parsers are separate
 * modules and a shared one would have to live outside `lib/resume`, which this
 * repo keeps one-file-per-stage.
 */
function clampExtractedText(text: string): string {
  if (text.length <= MAX_EXTRACTED_CHARS) return text;
  const end = endsWithLoneSurrogate(text, MAX_EXTRACTED_CHARS)
    ? MAX_EXTRACTED_CHARS - 1
    : MAX_EXTRACTED_CHARS;
  return text.slice(0, end);
}

/** Whether the character ending at `end` is half of an astral pair. */
function endsWithLoneSurrogate(text: string, end: number): boolean {
  if (end <= 0 || end > text.length) return false;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) return true;
  if (last < 0xdc00 || last > 0xdfff) return false;
  // A low surrogate is only half a character when nothing precedes it.
  const previous = text.charCodeAt(end - 2);
  return !(previous >= 0xd800 && previous <= 0xdbff);
}