import { GENERIC_TERMS, RECOGNIZED_SKILLS } from "./constants";
import type { DetectedSkill } from "./types";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Terms are matched with lookarounds instead of \b so entries like "c++" and
 * "next.js" behave predictably, and so "react" does not match "reactive".
 */
function buildTermMatcher(terms: string[]): {
  pattern: RegExp;
  lookup: Map<string, string>;
} {
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

  const skillPattern = new RegExp(SKILL_MATCHER.pattern.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = skillPattern.exec(normalizedText)) !== null) {
    const canonical = SKILL_MATCHER.lookup.get(match[0].toLowerCase());
    if (!canonical) continue;
    const existing = counts.get(canonical);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(canonical, { term: canonical, count: 1 });
    }
  }

  const genericPattern = new RegExp(GENERIC_MATCHER.pattern.source, "gi");
  let genericMentions = 0;
  while ((match = genericPattern.exec(normalizedText)) !== null) {
    genericMentions += 1;
  }

  const skills = [...counts.values()].sort(
    (a, b) => b.count - a.count || a.term.localeCompare(b.term),
  );

  return {
    skills,
    genericMentions,
    distinctSkillCount: skills.length,
    totalSkillMentions: skills.reduce((sum, skill) => sum + skill.count, 0),
  };
}
