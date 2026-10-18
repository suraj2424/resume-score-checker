import { SCORING_THRESHOLDS } from "@/config/scoring";
import { classifyLeadingToken } from "../bullet-analyzer";
import { extractMetrics } from "../metric-parser";
import type { CheckResult, ParsedResume, ResumeCheck } from "../types";
import type { ContentSource, ContentUnit } from "./helpers";
import {
  classifyBulletTense,
  contentUnits,
  percent,
  quoteRedacted,
  share,
} from "./helpers";

/** "bullets" or "paragraphs" - every explanation names what was measured. */
const UNIT_LABEL: Record<Exclude<ContentSource["kind"], "none">, string> = {
  bullets: "bullets",
  paragraphs: "paragraphs",
};

/** The two unit kinds that can actually be measured. */
type MeasuredSource = ContentSource & { kind: Exclude<ContentSource["kind"], "none"> };

/**
 * Content units with the "nothing to measure" case removed.
 *
 * `contentUnits` returns a flat `ContentSource`, and a flat union cannot be
 * discriminated by `units.length === 0`: the compiler has no reason to treat an
 * empty bullet list as an impossible `kind: "bullets"`. Every check here
 * therefore indexed a `Record` with no `"none"` key using a kind that might be
 * `"none"`, and each of those seven reads became an implicit `any` under
 * type-aware lint. Narrowing once here is what keeps the index total, and the
 * rebuilt object means the narrowed type is proven by the compiler rather than
 * asserted by hand.
 *
 * The two facts coincide in `contentUnits` - it returns `kind: "none"` only when
 * it also returns no units - so this drops nothing a check could otherwise have
 * measured.
 */
function measuredSource(resume: ParsedResume): MeasuredSource | undefined {
  const source = contentUnits(resume);
  if (source.kind === "none" || source.units.length === 0) return undefined;
  return { kind: source.kind, units: source.units };
}

/** How many separate units make a document scannable rather than one wall. */
const SCANNABLE_UNIT_COUNT = 2;

/**
 * An improvement of more than this times the baseline is possible and almost
 * never true: it is what "improved by 300%" is. Needs a home in
 * `SCORING_THRESHOLDS` - see the handover note - and until then it is annotated
 * on the finding rather than allowed to move points on its own.
 */
const IMPLAUSIBLE_PERCENT_CHANGE = 100;

/** A figure near one of these words is a claim about change, not an identifier. */
const INCREASE_VERB =
  /\b(?:increas\w*|improv\w*|boost\w*|grew|grow|growth|raised?|sav(?:ed|ings)|reduc\w*|cut|accelerat\w*|faster|speedup)\b/i;

/**
 * "paragraphs 10 and 11" - positions, so a reader can find them in their resume.
 *
 * The label is singular when only one is shown: "paragraph 11" reads as a
 * different measurement from "paragraphs 10 and paragraphs 11".
 *
 * Built from `slice`/`join` rather than `named[named.length - 1]`: under
 * `noUncheckedIndexedAccess` that read is `string | undefined`, and an empty
 * `units` would have printed the literal word "undefined" into an explanation a
 * reader is being asked to trust.
 */
function unitPositions(units: ContentUnit[], label: string, limit = 3): string {
  if (units.length === 0) return "";
  const noun = singularLabel(label);
  const shown = units.slice(0, limit);
  const rest = units.length - shown.length;
  const head = shown
    .slice(0, -1)
    .map((unit) => `${noun} ${unit.position}`)
    .join(", ");
  const tail = shown
    .slice(-1)
    .map((unit) => `${noun} ${unit.position}`)
    .join("");
  const list = shown.length === 1 ? tail : `${head} and ${tail}`;
  return rest > 0 ? `${list}, and ${rest} more` : list;
}

/** Same key `bullet-analyzer` uses, so a re-wrapped repeat still counts. */
function repeatKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** "bullets" -> "bullet", "paragraphs" -> "paragraph". */
function singularLabel(label: string): string {
  return label.replace(/s$/, "");
}

function noContent(): CheckResult {
  return {
    status: "unable-to-verify",
    explanation:
      "No bullet points and no paragraph content were found to measure, so this check was excluded rather than counted as a failure.",
    confidence: "high",
  };
}

/** Evidence for the worst few units, quoted with contact details removed. */
function unitEvidence(units: ContentUnit[], limit = 3): string[] {
  return units.slice(0, limit).map((unit) => quoteRedacted(unit.text));
}

export const contentChecks: ResumeCheck[] = [
  {
    id: "content-bullet-formatting",
    categoryId: "content",
    title: "Achievements are broken into scannable units",
    description:
      "Whether the work is presented as separate, quickly scannable units - bullet points where bullets are used, short paragraphs where they are not.",
    severity: "medium",
    points: 4,
    evaluate: (resume) => {
      if (resume.stats.wordCount < SCORING_THRESHOLDS.minimalWords) {
        return {
          status: "unable-to-verify",
          explanation: "Too little text was extracted to judge how achievements are formatted.",
          confidence: "high",
        };
      }

      const source = measuredSource(resume);
      if (source === undefined) return noContent();

      if (source.kind === "paragraphs") {
        const count = source.units.length;
        if (count >= SCANNABLE_UNIT_COUNT) {
          return {
            status: "pass",
            explanation: `No bullet markers were used. The document is written as ${count} paragraphs, and each paragraph was measured as a single unit by the content checks below. Paragraph style is a legitimate way to write a resume; what matters is that the work is separated into blocks a reader can get through.`,
            confidence: "medium",
          };
        }
        return {
          status: "warning",
          explanation: `The document's content was extracted as a single block of ${count} paragraph. Nothing separates one achievement from the next, so a reader has to read it all to find any of it.`,
          recommendation:
            "Break the work into separate blocks - one paragraph per role, project or responsibility - and keep each to a few sentences.",
          confidence: "medium",
        };
      }

      const count = source.units.length;
      if (count >= 6) {
        return {
          status: "pass",
          explanation: `${count} bullet points were detected, which makes your achievements easy to scan.`,
          confidence: "high",
        };
      }
      return {
        status: "warning",
        explanation: `Only ${count} bullet ${count === 1 ? "point was" : "points were"} detected. Bullets are the unit every other content check below was measured against, so few of them means little of the resume was assessed.`,
        recommendation: "Break key achievements into short bullet points, one idea each.",
        evidence: unitEvidence(source.units, 2),
        confidence: "medium",
      };
    },
  },
  {
    id: "content-bullet-length",
    categoryId: "content",
    title: "Units are not too long",
    description:
      "Whether each unit stays short enough to scan in a few seconds.",
    severity: "medium",
    points: 3,
    evaluate: (resume) => {
      const source = measuredSource(resume);
      if (source === undefined) return noContent();
      const label = UNIT_LABEL[source.kind];

      const limit = SCORING_THRESHOLDS.longBulletWords;
      const long = source.units.filter((unit) => unit.wordCount > limit);
      const ratio = share(long.length, source.units.length);

      if (long.length === 0) {
        return {
          status: "pass",
          explanation: `No ${label} exceeds ${limit} words. Short ${label} keep a resume scannable.`,
          confidence: "high",
        };
      }
      if (ratio <= SCORING_THRESHOLDS.longBulletShareWarning) {
        return {
          status: "warning",
          explanation: `${long.length} of ${source.units.length} ${label} (${percent(ratio)}) are longer than ${limit} words - ${unitPositions(long, label)}. Very long ${label} hide your strongest points.`,
          recommendation: "Split each into two ideas, or remove the least important part.",
          evidence: unitEvidence(long, 2),
          confidence: "high",
        };
      }
      return {
        status: "issue",
        explanation: `${long.length} of ${source.units.length} ${label} (${percent(ratio)}) are longer than ${limit} words - ${unitPositions(long, label)}. A third or more of the document is text a reader has to slow down for.`,
        recommendation:
          "Keep each unit to one achievement and shorten the rest. Aim for 1-2 lines each.",
        evidence: unitEvidence(long, 3),
        confidence: "high",
      };
    },
  },
  {
    id: "content-bullet-conciseness",
    categoryId: "content",
    title: "Units carry enough detail",
    description:
      "Whether each unit says enough to explain what was actually done.",
    severity: "low",
    points: 1,
    evaluate: (resume) => {
      const source = measuredSource(resume);
      if (source === undefined) return noContent();
      const label = UNIT_LABEL[source.kind];

      const limit = SCORING_THRESHOLDS.shortBulletWords;
      const short = source.units.filter((unit) => unit.wordCount < limit);
      const ratio = share(short.length, source.units.length);

      if (short.length === 0) {
        return {
          status: "pass",
          explanation: `Every ${singularLabel(label)} contains at least ${limit} words, enough to describe the action and its context.`,
          confidence: "high",
        };
      }
      if (ratio <= SCORING_THRESHOLDS.shortBulletShareWarning) {
        return {
          status: "warning",
          explanation: `${short.length} ${label} (${percent(ratio)}) ${short.length === 1 ? "is" : "are"} shorter than ${limit} words and may not explain the work - ${unitPositions(short, label)}.`,
          recommendation:
            "Expand the very short ones with the task, the tools you used and the outcome.",
          evidence: unitEvidence(short, 2),
          confidence: "high",
        };
      }
      return {
        status: "issue",
        explanation: `${short.length} of ${source.units.length} ${label} (${percent(ratio)}) ${short.length === 1 ? "is" : "are"} shorter than ${limit} words and ${short.length === 1 ? "carries" : "carry"} very little information - ${unitPositions(short, label)}.`,
        recommendation: "Add the action, the tool and the result to each of them.",
        evidence: unitEvidence(short, 3),
        confidence: "high",
      };
    },
  },
  {
    id: "content-action-verbs",
    categoryId: "content",
    title: "Units open with an action verb",
    description:
      "Whether each unit begins with a clear action verb, which makes the contribution easy to identify.",
    severity: "medium",
    points: 4,
    evaluate: (resume) => {
      const source = measuredSource(resume);
      if (source === undefined) return noContent();
      const label = UNIT_LABEL[source.kind];

      // Re-classified here rather than read off `ContentUnit.startsWithActionVerb`
      // because the two builders of that field disagree: the bullet path accepted
      // any `-ed` word, the paragraph path did not. Re-running the one
      // classifier over `unit.text` - which is byte-identical to the bullet's own
      // text, so the answer cannot drift - is what makes a bullet and a paragraph
      // answer this check the same way.
      const action: ContentUnit[] = [];
      const other: ContentUnit[] = [];
      for (const unit of source.units) {
        const lead = classifyLeadingToken(unit.text);
        if (lead === "action-verb") action.push(unit);
        else if (lead === "other") other.push(unit);
      }

      const classified = action.length + other.length;
      if (classified === 0) {
        return {
          status: "unable-to-verify",
          explanation:
            "None of the extracted units open with a word that could be read as a verb, so there was no verb to credit or to fault. Units that open with a figure or a symbol are excluded from this check rather than counted as failures.",
          confidence: "medium",
        };
      }

      const ratio = share(action.length, classified);
      const excluded = source.units.length - classified;

      if (ratio >= SCORING_THRESHOLDS.actionVerbSharePass) {
        return {
          status: "pass",
          explanation: `${percent(ratio)} of ${label} open with an action verb (${action.length} of ${classified}).${excluded > 0 ? ` ${excluded} open with a figure or a symbol and were not counted.` : ""}`,
          confidence: "medium",
        };
      }
      if (ratio >= SCORING_THRESHOLDS.actionVerbShareWarning) {
        return {
          status: "warning",
          explanation: `${percent(ratio)} of ${label} open with an action verb. ${other.length} ${other.length === 1 ? "opens" : "open"} with something else - ${unitPositions(other, label)}.`,
          recommendation:
            "Rewrite to open with a verb, for example: Built, Led, Analyzed, Reduced, Shipped.",
          evidence: unitEvidence(other, 2),
          confidence: "medium",
        };
      }
      return {
        status: "issue",
        explanation: `Only ${percent(ratio)} of ${label} open with an action verb. Many start with weak phrasing such as "Responsible for".`,
        recommendation: "Open each unit with a strong verb describing your contribution.",
        evidence: unitEvidence(other, 3),
        confidence: "medium",
      };
    },
  },
  {
    id: "content-quantified-outcomes",
    categoryId: "content",
    title: "Measurable outcomes present",
    description:
      "Whether at least some units include a figure that measures scope or results, rather than a version number or a year.",
    severity: "medium",
    points: 4,
    evaluate: (resume) => {
      const source = measuredSource(resume);
      if (source === undefined) return noContent();
      const label = UNIT_LABEL[source.kind];

      const quantified = source.units.filter((unit) => unit.hasOutcome);
      const ratio = share(quantified.length, source.units.length);

      // A percent figure an order of magnitude past the baseline is flagged
      // wherever it appears, because it is the kind of number a reader repeats
      // without checking it. The figure is named: "more than 100%" is a rule,
      // while "claims 300%" is the number a reader has to defend.
      const implausible = source.units.filter((unit) => {
        if (!INCREASE_VERB.test(unit.text)) return false;
        return extractMetrics(unit.text).some(
          (metric) => metric.kind === "percent" && metric.value > IMPLAUSIBLE_PERCENT_CHANGE,
        );
      });
      const largestClaim =
        implausible.length > 0
          ? Math.max(
              ...implausible.flatMap((unit) =>
                extractMetrics(unit.text)
                  .filter((metric) => metric.kind === "percent")
                  .map((metric) => metric.value),
              ),
            )
          : 0;

      const caveat =
        implausible.length > 0
          ? ` ${implausible.length} ${implausible.length === 1 ? "unit claims" : "units claim"} a change of more than ${IMPLAUSIBLE_PERCENT_CHANGE}% - ${unitPositions(implausible, label)}, the largest at ${largestClaim}% - which is possible from a small baseline and worth checking before it is repeated.`
          : "";

      if (ratio >= SCORING_THRESHOLDS.quantifiedSharePass) {
        return {
          status: "pass",
          explanation: `${percent(ratio)} of ${label} contain a figure that measures something, giving recruiters a sense of scope.${caveat}`,
          ...(implausible.length > 0 ? { evidence: unitEvidence(implausible, 2) } : {}),
          confidence: "high",
        };
      }
      if (ratio >= SCORING_THRESHOLDS.quantifiedShareWarning) {
        return {
          status: "warning",
          explanation: `${percent(ratio)} of ${label} contain a figure that measures something.${caveat} Numbers help a recruiter gauge the scale of your work.`,
          recommendation:
            "Consider adding a measurable result where you can genuinely support one, such as counts, sizes or timeframes. Not every unit needs a number.",
          ...(implausible.length > 0 ? { evidence: unitEvidence(implausible, 2) } : {}),
          confidence: "high",
        };
      }
      return {
        status: "issue",
        explanation: `Only ${percent(ratio)} of ${label} contain a figure that measures something. Years, version numbers and standard identifiers are not counted as outcomes.${caveat}`,
        recommendation:
          "Where you can support it honestly, add scale: team size, number of users, request volume, time saved. Never invent figures.",
        ...(implausible.length > 0 ? { evidence: unitEvidence(implausible, 2) } : {}),
        confidence: "high",
      };
    },
  },
  {
    id: "content-duplicate-bullets",
    categoryId: "content",
    title: "No repeated unit wording",
    description: "Whether one achievement repeats another.",
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      const source = measuredSource(resume);
      if (source === undefined) return noContent();
      const label = UNIT_LABEL[source.kind];

      // Read the structured findings directly. This used to build an English
      // sentence from a count and then scrape the number back out of it, which
      // rated one unit copied three times as milder than two units copied twice
      // and made the score depend on the wording of a sentence a human reads.
      //
      // The parser only produces those findings for real bullets, so a paragraph
      // document is measured here on the same terms rather than losing two points
      // for a format the writer chose.
      const counts = new Map<string, { count: number; text: string }>();
      for (const unit of source.units) {
        const key = repeatKey(unit.text);
        if (key.length === 0) continue;
        const existing = counts.get(key);
        if (existing === undefined) counts.set(key, { count: 1, text: unit.text });
        else existing.count += 1;
      }
      const repeated = [...counts.values()]
        .filter((entry) => entry.count > 1)
        .map((entry) => ({
          text: entry.text,
          count: entry.count,
          extraCopies: entry.count - 1,
        }))
        .sort(
          (left, right) =>
            right.extraCopies - left.extraCopies ||
            left.text.localeCompare(right.text, "en-US"),
        );

      if (repeated.length === 0) {
        return {
          status: "pass",
          explanation: `No repeated ${label} wording was detected.`,
          confidence: "high",
        };
      }

      const worst = repeated[0]!;
      const extraCopies = repeated.reduce((total, finding) => total + finding.extraCopies, 0);
      const severe = worst.extraCopies >= 2 || extraCopies >= 3;

      return {
        status: severe ? "issue" : "warning",
        explanation: `${repeated.length === 1 ? `One ${singularLabel(label)} appears ${worst.count} times` : `${repeated.length} ${label} repeat earlier wording, and the most repeated appears ${worst.count} times`}, for ${extraCopies} ${extraCopies === 1 ? "copy" : "copies"} in total. ${severe ? "Repetition of this much suggests the resume has not been tailored to the role." : "Repeated wording wastes space that another achievement could use."}`,
        recommendation:
          "Merge repeated items into a single, stronger statement, or replace them with distinct achievements.",
        evidence: [`Appears ${worst.count} times: ${quoteRedacted(worst.text)}`],
        confidence: "medium",
      };
    },
  },
  {
    id: "content-first-person",
    categoryId: "content",
    title: "Limited first-person language",
    description:
      "Whether units avoid heavy use of first-person phrasing such as I, my and me.",
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      const source = measuredSource(resume);
      if (source === undefined) return noContent();
      const label = UNIT_LABEL[source.kind];

      const first = source.units.filter((unit) => unit.hasFirstPerson);
      const ratio = share(first.length, source.units.length);

      if (ratio <= SCORING_THRESHOLDS.firstPersonShareWarning) {
        return {
          status: "pass",
          explanation: `Only ${percent(ratio)} of ${label} use first-person language.`,
          confidence: "high",
        };
      }
      if (ratio <= SCORING_THRESHOLDS.firstPersonShareWarning * 2) {
        return {
          status: "warning",
          explanation: `${percent(ratio)} of ${label} use first-person language (I, my, me). Many recruiters prefer an implied-first-person style.`,
          recommendation:
            "Rewrite to start with the verb, for example: \"Led a team of four\" instead of \"I led my team\".",
          evidence: unitEvidence(first, 2),
          confidence: "high",
        };
      }
      return {
        status: "issue",
        explanation: `${percent(ratio)} of ${label} use first-person language, which reads informally in a resume.`,
        recommendation: "Remove I, my and me and let the verb carry the subject.",
        evidence: unitEvidence(first, 3),
        confidence: "high",
      };
    },
  },
  {
    id: "content-weak-wording",
    categoryId: "content",
    title: "Limited generic phrasing",
    description:
      "Whether units avoid filler phrases, passive constructions and contributor verbs that carry little information.",
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      const source = measuredSource(resume);
      if (source === undefined) return noContent();
      const label = UNIT_LABEL[source.kind];

      const weak = source.units.filter((unit) => unit.containsWeakPhrase);
      const ratio = share(weak.length, source.units.length);

      if (ratio <= SCORING_THRESHOLDS.weakPhraseShareWarning) {
        return {
          status: "pass",
          explanation: `Only ${percent(ratio)} of ${label} rely on generic phrasing, passive constructions or contributor verbs.`,
          confidence: "high",
        };
      }
      if (ratio <= SCORING_THRESHOLDS.weakPhraseShareWarning * 2) {
        return {
          status: "warning",
          explanation: `${percent(ratio)} of ${label} use generic phrasing such as "Responsible for" or "Worked on", or hide the actor in a passive construction.`,
          recommendation: "Replace generic phrasing with the specific action you took.",
          evidence: unitEvidence(weak, 2),
          confidence: "high",
        };
      }
      return {
        status: "issue",
        explanation: `${percent(ratio)} of ${label} rely on generic phrasing or passive constructions that describe duty rather than contribution.`,
        recommendation:
          "Rewrite around the action and the outcome: what you did, how, and what changed.",
        evidence: unitEvidence(weak, 3),
        confidence: "high",
      };
    },
  },
  {
    id: "content-tense-consistency",
    categoryId: "content",
    title: "Units use one tense",
    description:
      "Whether past tense is used for completed work and present tense for the current role, rather than the two being mixed at random.",
    severity: "medium",
    points: 3,
    evaluate: (resume) => {
      const source = measuredSource(resume);
      if (source === undefined) return noContent();
      const label = UNIT_LABEL[source.kind];

      const past: ContentUnit[] = [];
      const present: ContentUnit[] = [];
      let neutral = 0;
      for (const unit of source.units) {
        const tense = classifyBulletTense(unit.text);
        if (tense === "past") past.push(unit);
        else if (tense === "present") present.push(unit);
        else neutral += 1;
      }

      const classified = past.length + present.length;
      if (classified === 0) {
        return {
          status: "unable-to-verify",
          explanation:
            "None of the extracted units begin with a verb form this check can classify, so there was no tense to be inconsistent about. Units that open with a number or a noun make no tense claim at all and are not counted as wrong.",
          confidence: "medium",
        };
      }

      const dominant = past.length >= present.length ? past : present;
      const minor = dominant === past ? present : past;
      const ratio = share(dominant.length, classified);
      const dominantName = dominant === past ? "past" : "present";

      if (ratio >= SCORING_THRESHOLDS.tenseConsistencyPass) {
        return {
          status: "pass",
          explanation: `${percent(ratio)} of the ${classified} ${label} that name a verb use ${dominantName} tense.${
            neutral > 0 ? ` ${neutral} open with a number or a noun and were not counted.` : ""
          }`,
          confidence: "medium",
        };
      }

      return {
        status: ratio >= SCORING_THRESHOLDS.tenseConsistencyWarning ? "warning" : "issue",
        explanation: `${percent(ratio)} of the ${classified} ${label} that name a verb use ${dominantName} tense; ${minor.length} ${minor.length === 1 ? "uses" : "use"} the other - ${unitPositions(minor, label)}. Mixing the two reads as an editing slip rather than a choice.`,
        recommendation:
          "Use past tense for roles you have left and present tense for the one you are in.",
        evidence: unitEvidence(minor, 3),
        confidence: "medium",
      };
    },
  },
];
