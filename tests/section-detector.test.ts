import { describe, expect, it } from "vitest";
import {
  detectSections,
  hasEquivalentExperience,
  headingCaseStyle,
  headingStyleShare,
} from "@/lib/resume/section-detector";
import { normalizeText } from "@/lib/resume/text-normalizer";
import { EXPERIENCED_RESUME, FRESHER_RESUME, NO_SECTIONS_RESUME } from "./resume-fixtures";
function sectionsFor(text: string) {
  const { lines, lineOffsets } = normalizeText(text);
  return detectSections(lines, lineOffsets);
}

describe("detectSections", () => {
  it("finds standard headings in an experienced resume", () => {
    const sections = sectionsFor(EXPERIENCED_RESUME);
    const ids = sections.map((section) => section.id);
    expect(ids).toContain("experience");
    expect(ids).toContain("education");
    expect(ids).toContain("skills");
    expect(ids).toContain("projects");
  });

  it("recognizes fresher resume sections", () => {
    const sections = sectionsFor(FRESHER_RESUME);
    const ids = sections.map((section) => section.id);
    expect(ids).toContain("education");
    expect(ids).toContain("projects");
    expect(ids).toContain("internships");
    expect(ids).toContain("skills");
    expect(ids).not.toContain("experience");
  });

  it("treats internships, projects, volunteer and activities as experience equivalents", () => {
    expect(hasEquivalentExperience(sectionsFor(FRESHER_RESUME))).toBe(true);
    expect(hasEquivalentExperience(sectionsFor("Volunteer\nHelped at a shelter"))).toBe(true);
    expect(hasEquivalentExperience(sectionsFor("Activities\nLed the robotics club"))).toBe(true);
    expect(hasEquivalentExperience(sectionsFor("Summary\nBackend engineer"))).toBe(false);
  });

  it("does not split inline headings with content on the same line", () => {
    const sections = sectionsFor("Skills: Python, Go, React, SQL and Docker");
    expect(sections.map((section) => section.id)).not.toContain("skills");
  });

  it("handles headings with trailing decorations and mixed case", () => {
    const sections = sectionsFor("--- WORK EXPERIENCE ---\nEngineer, 2020\n\nEducation:\nB.S. 2024");
    expect(sections.map((section) => section.id)).toEqual(["experience", "education"]);
  });

  it("returns no sections for a wall of text", () => {
    expect(sectionsFor(NO_SECTIONS_RESUME)).toHaveLength(0);
  });

  it("keeps section content and offsets internally consistent", () => {
    const { normalizedText, lines, lineOffsets } = normalizeText(EXPERIENCED_RESUME);
    const sections = detectSections(lines, lineOffsets);
    const experience = sections.find((section) => section.id === "experience");
    expect(experience).toBeDefined();
    expect(experience?.content).toContain("Senior Backend Engineer");
    expect(experience?.content).not.toContain("B.S. Computer Science");
    expect(experience?.endIndex).toBeGreaterThan(experience?.startIndex ?? 0);
    expect(normalizedText.length).toBeGreaterThan(0);
  });

  it("keeps duplicated section headings as separate sections", () => {
    const sections = sectionsFor(
      "PROJECTS\n- One\n\nPROJECTS\n- Two",
    );
    expect(sections.map((section) => section.id)).toEqual(["projects", "projects-2"]);
  });
});

describe("heading style helpers", () => {
  it("classifies casing", () => {
    expect(headingCaseStyle("EXPERIENCE")).toBe("upper");
    expect(headingCaseStyle("Experience")).toBe("title");
    expect(headingCaseStyle("experience")).toBe("lower");
  });

  it("computes the dominant style share", () => {
    const sections = [
      { id: "a", heading: "EXPERIENCE", normalizedHeading: "experience", content: "", startIndex: 0, endIndex: 1 },
      { id: "b", heading: "EDUCATION", normalizedHeading: "education", content: "", startIndex: 1, endIndex: 2 },
      { id: "c", heading: "Skills", normalizedHeading: "skills", content: "", startIndex: 2, endIndex: 3 },
    ];
    expect(headingStyleShare(sections)).toBeCloseTo(2 / 3);
  });
});
