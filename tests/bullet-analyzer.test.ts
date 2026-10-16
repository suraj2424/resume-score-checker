import { describe, expect, it } from "vitest";
import { analyzeBullets, isBulletLine, stripBulletMarker } from "@/lib/resume/bullet-analyzer";
import { normalizeText } from "@/lib/resume/text-normalizer";
import { detectSections } from "@/lib/resume/section-detector";
import {
  DUPLICATE_BULLETS_RESUME,
  EXPERIENCED_RESUME,
  FIRST_PERSON_RESUME,
  WEAK_WORDING_RESUME,
} from "./resume-fixtures";

function analyze(text: string) {
  const { lines, lineOffsets } = normalizeText(text);
  const sections = detectSections(lines, lineOffsets);
  return analyzeBullets(text, lines, lineOffsets, sections);
}

describe("bullet marker helpers", () => {
  it("detects common bullet glyphs", () => {
    expect(isBulletLine("• item")).toBe(true);
    expect(isBulletLine("▪ item")).toBe(true);
    expect(isBulletLine("- item")).toBe(true);
    expect(isBulletLine("* item")).toBe(true);
    expect(isBulletLine("– item")).toBe(true);
    expect(isBulletLine("plain line")).toBe(false);
  });

  it("strips markers including nested glyphs", () => {
    // Through the normalizer, a variation selector becomes a space.
    const { lines } = normalizeText("• - nested item\n▪️ spaced");
    expect(stripBulletMarker(lines[0]!)).toBe("nested item");
    expect(stripBulletMarker(lines[1]!)).toBe("spaced");
  });
});

describe("analyzeBullets", () => {
  it("extracts bullets with section attribution and flags", () => {
    const { bullets } = analyze(EXPERIENCED_RESUME);
    expect(bullets.length).toBeGreaterThanOrEqual(8);

    const first = bullets[0];
    expect(first?.text.startsWith("Designed")).toBe(true);
    expect(first?.startsWithActionVerb).toBe(true);
    expect(first?.containsNumber).toBe(true);
    expect(first?.hasFirstPerson).toBe(false);
    expect(first?.section).toBe("EXPERIENCE");
    expect(first?.wordCount).toBeGreaterThan(5);
  });

  it("returns no bullets for paragraph resumes", () => {
    const { bullets } = analyze(
      "I am a motivated professional with a long career in many different industries and roles.",
    );
    expect(bullets).toHaveLength(0);
  });

  it("detects first-person language per bullet", () => {
    const { bullets } = analyze(FIRST_PERSON_RESUME);
    const firstPerson = bullets.filter((bullet) => bullet.hasFirstPerson);
    expect(firstPerson.length).toBeGreaterThanOrEqual(3);
  });

  it("detects weak phrasing per bullet", () => {
    const { bullets } = analyze(WEAK_WORDING_RESUME);
    const weak = bullets.filter((bullet) => bullet.containsWeakPhrase);
    expect(weak.length).toBeGreaterThanOrEqual(3);
  });

  it("reports duplicate bullet texts", () => {
    const { bullets, duplicateTexts } = analyze(DUPLICATE_BULLETS_RESUME);
    expect(bullets).toHaveLength(4);
    expect(duplicateTexts).toHaveLength(2);
  });

  it("counts words per bullet", () => {
    const { bullets } = analyze("EXPERIENCE\n- Did a thing\n- Did a much longer thing with many words");
    expect(bullets[0]?.wordCount).toBe(3);
    expect(bullets[1]?.wordCount).toBe(8);
  });

  it("ignores absurdly long lines that are paragraphs, not bullets", () => {
    const paragraph = "x".repeat(700);
    const { bullets } = analyze(`- ${paragraph}`);
    expect(bullets).toHaveLength(0);
  });
});
