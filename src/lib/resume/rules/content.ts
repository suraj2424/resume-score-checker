import { SCORING_THRESHOLDS } from "@/config/scoring";
import type { ResumeCheck } from "../types";
import { bulletEvidence, percent, share } from "./helpers";

/** "Bullets 2, 5 and 7" — positions, so a reader can find them in their resume. */
function bulletPositions(counts: number[], limit = 3): string {
  const shown = counts.slice(0, limit);
  const rest = counts.length - shown.length;
  const list =
    shown.length === 1
      ? `bullet ${shown[0]}`
      : `bullets ${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
  return rest > 0 ? `${list}, and ${rest} more` : list;
}

export const contentChecks: ResumeCheck[] = [
  {
    id: "content-bullet-formatting",
    categoryId: "content",
    title: "Bullet points used for achievements",
    description:
      "Whether key achievements are presented as scannable bullet points rather than dense paragraphs.",
    severity: "low",
    points: 4,
    evaluate: (resume) => {
      const count = resume.bullets.length;
      if (resume.stats.wordCount < SCORING_THRESHOLDS.minimalWords) {
        return {
          status: "unable-to-verify",
          explanation:
            "Too little text was extracted to judge how achievements are formatted.",
          confidence: "high",
        };
      }
      if (count >= 6) {
        return {
          status: "pass",
          explanation: `${count} bullet points were detected, which makes your achievements easy to scan.`,
          confidence: "high",
        };
      }
      if (count >= 1) {
        return {
          status: "warning",
          explanation: `Only ${count} bullet ${count === 1 ? "point was" : "points were"} detected. A resume with few bullets usually relies on paragraphs, which are slower to scan.`,
          recommendation:
            "Break key achievements into short bullet points, one idea each.",
          confidence: "medium",
        };
      }
      return {
        status: "issue",
        explanation:
          "No bullet points were detected. The content may be written as paragraphs, which recruiters find harder to scan quickly.",
        recommendation:
          "Present each role and project as 2-4 short bullets describing what you did and the result.",
        confidence: "medium",
      };
    },
  },
  {
    id: "content-bullet-length",
    categoryId: "content",
    title: "Bullets are not too long",
    description:
      "Whether bullet points stay short enough to scan in a few seconds.",
    severity: "low",
    points: 4,
    evaluate: (resume) => {
      if (resume.bullets.length === 0) {
        return {
          status: "not-applicable",
          explanation:
            "No bullet points were detected, so bullet length could not be assessed.",
          confidence: "high",
        };
      }
      const limit = SCORING_THRESHOLDS.longBulletWords;
      const longBullets = resume.bullets.filter((bullet) => bullet.wordCount > limit);
      if (longBullets.length === 0) {
        return {
          status: "pass",
          explanation: `No bullet exceeds ${limit} words. Short bullets keep your resume scannable.`,
          confidence: "high",
        };
      }
      if (longBullets.length <= 2) {
        return {
          status: "warning",
          explanation: `${longBullets.length} of ${resume.bullets.length} bullets are longer than ${limit} words — ${bulletPositions(longBullets.map((b) => b.position))}.`,
          recommendation:
            "Split long bullets into two ideas, or remove the least important part.",
          evidence: longBullets.slice(0, 2).map(bulletEvidence),
          confidence: "high",
        };
      }
      return {
        status: "issue",
        explanation: `${longBullets.length} of ${resume.bullets.length} bullets are longer than ${limit} words — ${bulletPositions(longBullets.map((b) => b.position))}. Very long bullets hide your strongest points.`,
        recommendation:
          "Keep each bullet to one achievement and shorten the rest. Aim for 1-2 lines per bullet.",
        evidence: longBullets.slice(0, 3).map(bulletEvidence),
        confidence: "high",
      };
    },
  },
  {
    id: "content-bullet-conciseness",
    categoryId: "content",
    title: "Bullets contain enough detail",
    description:
      "Whether bullet points carry enough content to explain what you did.",
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      if (resume.bullets.length === 0) {
        return {
          status: "not-applicable",
          explanation:
            "No bullet points were detected, so bullet detail could not be assessed.",
          confidence: "high",
        };
      }
      const limit = SCORING_THRESHOLDS.shortBulletWords;
      const shortBullets = resume.bullets.filter((bullet) => bullet.wordCount < limit);
      if (shortBullets.length === 0) {
        return {
          status: "pass",
          explanation: `Every bullet contains at least ${limit} words, enough to describe the action and its context.`,
          confidence: "high",
        };
      }
      if (shortBullets.length <= 2) {
        return {
          status: "warning",
          explanation: `${shortBullets.length} bullet ${shortBullets.length === 1 ? "item has" : "items have"} fewer than ${limit} words and may not explain the work.`,
          recommendation:
            "Expand very short bullets with the task, the tools you used and the outcome.",
          evidence: shortBullets.slice(0, 2).map(bulletEvidence),
          confidence: "high",
        };
      }
      return {
        status: "issue",
        explanation: `${shortBullets.length} of ${resume.bullets.length} bullets are shorter than ${limit} words and carry very little information.`,
        recommendation:
          "Add the action, the tool and the result to each short bullet.",
        evidence: shortBullets.slice(0, 3).map(bulletEvidence),
        confidence: "high",
      };
    },
  },
  {
    id: "content-action-verbs",
    categoryId: "content",
    title: "Bullets start with action verbs",
    description:
      "Whether bullets begin with a clear action verb, which makes contributions easy to identify.",
    severity: "medium",
    points: 5,
    evaluate: (resume) => {
      if (resume.bullets.length === 0) {
        return {
          status: "not-applicable",
          explanation:
            "No bullet points were detected, so this check was not evaluated.",
          confidence: "high",
        };
      }
      const actionBullets = resume.bullets.filter((bullet) => bullet.startsWithActionVerb);
      const nonAction = resume.bullets.filter((bullet) => !bullet.startsWithActionVerb);
      const ratio = share(actionBullets.length, resume.bullets.length);
      if (ratio >= SCORING_THRESHOLDS.actionVerbSharePass) {
        return {
          status: "pass",
          explanation: `${percent(ratio)} of bullets start with an action verb (${actionBullets.length} of ${resume.bullets.length}).`,
          confidence: "medium",
        };
      }
      if (ratio >= SCORING_THRESHOLDS.actionVerbShareWarning) {
        return {
          status: "warning",
          explanation: `${percent(ratio)} of bullets start with an action verb. ${nonAction.length} ${nonAction.length === 1 ? "opens" : "open"} with something else: — ${bulletPositions(nonAction.map((b) => b.position))}.`,
          recommendation:
            "Rewrite bullets to open with a verb, for example: Built, Led, Analyzed, Reduced, Shipped.",
          evidence: resume.bullets
            .filter((bullet) => !bullet.startsWithActionVerb)
            .slice(0, 2)
            .map(bulletEvidence),
          confidence: "medium",
        };
      }
      return {
        status: "issue",
        explanation: `Only ${percent(ratio)} of bullets start with an action verb. Many bullets open with weak phrasing such as "Responsible for".`,
        recommendation:
          "Open each bullet with a strong verb describing your contribution.",
        evidence: resume.bullets.filter((bullet) => !bullet.startsWithActionVerb).slice(0, 3).map(bulletEvidence),
        confidence: "medium",
      };
    },
  },
  {
    id: "content-quantified-outcomes",
    categoryId: "content",
    title: "Measurable outcomes present",
    description:
      "Whether at least some bullets include numbers that describe scope or results.",
    severity: "medium",
    points: 4,
    evaluate: (resume) => {
      if (resume.bullets.length === 0) {
        return {
          status: "not-applicable",
          explanation:
            "No bullet points were detected, so measurable outcomes could not be assessed.",
          confidence: "high",
        };
      }
      const quantified = resume.bullets.filter((bullet) => bullet.containsNumber);
      const ratio = share(quantified.length, resume.bullets.length);
      if (ratio >= SCORING_THRESHOLDS.quantifiedSharePass) {
        return {
          status: "pass",
          explanation: `${percent(ratio)} of bullets contain a number, giving recruiters a sense of scope.`,
          confidence: "high",
        };
      }
      if (ratio >= SCORING_THRESHOLDS.quantifiedShareWarning) {
        return {
          status: "warning",
          explanation: `${percent(ratio)} of bullets contain a number. Numbers help a recruiter gauge the scale of your work.`,
          recommendation:
            "Consider adding a measurable result where you can genuinely support one, such as counts, sizes or timeframes. Not every bullet needs a number.",
          confidence: "high",
        };
      }
      return {
        status: "issue",
        explanation: `Only ${percent(ratio)} of bullets contain a number. Without any numbers it is hard to judge the scale of your work.`,
        recommendation:
          "Where you can support it honestly, add scale: team size, number of users, request volume, time saved. Never invent figures.",
        confidence: "high",
      };
    },
  },
  {
    id: "content-duplicate-bullets",
    categoryId: "content",
    title: "No repeated bullet wording",
    description: "Whether bullet items repeat each other.",
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      if (resume.bullets.length === 0) {
        return {
          status: "not-applicable",
          explanation:
            "No bullet points were detected, so duplicate wording could not be assessed.",
          confidence: "high",
        };
      }
      const duplicates = resume.parsingWarnings.find(
        (warning) => warning.code === "duplicate-bullets",
      );
      if (!duplicates) {
        return {
          status: "pass",
          explanation: "No repeated bullet wording was detected.",
          confidence: "high",
        };
      }
      const count = Number(duplicates.message.match(/\d+/)?.[0] ?? "1");
      if (count <= 1) {
        return {
          status: "warning",
          explanation: "One bullet appears to repeat another. Repeated wording wastes space.",
          recommendation: "Merge or rewrite the repeated bullet.",
          confidence: "medium",
        };
      }
      return {
        status: "issue",
        explanation: `${count} bullet items repeat earlier wording. Repetition suggests the resume has not been tailored.`,
        recommendation:
          "Merge repeated bullets into a single, stronger statement, or replace them with distinct achievements.",
        confidence: "medium",
      };
    },
  },
  {
    id: "content-first-person",
    categoryId: "content",
    title: "Limited first-person language",
    description:
      "Whether bullets avoid heavy use of first-person phrasing such as I, my and me.",
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      if (resume.bullets.length === 0) {
        return {
          status: "not-applicable",
          explanation:
            "No bullet points were detected, so first-person usage could not be assessed.",
          confidence: "high",
        };
      }
      const firstPerson = resume.bullets.filter((bullet) => bullet.hasFirstPerson);
      const ratio = share(firstPerson.length, resume.bullets.length);
      if (ratio <= SCORING_THRESHOLDS.firstPersonShareWarning) {
        return {
          status: "pass",
          explanation: `Only ${percent(ratio)} of bullets use first-person language.`,
          confidence: "high",
        };
      }
      if (ratio <= SCORING_THRESHOLDS.firstPersonShareWarning * 2) {
        return {
          status: "warning",
          explanation: `${percent(ratio)} of bullets use first-person language (I, my, me). Many recruiters prefer an implied-first-person style.`,
          recommendation:
            "Rewrite bullets to start with the verb, for example: \"Led a team of four\" instead of \"I led my team\".",
          evidence: firstPerson.slice(0, 2).map(bulletEvidence),
          confidence: "high",
        };
      }
      return {
        status: "issue",
        explanation: `${percent(ratio)} of bullets use first-person language, which reads informally in a resume.`,
        recommendation:
          "Remove I, my and me from bullets and let the verb carry the subject.",
        evidence: firstPerson.slice(0, 3).map(bulletEvidence),
        confidence: "high",
      };
    },
  },
  {
    id: "content-weak-wording",
    categoryId: "content",
    title: "Limited generic phrasing",
    description:
      "Whether bullets avoid generic filler phrases that carry little information.",
    severity: "low",
    points: 2,
    evaluate: (resume) => {
      if (resume.bullets.length === 0) {
        return {
          status: "not-applicable",
          explanation:
            "No bullet points were detected, so generic phrasing could not be assessed.",
          confidence: "high",
        };
      }
      const weak = resume.bullets.filter((bullet) => bullet.containsWeakPhrase);
      const ratio = share(weak.length, resume.bullets.length);
      if (ratio <= SCORING_THRESHOLDS.weakPhraseShareWarning) {
        return {
          status: "pass",
          explanation: `Only ${percent(ratio)} of bullets use generic phrasing.`,
          confidence: "high",
        };
      }
      if (ratio <= SCORING_THRESHOLDS.weakPhraseShareWarning * 2) {
        return {
          status: "warning",
          explanation: `${percent(ratio)} of bullets use generic phrasing such as "Responsible for" or "Worked on".`,
          recommendation:
            "Replace generic phrasing with the specific action you took.",
          evidence: weak.slice(0, 2).map(bulletEvidence),
          confidence: "high",
        };
      }
      return {
        status: "issue",
        explanation: `${percent(ratio)} of bullets rely on generic phrasing that describes duty rather than contribution.`,
        recommendation:
          "Rewrite the bullet around the action and the outcome: what you did, how, and what changed.",
        evidence: weak.slice(0, 3).map(bulletEvidence),
        confidence: "high",
      };
    },
  },
];

export const CONTENT_POINTS = contentChecks.reduce((sum, check) => sum + check.points, 0);
