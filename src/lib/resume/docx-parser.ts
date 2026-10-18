import { strFromU8, unzipSync } from "fflate";
import mammoth from "mammoth";
import { AppError } from "../utils/errors";
import { BULLET_GLYPHS } from "./constants";
import type { ParsingWarning, ResumeFileType, SourceDocument } from "./types";

/** Guard against pathological extraction sizes (the upload cap is 5 MB). */
const MAX_EXTRACTED_CHARS = 1_500_000;

/**
 * Decompression budget, checked before anything is inflated.
 *
 * The 5 MB upload cap bounds the *compressed* archive and says nothing about
 * what comes out of it: a few hundred kilobytes of zip can expand to gigabytes,
 * and `unzipSync` allocates that on the main thread, so the tab dies before a
 * single rule runs. The declared sizes are read from the central directory,
 * which is a table of contents, not content.
 *
 * 64 MB is ~40x the largest text this parser ever hands to the rules
 * (1.5M chars is under 3 MB) — enough headroom for the embedded fonts and
 * images no rule reads, and small enough that the worst case stays survivable.
 */
const MAX_DECOMPRESSED_BYTES = 64 * 1024 * 1024;

/**
 * Entry-count budget. A real DOCX has tens of entries. A central directory
 * costs roughly 46 bytes per entry, so a 5 MB upload can declare a million of
 * them, and walking those burns main-thread time before the size budget can
 * even be consulted.
 */
const MAX_ZIP_ENTRIES = 2_048;

/**
 * Walk bound for the paragraph cross-check. A resume has tens of paragraphs;
 * anything past this is not a resume, and refusing to walk it keeps the
 * mismatch path reachable instead of hanging.
 */
const MAX_LIST_PARAGRAPHS = 20_000;

interface DocxStructureFacts {
  tableCount: number;
  hasColumns: boolean;
  hasHeaderFooter: boolean;
  hyperlinkCount: number;
}

/** The numbering facts one list level resolves to. */
interface LevelFormatting {
  /** `w:numFmt` value, or null when the level declares none. */
  format: string | null;
  /** `w:lvlText` placeholder run, which can itself be a bullet glyph. */
  lvlText: string | null;
}

interface NumberingTable {
  /** abstractNumId -> ilvl -> formatting. */
  abstract: Map<string, Map<string, LevelFormatting>>;
  /** numId -> abstractNumId, plus the ilvl overrides declared on `w:num`. */
  concrete: Map<string, ConcreteList>;
}

interface ConcreteList {
  abstractNumId: string;
  overrides: Map<string, LevelFormatting>;
}

/* ------------------------------------------------------------------ */
/* Zip preflight                                                       */
/* ------------------------------------------------------------------ */

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const EOCD_MIN_SIZE = 22;
const MAX_ZIP_COMMENT_SIZE = 0xffff;
const CENTRAL_HEADER_SIZE = 46;

const ZIP64_MARKER_16 = 0xffff;
const ZIP64_MARKER_32 = 0xffffffff;
const ZIP64_EXTRA_ID = 0x0001;

interface ZipBudget {
  entries: number;
  uncompressedBytes: number;
}

function readUint16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function readUint64(view: DataView, offset: number): number {
  const high = view.getUint32(offset, true);
  const low = view.getUint32(offset + 4, true);
  const value = high * 2 ** 32 + low;
  return Number.isSafeInteger(value) ? value : Number.MAX_SAFE_INTEGER;
}

/** Locate the end-of-central-directory record, or null when it cannot be read. */
function findEndOfCentralDirectory(view: DataView): number | null {
  const start = Math.max(0, view.byteLength - (EOCD_MIN_SIZE + MAX_ZIP_COMMENT_SIZE));
  for (let offset = view.byteLength - EOCD_MIN_SIZE; offset >= start; offset -= 1) {
    if (readUint32(view, offset) === EOCD_SIGNATURE) return offset;
  }
  return null;
}

/**
 * Read entry count and the declared uncompressed total out of the central
 * directory. Returns null when the archive cannot be read that way; the caller
 * then proceeds unbudgeted rather than rejecting a file for being unreadable.
 */
function readZipBudget(bytes: Uint8Array): ZipBudget | null {
  if (bytes.length < EOCD_MIN_SIZE) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd === null) return null;

  let entries = readUint16(view, eocd + 10);
  let directoryOffset = readUint32(view, eocd + 16);

  if (entries === ZIP64_MARKER_16 || directoryOffset === ZIP64_MARKER_32) {
    const locator = eocd - 20;
    if (locator < 0 || readUint32(view, locator) !== ZIP64_LOCATOR_SIGNATURE) return null;
    const zip64 = readUint64(view, locator + 8);
    if (zip64 + 56 > view.byteLength || readUint32(view, zip64) !== ZIP64_EOCD_SIGNATURE) {
      return null;
    }
    entries = readUint64(view, zip64 + 32);
    directoryOffset = readUint64(view, zip64 + 48);
  }

  if (entries > bytes.length || directoryOffset > bytes.length) return null;

  let uncompressedBytes = 0;
  let cursor = directoryOffset;
  let counted = 0;

  while (
    counted < entries &&
    cursor + CENTRAL_HEADER_SIZE <= view.byteLength &&
    readUint32(view, cursor) === CENTRAL_HEADER_SIGNATURE
  ) {
    const extraLength = readUint16(view, cursor + 28);
    const commentLength = readUint16(view, cursor + 32);
    const next = cursor + CENTRAL_HEADER_SIZE + extraLength + commentLength;
    if (next > view.byteLength || next <= cursor) return null;
    uncompressedBytes += entryUncompressedSize(view, cursor, extraLength);
    cursor = next;
    counted += 1;
  }

  if (counted !== entries) return null;
  return { entries, uncompressedBytes };
}

/**
 * Central headers may hide sizes behind a zip64 extra field. Walking it also
 * guards against a hostile archive that claims a huge uncompressed size and no
 * zip64 record at all: there is nothing honest to trust then, so the archive
 * is treated as unbounded.
 */
function entryUncompressedSize(view: DataView, headerOffset: number, extraLength: number): number {
  const uncompressed = readUint32(view, headerOffset + 24);
  const compressed = readUint32(view, headerOffset + 20);
  if (uncompressed !== ZIP64_MARKER_32 && compressed !== ZIP64_MARKER_32) return uncompressed;

  let extra = headerOffset + CENTRAL_HEADER_SIZE;
  const extraEnd = extra + extraLength;
  while (extra + 4 <= extraEnd && extra + 4 <= view.byteLength) {
    const id = readUint16(view, extra);
    const size = readUint16(view, extra + 2);
    if (id === ZIP64_EXTRA_ID && extra + 4 + 16 <= view.byteLength) {
      return readUint64(view, extra + 4);
    }
    extra += 4 + size;
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Refuse archives that would expand past the budget, before inflating them.
 * Throwing `AppError` rather than returning a verdict keeps the failure
 * identical to every other parse failure the uploader already renders.
 */
function assertDecompressionBudget(bytes: Uint8Array): void {
  let budget: ZipBudget | null;
  try {
    budget = readZipBudget(bytes);
  } catch {
    return;
  }
  if (budget === null) return;

  if (budget.uncompressedBytes > MAX_DECOMPRESSED_BYTES) {
    throw new AppError({
      code: "parse-failed",
      message:
        "This DOCX expands to far more content than it contains, which is not what a normal resume does.",
      hint: "Open the file in Word, save a fresh copy as DOCX, then upload that copy instead.",
      retryable: true,
    });
  }

  if (budget.entries > MAX_ZIP_ENTRIES) {
    throw new AppError({
      code: "parse-failed",
      message: `This DOCX declares ${budget.entries} internal files, which is not what a normal resume contains.`,
      hint: "Open the file in Word, save a fresh copy as DOCX, then upload that copy instead.",
      retryable: true,
    });
  }
}

/** Read one package part after the preflight has cleared the whole archive. */
function readPart(zip: Record<string, Uint8Array>, path: string): string | null {
  const bytes = zip[path];
  return bytes === undefined ? null : strFromU8(bytes);
}

/* ------------------------------------------------------------------ */
/* List numbering                                                      */
/* ------------------------------------------------------------------ */

function matchFirst(value: string, pattern: RegExp): string | null {
  const match = pattern.exec(value);
  return match?.[1] ?? null;
}

/**
 * Numbering formats that render a glyph the reader counts as a marker. Anything
 * else - including a level that declares no format, which is how Word writes
 * picture bullets - is treated as a bullet: guessing "bullet" preserves the
 * list signal, and the alternative silently drops it.
 */
const ORDERED_FORMATS = new Set([
  "decimal",
  "decimalZero",
  "upperRoman",
  "lowerRoman",
  "upperLetter",
  "lowerLetter",
  "ordinal",
  "ordinalText",
  "cardinalText",
  "ideographDigital",
  "arabicAlpha",
  "arabicAbjad",
]);

/**
 * A `w:lvlText` can carry the marker directly, which is how picture bullets and
 * Symbol-font bullets reach the page. Checking it keeps those levels out of the
 * ordered-list branch, where the marker would be replaced by a number.
 */
const BULLET_GLYPH_SET = new Set(BULLET_GLYPHS);

function isBulletLevelText(lvlText: string): boolean {
  const trimmed = lvlText.trim();
  if (trimmed.length === 0) return false;
  if (BULLET_GLYPH_SET.has(trimmed)) return true;
  // Symbol-font bullets are written as the private-use code point itself.
  const code = trimmed.charCodeAt(0);
  return code >= 0xe000 && code <= 0xf8ff;
}

const ROMAN_NUMERALS = [
  [1000, "m"],
  [900, "cm"],
  [500, "d"],
  [400, "cd"],
  [100, "c"],
  [90, "xc"],
  [50, "l"],
  [40, "xl"],
  [10, "x"],
  [9, "ix"],
  [5, "v"],
  [4, "iv"],
  [1, "i"],
] as const;

function toRoman(value: number): string {
  let remaining = value;
  let roman = "";
  for (const [amount, symbol] of ROMAN_NUMERALS) {
    while (remaining >= amount) {
      remaining -= amount;
      roman += symbol;
    }
  }
  return roman;
}

function toAlpha(value: number): string {
  let remaining = value;
  let letters = "";
  while (remaining > 0) {
    const index = (remaining - 1) % 26;
    letters = String.fromCharCode(97 + index) + letters;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return letters;
}

/** The synthetic marker an ordered list renders, chosen from `w:numFmt`. */
function orderedMarker(format: string | null, position: number): string {
  if (format === "lowerRoman") return `${toRoman(position)}. `;
  if (format === "upperRoman") return `${toRoman(position).toUpperCase()}. `;
  if (format === "lowerLetter") return `${toAlpha(position)}) `;
  if (format === "upperLetter") return `${toAlpha(position).toUpperCase()}) `;
  if (format === "decimalZero") return `${String(position).padStart(2, "0")}. `;
  // Word's word-numbered formats (cardinalText, ordinalText) render a word
  // rather than a digit; the digit keeps the marker in the shape the bullet
  // and line-length rules already understand.
  return `${position}. `;
}

/**
 * Resolve a `numId`/`ilvl` pair to the formatting that decides whether the
 * paragraph renders a bullet or a number. Both the direct
 * (`w:numPr` -> `w:numId`) and the indirect (`w:num` -> `w:abstractNumId` ->
 * `w:lvl`) routes are honoured because Word writes either depending on whether
 * the list came from the gallery or from a template.
 */
function resolveLevel(
  numbering: NumberingTable,
  numId: string,
  ilvl: string,
): LevelFormatting | null {
  const concrete = numbering.concrete.get(numId);
  if (concrete === undefined) return null;
  const override = concrete.overrides.get(ilvl);
  if (override !== undefined) return override;
  const levels = numbering.abstract.get(concrete.abstractNumId);
  if (levels === undefined) return null;
  return levels.get(ilvl) ?? null;
}

function parseNumbering(numberingXml: string): NumberingTable {
  const abstract = new Map<string, Map<string, LevelFormatting>>();

  const abstractPattern =
    /<w:abstractNum\b[^>]*w:abstractNumId="([^"]*)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g;
  for (
    let match = abstractPattern.exec(numberingXml);
    match !== null;
    match = abstractPattern.exec(numberingXml)
  ) {
    const abstractNumId = match[1];
    const body = match[2];
    if (abstractNumId === undefined || body === undefined) continue;

    const levels = new Map<string, LevelFormatting>();
    const levelPattern = /<w:lvl\b[^>]*w:ilvl="([^"]*)"[^>]*>([\s\S]*?)<\/w:lvl>/g;
    for (
      let levelMatch = levelPattern.exec(body);
      levelMatch !== null;
      levelMatch = levelPattern.exec(body)
    ) {
      const ilvl = levelMatch[1];
      const levelBody = levelMatch[2];
      if (ilvl === undefined || levelBody === undefined) continue;
      levels.set(ilvl, {
        format: matchFirst(levelBody, /<w:numFmt\b[^>]*w:val="([^"]*)"/),
        lvlText: matchFirst(levelBody, /<w:lvlText\b[^>]*w:val="([^"]*)"/),
      });
    }
    abstract.set(abstractNumId, levels);
  }

  const concrete = new Map<string, ConcreteList>();
  const numPattern = /<w:num\b[^>]*w:numId="([^"]*)"[^>]*>([\s\S]*?)<\/w:num>/g;
  for (
    let match = numPattern.exec(numberingXml);
    match !== null;
    match = numPattern.exec(numberingXml)
  ) {
    const numId = match[1];
    const body = match[2];
    if (numId === undefined || body === undefined) continue;

    const abstractNumId = matchFirst(body, /<w:abstractNumId\b[^>]*w:val="([^"]*)"/);
    if (abstractNumId === null) continue;

    const overrides = new Map<string, LevelFormatting>();
    const overridePattern =
      /<w:lvlOverride\b[^>]*w:ilvl="([^"]*)"[^>]*>([\s\S]*?)<\/w:lvlOverride>/g;
    for (
      let overrideMatch = overridePattern.exec(body);
      overrideMatch !== null;
      overrideMatch = overridePattern.exec(body)
    ) {
      const ilvl = overrideMatch[1];
      const levelBody = matchFirst(overrideMatch[2] ?? "", /<w:lvl\b[^>]*>([\s\S]*?)<\/w:lvl>/);
      if (ilvl === undefined || levelBody === null) continue;
      overrides.set(ilvl, {
        format: matchFirst(levelBody, /<w:numFmt\b[^>]*w:val="([^"]*)"/),
        lvlText: matchFirst(levelBody, /<w:lvlText\b[^>]*w:val="([^"]*)"/),
      });
    }

    concrete.set(numId, { abstractNumId, overrides });
  }

  return { abstract, concrete };
}

interface ListReference {
  numId: string;
  ilvl: string;
}

/**
 * Read a `w:numPr` out of a paragraph (or a paragraph style) and resolve it to
 * numbering. `w:numId w:val="0"` is Word's way of cancelling numbering
 * inherited from a style, so it is treated as "not a list".
 */
function readListReference(
  propertiesXml: string | null,
  styleReferences: Map<string, ListReference>,
  styleId: string | null,
): ListReference | null {
  const direct = readNumPr(propertiesXml ?? "");
  if (direct !== null) return direct;
  if (styleId === null) return null;
  const inherited = styleReferences.get(styleId);
  return inherited ?? null;
}

function readNumPr(propertiesXml: string): ListReference | null {
  const numPr = matchFirst(propertiesXml, /<w:numPr\b[^>]*>([\s\S]*?)<\/w:numPr>/);
  if (numPr === null) return null;
  const numId = matchFirst(numPr, /<w:numId\b[^>]*w:val="([^"]*)"/);
  if (numId === null || numId === "0") return null;
  return { numId, ilvl: matchFirst(numPr, /<w:ilvl\b[^>]*w:val="([^"]*)"/) ?? "0" };
}

/** Paragraph styles that carry their own numbering, as Word templates emit. */
function parseStyleNumbering(stylesXml: string): Map<string, ListReference> {
  const references = new Map<string, ListReference>();
  const stylePattern = /<w:style\b[^>]*w:styleId="([^"]*)"[^>]*>([\s\S]*?)<\/w:style>/g;
  for (
    let match = stylePattern.exec(stylesXml);
    match !== null;
    match = stylePattern.exec(stylesXml)
  ) {
    const styleId = match[1];
    const body = match[2];
    if (styleId === undefined || body === undefined) continue;
    const paragraphProperties = matchFirst(body, /<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/);
    const reference = readNumPr(paragraphProperties ?? "");
    if (reference !== null) references.set(styleId, reference);
  }
  return references;
}

/**
 * Mammoth's raw-text writer emits `"\n\n"` after every paragraph and nothing
 * else, so that exact separator is the only split that maps one-to-one onto
 * `w:p` elements. A looser separator would swallow blank paragraphs, and a
 * blank paragraph silently shifts every later prefix onto the wrong line.
 */
const PARAGRAPH_SEPARATOR = "\n\n";

const PARAGRAPH_PATTERN = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p(?:\s[^>]*)?\/>/g;

interface ListRewriteResult {
  text: string;
  listParagraphCount: number;
}

/**
 * Put the markers Mammoth dropped back onto the paragraphs that declare a list.
 *
 * Returns null - meaning "leave the text exactly as extracted" - whenever the
 * two paragraph streams do not line up. Mammoth silently merges tracked-change
 * deletions into the following paragraph and skips other body elements, so a
 * count that does not match means the prefixes would land on the wrong lines,
 * and a wrong prefix corrupts the whole bullet ledger. Losing the markers
 * costs the same points the file already loses today.
 */
function applyListMarkers(
  rawText: string,
  documentXml: string,
  numbering: NumberingTable,
  styleReferences: Map<string, ListReference>,
): ListRewriteResult | null {
  const chunks = rawText.split(PARAGRAPH_SEPARATOR);
  if (chunks.length > 0 && chunks[chunks.length - 1] === "") chunks.pop();

  const xmlParagraphs = documentXml.match(PARAGRAPH_PATTERN);
  if (xmlParagraphs === null) return null;
  if (xmlParagraphs.length > MAX_LIST_PARAGRAPHS) return null;
  if (xmlParagraphs.length !== chunks.length) return null;

  const counters = new Map<string, number>();
  let listParagraphCount = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    const paragraphXml = xmlParagraphs[index];
    const chunk = chunks[index];
    if (paragraphXml === undefined || chunk === undefined) return null;

    const paragraphProperties = matchFirst(paragraphXml, /<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/);
    const styleId =
      paragraphProperties === null
        ? null
        : matchFirst(paragraphProperties, /<w:pStyle\b[^>]*w:val="([^"]*)"/);
    const reference = readListReference(paragraphProperties, styleReferences, styleId);
    if (reference === null) continue;

    const level = resolveLevel(numbering, reference.numId, reference.ilvl);
    if (level === null) continue;

    const counterKey = `${reference.numId}:${reference.ilvl}`;
    const position = (counters.get(counterKey) ?? 0) + 1;
    counters.set(counterKey, position);

    const isBullet =
      level.format === null ||
      !ORDERED_FORMATS.has(level.format) ||
      (level.lvlText !== null && isBulletLevelText(level.lvlText));

    chunks[index] = `${isBullet ? "\u2022 " : orderedMarker(level.format, position)}${chunk}`;
    listParagraphCount += 1;
  }

  return { text: chunks.join(PARAGRAPH_SEPARATOR), listParagraphCount };
}

/**
 * Inspect the DOCX package for structural facts that affect how reliably text
 * can be extracted: tables, multi-column sections, headers/footers and
 * hyperlinks. The zip is read defensively; a malformed package only means the
 * structural facts are unavailable.
 */
function inspectDocxStructure(zip: Record<string, Uint8Array>): DocxStructureFacts | null {
  try {
    const documentXml = readPart(zip, "word/document.xml");
    if (documentXml === null || documentXml.length === 0) return null;

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
 * Clamp to the extraction cap without leaving half a character behind.
 *
 * `slice` can cut between the two halves of an astral character, and the
 * orphaned surrogate is read as U+FFFD downstream - which the readability rules
 * would then blame on the user's export. The same helper exists in
 * `pdf-parser.ts`; the two parsers are separate modules and a shared one would
 * have to live outside `lib/resume`, which this repo keeps one-file-per-stage.
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

/**
 * Extract text from a DOCX file using Mammoth (local, in-browser extraction)
 * plus a structural inspection of the underlying package.
 */
export async function extractDocxText(
  buffer: ArrayBuffer,
  fileName: string,
): Promise<SourceDocument> {
  const warnings: ParsingWarning[] = [];
  const bytes = new Uint8Array(buffer);

  // The budget runs before anything inflates: mammoth unzips the package on the
  // way to producing text, and the structural and marker passes each unzip it
  // again.
  assertDecompressionBudget(bytes);

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

  let text = value;
  let zip: Record<string, Uint8Array> | null = null;
  let documentXml: string | null = null;
  try {
    zip = unzipSync(bytes);
    documentXml = readPart(zip, "word/document.xml");
  } catch {
    zip = null;
    documentXml = null;
  }

  // Mammoth's raw-text writer never renders a list marker, so a Word-authored
  // resume reaches the bullet rules as unmarked paragraphs and loses every
  // check that depends on them. The numbering is in the package, so it is put
  // back here - but only when the two paragraph streams agree.
  if (documentXml !== null) {
    let numberingXml: string | null = null;
    let stylesXml: string | null = null;
    try {
      numberingXml = zip === null ? null : readPart(zip, "word/numbering.xml");
      stylesXml = zip === null ? null : readPart(zip, "word/styles.xml");
    } catch {
      numberingXml = null;
      stylesXml = null;
    }
    if (numberingXml !== null && numberingXml.length > 0) {
      const rewritten = applyListMarkers(
        value,
        documentXml,
        parseNumbering(numberingXml),
        stylesXml === null ? new Map<string, ListReference>() : parseStyleNumbering(stylesXml),
      );
      if (rewritten === null) {
        warnings.push({
          code: "docx-list-unreadable",
          message:
            "This document's list formatting could not be matched to its text, so list markers were left out. Content was still analyzed as written.",
        });
      } else if (rewritten.listParagraphCount > 0) {
        text = rewritten.text;
      }
    }
  }

  if (text.length > MAX_EXTRACTED_CHARS) {
    warnings.push({
      code: "text-truncated",
      message:
        "The document is very large. Only the beginning of the extracted text was analyzed.",
    });
  }
  text = clampExtractedText(text);

  const facts = zip === null ? null : inspectDocxStructure(zip);

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