import { ACTION_VERBS, BULLET_GLYPHS, WEAK_PHRASES } from "./constants";
import type { ResumeBullet, ResumeSection, TextSpan } from "./types";
import { countWords } from "./text-normalizer";

const BULLET_GLYPH_SET = new Set(BULLET_GLYPHS);
const MAX_BULLET_LINE_LENGTH = 600;

/** Phrases treated as weak wording. Multi-word phrases match as substrings. */
const WEAK_PHRASE_PATTERNS = WEAK_PHRASES.map((phrase) => {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const isSingleWord = !phrase.includes(" ");
  return isSingleWord
    ? new RegExp(`\\b${escaped}\\b`, "i")
    : new RegExp(escaped, "i");
});

const FIRST_PERSON_PATTERN = /\b(i|i'm|i've|i'd|i'll|my|me|myself|mine)\b/gi;

const ACTION_VERB_SUFFIX_PATTERN = /ed$/;

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

function firstToken(text: string): string {
  return (firstTokenSpan(text)?.text ?? "").replace(/[^A-Za-z']/g, "").toLowerCase();
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
  /** Bullet texts that duplicate another bullet (ignoring case/spacing). */
  duplicateTexts: string[];
}

/**
 * Extract bullet items from normalized text.
 *
 * Only lines that start with an explicit bullet marker are treated as
 * bullets. Paragraph-style resumes without markers produce zero bullets,
 * which rules interpret as "no bullet formatting detected" rather than as a
 * content failure.
 */
export function analyzeBullets(
  normalizedText: string,
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
    const leading = firstTokenSpan(text);
    const token = firstToken(text);
    const startsWithActionVerb =
      ACTION_VERBS.has(token) ||
      (token.length >= 6 && ACTION_VERB_SUFFIX_PATTERN.test(token));
    const weakPhraseSpans = findWeakPhraseSpans(text);
    const firstPersonSpans = findSpans(FIRST_PERSON_PATTERN, text);

    bullets.push({
      text,
      section: sectionForOffset(sections, offset),
      position: bullets.length + 1,
      wordCount: countWords(text),
      startsWithActionVerb,
      hasFirstPerson: firstPersonSpans.length > 0,
      containsWeakPhrase: weakPhraseSpans.length > 0,
      containsNumber: /\d/.test(text),
      weakPhraseSpans,
      firstPersonSpans,
      leadingTokenSpan: startsWithActionVerb ? undefined : leading,
    });
  });

  const seen = new Map<string, number>();
  for (const bullet of bullets) {
    const key = bullet.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (key.length === 0) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicateTexts = [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([text]) => text);

  return { bullets, duplicateTexts };
}
