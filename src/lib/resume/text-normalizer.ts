import type { ResumeTextStats } from "./types";

export interface NormalizedText {
  normalizedText: string;
  lines: string[];
  /** Character offset of each line inside `normalizedText`. */
  lineOffsets: number[];
  stats: ResumeTextStats;
}

const ZERO_WIDTH_AND_ODD_SPACES = /[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\u200B\u200C\u200D\uFEFF\uFE0F]/g;

/**
 * Normalize extracted text into a predictable shape for detection:
 * consistent newlines, no zero-width junk, collapsed horizontal whitespace,
 * and collapsed blank-line runs. Raw text is preserved by the caller.
 */
export function normalizeText(rawText: string): NormalizedText {
  const unified = rawText.replace(/\r\n?/g, "\n").replace(ZERO_WIDTH_AND_ODD_SPACES, " ");
  const rawLines = unified.split("\n");

  // Collapse horizontal whitespace and trim each line.
  const collapsedLines = rawLines.map((line) => line.replace(/[ \t\f\v]+/g, " ").trim());

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

function computeStats(
  normalizedText: string,
  lines: string[],
  maxBlankLineRun: number,
): ResumeTextStats {
  const words = normalizedText.split(/\s+/).filter((word) => word.length > 0);
  const nonEmptyLines = lines.filter((line) => line.length > 0);
  const longestLineLength = nonEmptyLines.reduce(
    (max, line) => Math.max(max, line.length),
    0,
  );
  const longLines = nonEmptyLines.filter((line) => line.length > 100).length;
  const replacementCharCount = (normalizedText.match(/\uFFFD/g) ?? []).length;
  const nonAsciiCount = (normalizedText.match(/[^\x00-\x7F]/g) ?? []).length;

  return {
    wordCount: words.length,
    lineCount: lines.length,
    characterCount: normalizedText.length,
    longestLineLength,
    longestLineRatio:
      nonEmptyLines.length > 0 ? longLines / nonEmptyLines.length : 0,
    maxBlankLineRun,
    replacementCharCount,
    nonAsciiRatio:
      normalizedText.length > 0 ? nonAsciiCount / normalizedText.length : 0,
  };
}

/** Split text into words. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}
