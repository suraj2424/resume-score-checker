import { describe, expect, it } from "vitest";
import { analyzeDates } from "@/lib/resume/date-analyzer";
import {
  EXPERIENCED_RESUME,
  INCONSISTENT_DATES_RESUME,
  MINIMAL_RESUME,
} from "./resume-fixtures";

describe("analyzeDates", () => {
  it("classifies consistent month-name-year dates with a high dominant share", () => {
    const result = analyzeDates(EXPERIENCED_RESUME);
    expect(result.dates.length).toBeGreaterThanOrEqual(4);
    expect(result.dominantFamily).toBe("month-name-year");
    expect(result.dominantShare).toBe(1);
    expect(result.distinctFamilies).toBe(1);
    expect(result.hasPresentMarker).toBe(true);
  });

  it("detects mixed date families", () => {
    const result = analyzeDates(INCONSISTENT_DATES_RESUME);
    expect(result.distinctFamilies).toBeGreaterThanOrEqual(2);
    expect(result.dominantShare).toBeLessThan(0.9);
    expect(result.dates.some((date) => date.family === "full-date")).toBe(true);
    expect(result.dates.some((date) => date.family === "month-name-year")).toBe(true);
  });

  it("returns no dates for text without dates", () => {
    const result = analyzeDates("Backend engineer with six years of experience.");
    expect(result.dates).toHaveLength(0);
    expect(result.dominantFamily).toBeNull();
    expect(result.dominantShare).toBe(0);
    expect(result.hasPresentMarker).toBe(false);
  });

  it("does not double-count a date as both a full date and a year", () => {
    const result = analyzeDates("Jan 2021 - Dec 2021");
    expect(result.dates).toHaveLength(2);
    expect(result.familyCounts["year-only"]).toBe(0);
  });

  it("counts standalone years as year-only", () => {
    const result = analyzeDates("Worked from 2018 to 2021 on internal tools");
    expect(result.familyCounts["year-only"]).toBe(2);
  });

  it("extracts numeric year parts for sorting", () => {
    const result = analyzeDates("Mar 2021");
    expect(result.dates[0]?.year).toBe(2021);
  });

  it("handles an empty document", () => {
    const result = analyzeDates(MINIMAL_RESUME);
    expect(result.dates).toHaveLength(0);
  });
});
