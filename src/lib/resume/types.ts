/**
 * Core data model for the ResumeGauge analysis pipeline.
 *
 * The pipeline is deliberately split into layers:
 *   SourceDocument -> ParsedResume -> ScoreReport
 *
 * Parsing layers never know about UI state, and scoring never touches React.
 */

export type ResumeFileType = "pdf" | "docx";

/* ------------------------------------------------------------------ */
/* Extracted document (parser output)                                  */
/* ------------------------------------------------------------------ */

/**
 * Structural facts discovered while reading a document. Everything here is
 * optional because parsers can only report what they can genuinely observe.
 */
export interface DocumentStructure {
  /** Number of tables detected (DOCX only). */
  tableCount?: number;
  /** Document uses multiple text columns in a section (DOCX only). */
  hasColumns?: boolean;
  /** Document has header/footer content (DOCX only). */
  hasHeaderFooter?: boolean;
  /** Number of hyperlinks (DOCX only). */
  hyperlinkCount?: number;
  /** PDF pages that produced no text but may contain images. */
  imageOnlyPages?: number[];
  /** PDF was password protected / encrypted and could not be opened. */
  encrypted?: boolean;
  /**
   * Lines whose text was interleaved from two side-by-side columns. This is
   * the measurable form of "ATS reads this in the wrong order" — a PDF that
   * fuses a left-column bullet into the right-column bullet on the same visual
   * row produces a line no human ever wrote.
   */
  interleavedLineCount?: number;
  /** Pages whose runs could not be ordered into lines with confidence. */
  ambiguousPageCount?: number;
}

/** Raw extraction result from a parser, before normalization/detection. */
export interface SourceDocument {
  fileName: string;
  fileType: ResumeFileType;
  /** Extracted text; paragraph boundaries are preserved as newlines. */
  text: string;
  pageCount?: number;
  structure?: DocumentStructure;
  /** Non-fatal problems observed while parsing, surfaced in the report. */
  warnings: ParsingWarning[];
}

/* ------------------------------------------------------------------ */
/* Normalized resume model                                             */
/* ------------------------------------------------------------------ */

export type DateFormatFamily =
  | "month-name-year"
  | "month-year"
  | "iso-month"
  | "full-date"
  | "year-only"
  | "other";

export interface ResumeDate {
  raw: string;
  year: number;
  family: DateFormatFamily;
  /** Month 1-12 when the token carried one. `Jan 2021` and `Dec 2021` differ. */
  month?: number;
  /** Character offset in the normalized text. Document order is preserved. */
  index: number;
}

/**
 * Two date tokens that belong to the same employment or education span.
 *
 * This exists because a bare year is not an ordering key. `Mar 2022 - Present`
 * has to sort as *newer* than `Jan 2019 - Dec 2024`, which no single scalar
 * year can express: the current role's latest concrete year is its start.
 */
export interface ResumeDateRange {
  /** Verbatim text of the range as written. */
  raw: string;
  startYear: number;
  startMonth?: number;
  /** `null` when the range is still open (a current role). */
  endYear: number | null;
  endMonth?: number;
  /** True when the range ends in Present / Current / now. */
  isPresent: boolean;
  /** Character offset of the range start in the normalized text. */
  index: number;
  /** True when both endpoints were understood well enough to compare. */
  isComplete: boolean;
}

/**
 * A number in a bullet, classified by what it actually measures.
 *
 * A bare `/\d/` test cannot tell "grew revenue 30%" from "released in 2020",
 * "Node 18", "v2" or "ISO 9001" — all of which contain digits and none of which
 * is an outcome. Four points used to rest on that boolean.
 */
export type MetricKind = "percent" | "currency" | "count" | "multiplier" | "duration" | "ambiguous";

export interface Metric {
  kind: MetricKind;
  /** Parsed value. Zero when the match could not be parsed numerically. */
  value: number;
  /** The exact text that produced the metric, for evidence. */
  raw: string;
  /** Offsets into the string that was passed to `extractMetrics`. */
  start: number;
  end: number;
}

export interface ResumeSection {
  id: string;
  /** Heading text as it appears in the document. */
  heading: string;
  normalizedHeading: string;
  content: string;
  startIndex: number;
  endIndex: number;
  /** Position among the detected sections, from 0, in document order. */
  order: number;
}

/**
 * A specific defect inside one bullet.
 *
 * `start`/`end` are offsets into the bullet's text. When they cover the whole
 * bullet it means the defect is a property of the whole line — a bullet that is
 * too long has no offending phrase to point at, and pretending otherwise would
 * be dishonest markup.
 */
export interface BulletMark {
  kind: BulletMarkKind;
  /** Offset of the offending text within `ResumeBullet.text`. */
  start: number;
  /** End offset (exclusive). */
  end: number;
  /** The exact offending text, for display and highlighting. */
  text: string;
  /** Short label, e.g. "Weak phrasing". */
  label: string;
  /** The check that raises this, so a finding can be traced back. */
  checkId: string;
  /** Measured fact behind the finding, e.g. "68 words · limit 46". */
  detail?: string;
  /** Concrete rewrite direction. Never invents content. */
  fix?: string;
}

export type BulletMarkKind =
  | "too-long"
  | "too-short"
  | "weak-phrase"
  | "first-person"
  | "no-action-verb"
  | "no-outcome";

export interface ResumeBullet {
  text: string;
  /** Heading of the section the bullet belongs to, when known. */
  section?: string;
  /** Position of this bullet within the document, from 1. */
  position: number;
  wordCount: number;
  startsWithActionVerb: boolean;
  hasFirstPerson: boolean;
  containsWeakPhrase: boolean;
  containsNumber: boolean;
  /** Character spans of every weak phrase found, in order. */
  weakPhraseSpans: TextSpan[];
  /** Character spans of first-person pronouns, in order. */
  firstPersonSpans: TextSpan[];
  /** Span of the opening token, used when it is not an action verb. */
  leadingTokenSpan?: TextSpan;
}

export interface TextSpan {
  start: number;
  end: number;
  text: string;
}

export interface DetectedSkill {
  term: string;
  count: number;
}

/** One exact bullet text that was used more than once. */
export interface DuplicateBulletFinding {
  /** The repeated text, already redacted for display safety. */
  text: string;
  /** How many times this exact text appears in the document. */
  count: number;
  /** Copies beyond the first — what the reader has to delete. */
  extraCopies: number;
}

export interface ContactInfo {
  hasEmail: boolean;
  hasPhone: boolean;
  hasLinkedIn: boolean;
  hasPortfolio: boolean;
  hasGitHub: boolean;
  /** Total count of detected links that are not LinkedIn/GitHub. */
  otherLinkCount: number;
}

export type SignalSeverity = "info" | "warning" | "critical";
export type Confidence = "low" | "medium" | "high";

export interface FormattingSignal {
  type: string;
  severity: SignalSeverity;
  confidence: Confidence;
  explanation: string;
}

export interface ParsingWarning {
  code: string;
  message: string;
}

export interface ResumeTextStats {
  wordCount: number;
  lineCount: number;
  characterCount: number;
  longestLineLength: number;
  longestLineRatio: number;
  maxBlankLineRun: number;
  replacementCharCount: number;
  nonAsciiRatio: number;
}

export interface ParsedResume {
  fileName: string;
  fileType: ResumeFileType;
  pageCount?: number;
  /**
   * Verbatim extracted text. Scoring needs it; the display boundary must never
   * render it. Redaction runs on the way out (see `redact.ts`), so redacting
   * here would make a present email look like a missing one.
   */
  rawText: string;
  normalizedText: string;
  /** Structural facts observed by the parser. Formatting and readability read it. */
  documentStructure?: DocumentStructure;
  sections: ResumeSection[];
  contact: ContactInfo;
  bullets: ResumeBullet[];
  dates: ResumeDate[];
  /** Paired date spans, in document order. Powers durations and chronology. */
  dateRanges: ResumeDateRange[];
  skills: DetectedSkill[];
  /** Number of mentions of generic buzzword terms (e.g. "teamwork"). */
  genericTermMentions: number;
  /**
   * Text of each bullet that appears more than once, with how often. The
   * duplicate rule reads this directly instead of re-parsing an English
   * sentence — rewording that sentence used to silently change the score.
   */
  duplicateBullets: DuplicateBulletFinding[];
  formattingSignals: FormattingSignal[];
  parsingWarnings: ParsingWarning[];
  stats: ResumeTextStats;
}

/* ------------------------------------------------------------------ */
/* Scoring model                                                       */
/* ------------------------------------------------------------------ */

export type CheckStatus =
  | "pass"
  | "warning"
  | "issue"
  | "not-applicable"
  | "unable-to-verify";

export type CheckSeverity = "info" | "low" | "medium" | "high";

export interface CheckResult {
  status: CheckStatus;
  /** What was checked, what was found, and why it matters. */
  explanation: string;
  /** Short, privacy-safe snippets that back the explanation up. */
  evidence?: string[];
  /** Concrete next step for the user. Never invents content. */
  recommendation?: string;
  /** How much confidence the detection has; used for prioritization only. */
  confidence?: Confidence;
}

export interface CheckResultWithMetadata extends CheckResult {
  checkId: string;
  categoryId: string;
  categoryName: string;
  title: string;
  description: string;
  severity: CheckSeverity;
  pointsEarned: number;
  pointsPossible: number;
}

export interface ResumeCheck {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  severity: CheckSeverity;
  /** Maximum points this check can award inside its category. */
  points: number;
  evaluate: (resume: ParsedResume) => CheckResult;
}

export interface ScoreCategory {
  id: string;
  name: string;
  description: string;
  /** Maximum configured weight of the category in the overall score. */
  weight: number;
  earned: number;
  possible: number;
  checksEvaluated: number;
  checksTotal: number;
  notApplicable: number;
  unableToVerify: number;
}

export type RecommendationPriority = "high" | "medium" | "low";

export interface Recommendation {
  checkId: string;
  title: string;
  explanation: string;
  action: string;
  priority: RecommendationPriority;
  /** Points recoverable if the user resolves this check. */
  pointsRecoverable: number;
  severity: CheckSeverity;
}

/**
 * Why a check contributed no points.
 *
 * These are two different facts and the report must not conflate them:
 * `not-applicable` means the check did not need to run (the user is not
 * expected to have a projects section on a first resume); `unable-to-verify`
 * means it wanted to run and the document would not let it.
 */
export interface ScoreCoverage {
  /** Checks that ran and produced a definite answer. */
  checksEvaluated: number;
  checksTotal: number;
  /** Checks deliberately skipped as out of scope for this document. */
  notApplicable: number;
  /** Checks that wanted to run but the extracted text could not support. */
  unableToVerify: number;
  warnings: string[];
}

export interface ScoreReport {
  score: number;
  scoreBand: ScoreBand;
  categories: ScoreCategory[];
  results: CheckResultWithMetadata[];
  criticalIssues: CheckResultWithMetadata[];
  recommendations: Recommendation[];
  coverage: ScoreCoverage;
  scoringVersion: string;
  /** File name of the analyzed document. */
  fileName: string;
}

export interface ScoreBand {
  id: "excellent" | "strong" | "good" | "fair" | "needs-work";
  label: string;
  summary: string;
}
