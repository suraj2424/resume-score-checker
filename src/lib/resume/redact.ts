/**
 * Keep contact details out of anything the report displays.
 *
 * The privacy policy promises that the report never shows an address, number or
 * link. Until now that was easy to honour, because the report only ever quoted
 * truncated bullet text as evidence. The marked-up bullet ledger shows whole
 * lines, so a bullet could carry an email or a phone number into the report.
 * Redacting at the display boundary keeps the promise true rather than
 * aspirational.
 *
 * This runs on the way out, never on the way in: the scoring engine still reads
 * the real text, because an email redacted before the contact checks ran would
 * look like a missing one.
 */

const PATTERN = new RegExp(
  [
    "\\b[\\w.+-]+@[\\w-]+\\.[\\w.-]+\\b", // email
    "\\blinkedin\\.com/[\\w/-]+", // linkedin
    "\\bgithub\\.com/[\\w/-]+", // github
    "\\b(?:https?://|www\\.)\\S+", // url
    "(?:\\+?\\d{1,3}[\\s.-]?)?(?:\\(\\d{2,4}\\)[\\s.-]?)?\\d{3,4}[\\s.-]\\d{3,4}(?:[\\s.-]\\d{2,4})?", // phone
  ].join("|"),
  "gi",
);

const EMAIL_LABEL = "[email removed]";
const LINK_LABEL = "[link removed]";
const PHONE_LABEL = "[phone removed]";

function labelFor(match: string): string {
  if (match.includes("@")) return EMAIL_LABEL;
  if (/linkedin\.com|github\.com|:\/\/|^www\./i.test(match)) return LINK_LABEL;
  return PHONE_LABEL;
}

export interface RedactedText {
  /** The text with contact details replaced by labels. */
  text: string;
  /** Offsets into `text` that were redacted. Nothing may be highlighted across one. */
  spans: Array<{ start: number; end: number }>;
  redacted: boolean;
  /**
   * Translates an offset in the original text to the redacted text. Marks are
   * found against the original, so they have to be moved before they can be
   * drawn — otherwise a highlight drifts off the words it refers to.
   */
  map: (offset: number) => number;
}

/**
 * Replace contact details with a short label, keeping an offset map so callers
 * can still position marks against the original text.
 */
export function redactContact(input: string): RedactedText {
  // Segments of original text copied verbatim, with where they landed.
  const copied: Array<{ origStart: number; origEnd: number; newStart: number }> = [];
  const spans: Array<{ start: number; end: number }> = [];

  let out = "";
  let cursor = 0;
  let redacted = false;

  const copyChunk = (from: number, to: number) => {
    if (to <= from) return;
    copied.push({ origStart: from, origEnd: to, newStart: out.length });
    out += input.slice(from, to);
  };

  const regex = new RegExp(PATTERN.source, PATTERN.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex += 1;
      continue;
    }
    copyChunk(cursor, match.index);
    const label = labelFor(match[0]);
    spans.push({ start: out.length, end: out.length + label.length });
    out += label;
    cursor = match.index + match[0].length;
    redacted = true;
  }
  copyChunk(cursor, input.length);

  const map = (offset: number): number => {
    for (const segment of copied) {
      if (offset >= segment.origStart && offset <= segment.origEnd) {
        return segment.newStart + (offset - segment.origStart);
      }
    }
    // Offset fell inside a redaction: clamp to the start of the label.
    const fallback = copied.find((segment) => offset < segment.origStart);
    return fallback ? fallback.newStart : out.length;
  };

  return { text: out, spans, redacted, map };
}

/** True when any part of [start, end) overlaps a redacted span. */
export function overlapsRedaction(
  spans: Array<{ start: number; end: number }>,
  start: number,
  end: number,
): boolean {
  return spans.some((span) => start < span.end && end > span.start);
}