import { ACTION_VERBS, BULLET_GLYPHS, WEAK_PHRASES } from "./constants";
import type { DuplicateBulletFinding, ResumeBullet, ResumeSection, TextSpan } from "./types";
import { redactContact } from "./redact";
import { countWords } from "./text-normalizer";

const BULLET_GLYPH_SET = new Set(BULLET_GLYPHS);
const MAX_BULLET_LINE_LENGTH = 600;

/**
 * Exact duplication only, keyed on the words of the bullet rather than its
 * characters, so a re-wrapped or re-punctuated repeat still counts.
 *
 * Near-duplicate detection was considered and rejected: the reliable similarity
 * rules for it (token overlap, or the shared template behind "Led the X team"
 * under two employers) flag the same bullet reused across roles as a copy, which
 * is a legitimate thing to do and is worth points to have done. A rule that
 * cannot separate those costs 2 points every time it guesses wrong.
 */
function duplicateKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Phrases treated as weak wording. Multi-word phrases match as substrings. */
const WEAK_PHRASE_PATTERNS = WEAK_PHRASES.map((phrase) => {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const isSingleWord = !phrase.includes(" ");
  return isSingleWord
    ? new RegExp(`\\b${escaped}\\b`, "i")
    : new RegExp(escaped, "i");
});

const FIRST_PERSON_PATTERN = /\b(i|i'm|i've|i'd|i'll|my|me|myself|mine)\b/gi;

/**
 * Shortest token treated as a present participle. Copied from
 * `classifyBulletTense` in `rules/helpers.ts` on purpose: the two have to call a
 * "-ing" lead the same thing, or one check credits the tense in a bullet and the
 * other marks the same bullet for having no verb in it.
 */
const MIN_GERUND_LENGTH = 5;

/**
 * What a unit's opening word can be.
 *
 * `unclassifiable` is not a synonym for `other`. "18% faster checkout
 * conversion" opens with a figure, and "—" opens with nothing: neither one is a
 * verb the writer failed to use, so charging for them would be a finding about
 * the tool's dictionary rather than about the document. Callers exclude them
 * from their denominators instead, the same way `content-tense-consistency`
 * excludes tense-neutral units.
 */
export type LeadingTokenKind = "action-verb" | "other" | "unclassifiable";

function leadingToken(text: string): string {
  return (firstTokenSpan(text)?.text ?? "").replace(/[^A-Za-z']/g, "").toLowerCase();
}

/**
 * Whether a unit opens with a verb the writer can own.
 *
 * `ACTION_VERBS` is a list of past-tense forms and already carries the
 * irregulars (`led`, `built`, `drove`, `grew`, `shipped`), so nothing else is
 * needed to read "Reduced revenue by 30%". The `/ed$/` fallback that used to sit
 * on top of it credited anything six characters or longer that ended in "ed" -
 * *Interested*, *Attended*, *Mentioned*, *Noted* - and it was scored at 4 points.
 * An `-ed` suffix is a spelling, not a tense; the dictionary is what decides.
 *
 * A present participle counts. "Leading a team of eight" is ordinary resume
 * style, and `classifyBulletTense` already reads a `-ing` lead as a present-tense
 * verb: calling it a verb in one report and not in the other would contradict
 * itself on the same line. What that does not license is crediting *any* `-ing`
 * token, which is why the threshold matches the tense classifier's rather than
 * being lower.
 */
export function classifyLeadingToken(text: string): LeadingTokenKind {
  const token = leadingToken(text);
  if (token.length === 0) return "unclassifiable";
  if (ACTION_VERBS.has(token)) return "action-verb";
  if (token.length >= MIN_GERUND_LENGTH && token.endsWith("ing")) return "action-verb";
  return "other";
}

/** Every non-overlapping match of `pattern` in `text`, as spans. */
function findSpans(pattern: RegExp, text: string): TextSpan[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const spans: TextSpan[] = [];
  const regex = new RegExp(pattern.source, flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex += 1;
      continue;
    }
    spans.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
  }
  return spans;
}

/** Weak phrases, de-overlapped so nested matches do not double-mark text. */
function findWeakPhraseSpans(text: string): TextSpan[] {
  const spans = WEAK_PHRASE_PATTERNS.flatMap((pattern) => findSpans(pattern, text)).sort(
    (a, b) => a.start - b.start || b.end - a.end,
  );
  const kept: TextSpan[] = [];
  let cursor = -1;
  for (const span of spans) {
    if (span.start >= cursor) {
      kept.push(span);
      cursor = span.end;
    }
  }
  return kept;
}

/** Span of the bullet's opening token, used when it is not an action verb. */
function firstTokenSpan(text: string): TextSpan | undefined {
  const leading = text.length - text.trimStart().length;
  const token = text.trimStart().split(/\s+/)[0];
  if (!token) return undefined;
  return { start: leading, end: leading + token.length, text: token };
}

/** Whether a normalized line begins with a bullet glyph. */
export function isBulletLine(line: string): boolean {
  const trimmed = line.trimStart();
  if (trimmed.length === 0) return false;
  const first = trimmed[0];
  if (first === undefined) return false;
  if (BULLET_GLYPH_SET.has(first)) return true;
  // ASCII-style bullets: "- ", "* ", "– " used by plain-text resumes.
  if ((first === "-" || first === "*") && trimmed.length > 1 && trimmed[1] === " ") return true;
  if (first === "\u2013" && trimmed.length > 1 && trimmed[1] === " ") return true;
  return false;
}

/** Remove a leading bullet glyph (and nested list glyphs) from a line. */
export function stripBulletMarker(line: string): string {
  let text = line.trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const glyph of BULLET_GLYPHS) {
      if (text.startsWith(glyph)) {
        text = text.slice(glyph.length).trim();
        changed = true;
      }
    }
    if (!changed && (text.startsWith("- ") || text.startsWith("* "))) {
      text = text.slice(2).trim();
      changed = true;
    }
  }
  return text;
}

function sectionForOffset(sections: ResumeSection[], offset: number): string | undefined {
  const section = sections.find(
    (candidate) => offset >= candidate.startIndex && offset < candidate.endIndex,
  );
  return section?.heading;
}

export interface BulletAnalysis {
  bullets: ResumeBullet[];
  /**
   * Repeated bullet wording as data.
   *
   * The duplicate rule reads `count` and `extraCopies` directly. It used to
   * build an English sentence from the number of repeated texts and then scrape
   * the number back out of it, which rated one bullet copied three times as
   * milder than two bullets copied twice and made the score depend on the
   * wording of a sentence a human reads.
   *
   * Ordered by extra copies, then by the text itself with an explicit locale, so
   * the worst offence comes first and the order never depends on the host.
   */
  duplicates: DuplicateBulletFinding[];
  /**
   * Distinct repeated texts, kept only so the existing bullet test keeps its
   * subject. Nothing in the pipeline reads it; delete it with
   * `tests/bullet-analyzer.test.ts` once the rule consumes `duplicates`.
   */
  duplicateTexts: string[];
}

/**
 * Extract bullet items from normalized text.
 *
 * Only lines that start with an explicit bullet marker are treated as
 * bullets. Paragraph-style resumes without markers produce zero bullets,
 * which rules interpret as "no bullet formatting detected" rather than as a
 * content failure.
 *
 * `_normalizedText` is the document the lines came from. Nothing here reads it:
 * every offset comes from `lineOffsets`, and `leadingTokenSpan` is measured
 * against the bullet's own text. Renamed rather than removed because deleting
 * the parameter is a signature change that `analyze.ts` and two test files
 * have to make in the same commit, and none of those files belong here.
 */
export function analyzeBullets(
  _normalizedText: string,
  lines: string[],
  lineOffsets: number[],
  sections: ResumeSection[],
): BulletAnalysis {
  const bullets: ResumeBullet[] = [];

  lines.forEach((line, index) => {
    if (line.length > MAX_BULLET_LINE_LENGTH) return;
    if (!isBulletLine(line)) return;

    const offset = lineOffsets[index] ?? 0;
    const text = stripBulletMarker(line);
    const lead = classifyLeadingToken(text);
    const weakPhraseSpans = findWeakPhraseSpans(text);
    const firstPersonSpans = findSpans(FIRST_PERSON_PATTERN, text);

    bullets.push({
      text,
      section: sectionForOffset(sections, offset),
      position: bullets.length + 1,
      wordCount: countWords(text),
      startsWithActionVerb: lead === "action-verb",
      hasFirstPerson: firstPersonSpans.length > 0,
      containsWeakPhrase: weakPhraseSpans.length > 0,
      containsNumber: /\d/.test(text),
      weakPhraseSpans,
      firstPersonSpans,
      // Only a lead that is a word but not a verb gets marked. An action verb is
      // what the check wants, and a numeric or symbolic lead has no offending
      // word to point at - marking "18%" as the wrong opening would be
      // dishonest markup, and the rule excludes it from its denominator anyway.
      leadingTokenSpan: lead === "other" ? firstTokenSpan(text) : undefined,
    });
  });

  const firstSeen = new Map<string, { text: string; count: number }>();
  for (const bullet of bullets) {
    const key = duplicateKey(bullet.text);
    if (key.length === 0) continue;
    const existing = firstSeen.get(key);
    if (existing === undefined) {
      firstSeen.set(key, { text: bullet.text, count: 1 });
    } else {
      existing.count += 1;
    }
  }

  const duplicates: DuplicateBulletFinding[] = [];
  for (const entry of firstSeen.values()) {
    if (entry.count < 2) continue;
    duplicates.push({
      // Redacted here, at the point the text enters the model, because a
      // duplicate bullet is quoted back to the reader and a bullet can carry a
      // phone number with it.
      text: redactContact(entry.text).text,
      count: entry.count,
      extraCopies: entry.count - 1,
    });
  }
  duplicates.sort(
    (left, right) =>
      right.extraCopies - left.extraCopies ||
      right.count - left.count ||
      left.text.localeCompare(right.text, "en-US"),
  );

  const duplicateTexts = duplicates.map((entry) => entry.text);

  return { bullets, duplicates, duplicateTexts };
}
