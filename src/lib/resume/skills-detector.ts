import { GENERIC_TERMS, RECOGNIZED_SKILLS } from "./constants";
import type { DetectedSkill } from "./types";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface TermMatcher {
  pattern: RegExp;
  lookup: Map<string, string>;
}

/**
 * Terms are matched with lookarounds instead of \b so entries like "c++" and
 * "next.js" behave predictably, and so "react" does not match "reactive".
 *
 * The alternation is large, but its lookbehind fails in O(1) at nearly every
 * position, which is what keeps it cheap: 0.9 ms on 26 kB of resume text. The
 * construction, not the pattern, was the cost worth removing.
 */
function buildTermMatcher(terms: string[]): TermMatcher {
  const sorted = [...new Set(terms)].sort((a, b) => b.length - a.length);
  const lookup = new Map<string, string>();
  for (const term of sorted) {
    lookup.set(term.toLowerCase(), term);
  }
  const pattern = new RegExp(
    `(?<![A-Za-z0-9+#.])(?:${sorted.map(escapeRegExp).join("|")})(?![A-Za-z0-9+#.])`,
    "gi",
  );
  return { pattern, lookup };
}

const SKILL_MATCHER = buildTermMatcher(RECOGNIZED_SKILLS);
const GENERIC_MATCHER = buildTermMatcher(GENERIC_TERMS);

export interface SkillsAnalysis {
  skills: DetectedSkill[];
  genericMentions: number;
  distinctSkillCount: number;
  totalSkillMentions: number;
}

/**
 * Detect terms from the curated dictionaries. The result is a *signal*, not
 * an inventory: the UI presents it as "terms we recognized", and no skill is
 * ever inferred that does not literally appear in the document.
 */
export function detectSkills(normalizedText: string): SkillsAnalysis {
  const counts = new Map<string, DetectedSkill>();

  // The compiled patterns live at module scope now, which makes them shared
  // mutable state: `.exec()` on a global regex advances `lastIndex` and would
  // otherwise leave the next call starting mid-string. Both are reset on the way
  // in and on the way out.
  const skillPattern = SKILL_MATCHER.pattern;
  skillPattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = skillPattern.exec(normalizedText)) !== null) {
    if (match[0].length === 0) {
      skillPattern.lastIndex += 1;
      continue;
    }
    const canonical = SKILL_MATCHER.lookup.get(match[0].toLowerCase());
    if (!canonical) continue;
    const existing = counts.get(canonical);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(canonical, { term: canonical, count: 1 });
    }
  }
  skillPattern.lastIndex = 0;

  const genericPattern = GENERIC_MATCHER.pattern;
  genericPattern.lastIndex = 0;
  let genericMentions = 0;
  while ((match = genericPattern.exec(normalizedText)) !== null) {
    if (match[0].length === 0) {
      genericPattern.lastIndex += 1;
      continue;
    }
    genericMentions += 1;
  }
  genericPattern.lastIndex = 0;

  const skills = [...counts.values()].sort(
    (a, b) => b.count - a.count || a.term.localeCompare(b.term, "en-US"),
  );

  return {
    skills,
    genericMentions,
    distinctSkillCount: skills.length,
    totalSkillMentions: skills.reduce((sum, skill) => sum + skill.count, 0),
  };
}
