import { SCORING_THRESHOLDS } from "@/config/scoring";
import type { ResumeTextStats } from "./types";

export interface NormalizedText {
  normalizedText: string;
  lines: string[];
  /** Character offset of each line inside `normalizedText`. */
  lineOffsets: number[];
  stats: ResumeTextStats;
}

const ZERO_WIDTH_AND_ODD_SPACES = /[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\u200B\u200C\u200D\uFEFF\uFE0F]/g;

const HORIZONTAL_WHITESPACE = /[ \t\f\v]+/g;
/**
 * The `g` flag is load-bearing, not decoration: `countWordsInPlace` drives this
 * with `lastIndex`, and `exec` on a non-global pattern ignores `lastIndex` and
 * restarts at index 0. That returns the first whitespace run forever, the cursor
 * never advances, and every non-empty document hangs the whole pipeline.
 *
 * Termination rests on `\s+` matching at least one character, so `index` always
 * moves strictly forward, and on the explicit `gap === null` break. Both have to
 * survive any future edit to this loop.
 */
const WORD_BOUNDARY = /\s+/g;
const REPLACEMENT_CHARACTER = /\uFFFD/g;

/**
 * Normalize extracted text into a predictable shape for detection:
 * consistent newlines, no zero-width junk, collapsed horizontal whitespace,
 * and collapsed blank-line runs. Raw text is preserved by the caller.
 */
export function normalizeText(rawText: string): NormalizedText {
  const unified = rawText.replace(/\r\n?/g, "\n").replace(ZERO_WIDTH_AND_ODD_SPACES, " ");
  const rawLines = unified.split("\n");

  // Collapse horizontal whitespace and trim each line.
  const collapsedLines = rawLines.map((line) => line.replace(HORIZONTAL_WHITESPACE, " ").trim());

  // Measure blank-line runs before collapsing them.
  let maxBlankLineRun = 0;
  let currentBlankRun = 0;
  for (const line of collapsedLines) {
    if (line.length === 0) {
      currentBlankRun += 1;
      maxBlankLineRun = Math.max(maxBlankLineRun, currentBlankRun);
    } else {
      currentBlankRun = 0;
    }
  }

  // Collapse runs of 2+ blank lines into a single blank line.
  const outputLines: string[] = [];
  let previousBlank = false;
  for (const line of collapsedLines) {
    const isBlank = line.length === 0;
    if (isBlank && previousBlank) continue;
    outputLines.push(line);
    previousBlank = isBlank;
  }
  while (outputLines.length > 0 && outputLines[0] === "") outputLines.shift();
  while (outputLines.length > 0 && outputLines[outputLines.length - 1] === "") outputLines.pop();

  const normalizedText = outputLines.join("\n");

  const lineOffsets: number[] = [];
  let cursor = 0;
  for (const line of outputLines) {
    lineOffsets.push(cursor);
    cursor += line.length + 1;
  }

  return {
    normalizedText,
    lines: outputLines,
    lineOffsets,
    stats: computeStats(normalizedText, outputLines, maxBlankLineRun),
  };
}

/**
 * Count words without materializing them. `split(/\s+/).filter(...)` allocated an
 * array of every word in the document - roughly 250k strings at the extraction
 * cap - purely to read its length, and that array was the single largest
 * allocation in the pipeline.
 */
function countWordsInPlace(text: string): number {
  let count = 0;
  let index = 0;
  while (index < text.length) {
    WORD_BOUNDARY.lastIndex = index;
    const gap = WORD_BOUNDARY.exec(text);
    const wordEnd = gap === null ? text.length : gap.index;
    if (wordEnd > index) count += 1;
    if (gap === null) break;
    index = gap.index + gap[0].length;
  }
  return count;
}

function computeStats(
  normalizedText: string,
  lines: string[],
  maxBlankLineRun: number,
): ResumeTextStats {
  let nonEmptyLineCount = 0;
  let longestLineLength = 0;
  let longLines = 0;
  for (const line of lines) {
    if (line.length === 0) continue;
    nonEmptyLineCount += 1;
    if (line.length > longestLineLength) longestLineLength = line.length;
    if (line.length > SCORING_THRESHOLDS.longLineCharacters) longLines += 1;
  }

  REPLACEMENT_CHARACTER.lastIndex = 0;
  const replacementCharCount = normalizedText.match(REPLACEMENT_CHARACTER)?.length ?? 0;

  return {
    wordCount: countWordsInPlace(normalizedText),
    lineCount: lines.length,
    characterCount: normalizedText.length,
    longestLineLength,
    longestLineRatio: nonEmptyLineCount > 0 ? longLines / nonEmptyLineCount : 0,
    maxBlankLineRun,
    replacementCharCount,
    // `ResumeTextStats.nonAsciiRatio` is required by the shared type but nothing
    // reads it. It used to cost a full pass over the text and allocate an array
    // of every non-ASCII character to produce a number nobody consumes; the type
    // needs one, so it reports zero. Remove the field from `ResumeTextStats`
    // and this line with it.
    nonAsciiRatio: 0,
  };
}

/** Split text into words. */
export function countWords(text: string): number {
  return countWordsInPlace(text);
}
