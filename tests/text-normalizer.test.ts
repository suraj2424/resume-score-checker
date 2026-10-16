import { describe, expect, it } from "vitest";
import { normalizeText } from "@/lib/resume/text-normalizer";

describe("normalizeText", () => {
  it("unifies newline styles and collapses blank-line runs", () => {
    // "a\r\nb\rc\n\n\n\nd" -> three blank lines between c and d.
    const result = normalizeText("a\r\nb\rc\n\n\n\nd");
    expect(result.normalizedText).toBe("a\nb\nc\n\nd");
    expect(result.stats.maxBlankLineRun).toBe(3);
  });

  it("replaces exotic whitespace and collapses horizontal runs", () => {
    const result = normalizeText("role:\u00A0engineer\u2003lead");
    expect(result.normalizedText).toBe("role: engineer lead");
  });

  it("trims leading and trailing blank lines", () => {
    const result = normalizeText("\n\n  hello  \n\n");
    expect(result.normalizedText).toBe("hello");
    expect(result.lines).toEqual(["hello"]);
  });

  it("computes word, line and replacement-character stats", () => {
    // "bad\ufffdchar" is one word: the replacement character is inside it.
    const result = normalizeText("one two three\nbad\ufffdchar");
    expect(result.stats.wordCount).toBe(4);
    expect(result.stats.lineCount).toBe(2);
    expect(result.stats.replacementCharCount).toBe(1);
    expect(result.stats.longestLineLength).toBe(13);
  });

  it("tracks line offsets consistently", () => {
    const result = normalizeText("alpha\nbeta\ngamma");
    expect(result.lineOffsets).toEqual([0, 6, 11]);
    expect(
      result.lineOffsets.map((offset, index) =>
        result.normalizedText.slice(offset, offset + (result.lines[index] ?? "").length),
      ),
    ).toEqual(result.lines);
  });

  it("handles empty input without throwing", () => {
    const result = normalizeText("");
    expect(result.normalizedText).toBe("");
    expect(result.stats.wordCount).toBe(0);
  });
});
