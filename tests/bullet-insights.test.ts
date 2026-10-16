/**
 * Pinpointed bullet findings: exact spans, measured detail, and the guarantee
 * that displaying a whole bullet never leaks contact details.
 */

import { describe, expect, it } from "vitest";
import { analyzeBullets } from "@/lib/resume/bullet-analyzer";
import { normalizeText } from "@/lib/resume/text-normalizer";
import { detectSections } from "@/lib/resume/section-detector";
import { buildBulletMarks, collectBulletInsights, summarizeMarks } from "@/lib/resume/bullet-insights";
import { redactContact, overlapsRedaction } from "@/lib/resume/redact";
import type { ResumeBullet, TextSpan } from "@/lib/resume/types";
import { WEAK_WORDING_RESUME, FIRST_PERSON_RESUME, DUPLICATE_BULLETS_RESUME } from "./resume-fixtures";

function analyze(text: string) {
  const { lines, lineOffsets, normalizedText } = normalizeText(text);
  const sections = detectSections(lines, lineOffsets);
  return analyzeBullets(normalizedText, lines, lineOffsets, sections).bullets;
}

function bulletAt(bullets: ResumeBullet[], position: number): ResumeBullet {
  const bullet = bullets.find((entry) => entry.position === position);
  if (!bullet) throw new Error(`No bullet at position ${position}`);
  return bullet;
}

function spansOf(bullet: ResumeBullet, kind: "weakPhraseSpans" | "firstPersonSpans"): TextSpan[] {
  return bullet[kind];
}

describe("bullet spans", () => {
  it("records the exact offsets of each weak phrase", () => {
    const bullets = analyze(WEAK_WORDING_RESUME);
    const withWeak = bullets.filter((bullet) => bullet.weakPhraseSpans.length > 0);
    expect(withWeak.length).toBeGreaterThan(0);

    for (const bullet of withWeak) {
      for (const span of bullet.weakPhraseSpans) {
        // The span must slice back to exactly the text it claims to match.
        expect(bullet.text.slice(span.start, span.end)).toBe(span.text);
      }
    }
  });

  it("keeps overlapping weak-phrase matches from double-marking text", () => {
    for (const bullet of analyze(WEAK_WORDING_RESUME)) {
      const spans = bullet.weakPhraseSpans;
      for (let i = 1; i < spans.length; i += 1) {
        expect(spans[i]!.start).toBeGreaterThanOrEqual(spans[i - 1]!.end);
      }
    }
  });

  it("records first-person offsets", () => {
    for (const bullet of analyze(FIRST_PERSON_RESUME)) {
      for (const span of spansOf(bullet, "firstPersonSpans")) {
        expect(bullet.text.slice(span.start, span.end).toLowerCase()).toBe(span.text.toLowerCase());
      }
    }
  });

  it("numbers bullets from one in document order", () => {
    const bullets = analyze(WEAK_WORDING_RESUME);
    expect(bullets.map((bullet) => bullet.position)).toEqual(
      bullets.map((_, index) => index + 1),
    );
  });

  it("only marks the leading token when it is not an action verb", () => {
    for (const bullet of analyze(WEAK_WORDING_RESUME)) {
      if (bullet.startsWithActionVerb) {
        expect(bullet.leadingTokenSpan).toBeUndefined();
      } else {
        expect(bullet.leadingTokenSpan?.start).toBe(0);
      }
    }
  });
});

describe("pinpointed findings", () => {
  it("points at the offending words rather than the whole line", () => {
    const bullet = bulletAt(analyze(WEAK_WORDING_RESUME), 1);
    const marks = buildBulletMarks(bullet);
    const filler = marks.find((mark) => mark.kind === "weak-phrase");
    expect(filler).toBeDefined();
    expect(filler!.start).toBeGreaterThanOrEqual(0);
    expect(filler!.end).toBeLessThanOrEqual(bullet.text.length);
    expect(bullet.text.slice(filler!.start, filler!.end)).toBe(filler!.text);
  });

  it("spans the whole bullet when the defect is the whole bullet", () => {
    const insights = collectBulletInsights(analyze(DUPLICATE_BULLETS_RESUME));
    const long = insights
      .flatMap((insight) => insight.marks)
      .find((mark) => mark.kind === "too-long");
    if (long) {
      expect(long.start).toBe(0);
      expect(long.text.length).toBeGreaterThan(0);
    }
  });

  it("gives every mark a measured detail and a concrete fix", () => {
    for (const insight of collectBulletInsights(analyze(WEAK_WORDING_RESUME))) {
      expect(insight.marks.length).toBeGreaterThan(0);
      for (const mark of insight.marks) {
        expect(mark.detail).toBeTruthy();
        expect(mark.fix).toBeTruthy();
        expect(mark.checkId).toBeTruthy();
      }
    }
  });

  it("orders the most flagged bullets first", () => {
    const insights = collectBulletInsights(analyze(WEAK_WORDING_RESUME));
    for (let i = 1; i < insights.length; i += 1) {
      expect(insights[i - 1]!.marks.length).toBeGreaterThanOrEqual(insights[i]!.marks.length);
    }
  });

  it("counts findings by kind", () => {
    const insights = collectBulletInsights(analyze(WEAK_WORDING_RESUME));
    const counts = summarizeMarks(insights);
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const marked = insights.reduce((sum, insight) => sum + insight.marks.length, 0);
    expect(total).toBe(marked);
  });

  it("reports nothing for a resume whose bullets all hold up", () => {
    const strong = [
      "- Reduced checkout latency by 40% across three services",
      "- Led the migration of 4.2 million invoice rows to Postgres",
      "- Cut infrastructure spend by $140k a year",
    ].join("\n");
    expect(collectBulletInsights(analyze(strong))).toHaveLength(0);
  });
});

describe("contact redaction", () => {
  it("removes emails, links and phone numbers", () => {
    const { text, redacted } = redactContact(
      "Mail jane.doe@example.com or call 555-010-1234, see linkedin.com/in/janedoe",
    );
    expect(redacted).toBe(true);
    expect(text).not.toContain("jane.doe@example.com");
    expect(text).not.toContain("555-010-1234");
    expect(text).not.toContain("linkedin.com/in/janedoe");
    expect(text).toContain("[email removed]");
    expect(text).toContain("[phone removed]");
    expect(text).toContain("[link removed]");
  });

  it("leaves ordinary resume text untouched", () => {
    const input = "Cut p99 latency by 40% across 3 services (p99: 300ms)";
    const { text, redacted } = redactContact(input);
    expect(redacted).toBe(false);
    expect(text).toBe(input);
  });

  it("maps original offsets onto the redacted text so marks still line up", () => {
    const original = "Contact me at jane@example.com and rebuild the ledger";
    const { text, map } = redactContact(original);
    const tail = original.indexOf("rebuild");
    // The slice starting at "rebuild" in the original must still be that word.
    expect(text.slice(map(tail), map(tail) + "rebuild".length)).toBe("rebuild");
  });

  it("reports spans so nothing can be highlighted across a redaction", () => {
    const { spans } = redactContact("write to a@b.com now");
    expect(spans.length).toBeGreaterThan(0);
    expect(overlapsRedaction(spans, 0, spans[0]!.end)).toBe(true);
    expect(overlapsRedaction(spans, spans[0]!.end + 1, spans[0]!.end + 4)).toBe(false);
  });
});