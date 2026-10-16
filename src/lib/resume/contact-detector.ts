import type { ContactInfo } from "./types";

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

/** Runs of characters that look like a phone number. */
const PHONE_CANDIDATE_PATTERN = /(?:\+?\d[\d\s().-]{6,}\d)/g;

/**
 * Detection-only patterns below are intentionally non-global: `.test()` on a
 * global regex is stateful (lastIndex persists between calls) and would make
 * detection non-deterministic.
 */
const LINKEDIN_PATTERN = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|pub|company)\/[\w.-]+/i;
const GITHUB_PATTERN = /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w.-]+/i;
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s,)"'<>]+/gi;

const FULL_DATE_PATTERN = /^\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}$/;
const MONTH_YEAR_PATTERN = /^\d{1,2}[.\-/]\d{4}$/;

function isLikelyPhoneNumber(candidate: string): boolean {
  const trimmed = candidate.trim();
  // Dates use slashes; phones essentially never do.
  if (trimmed.includes("/")) return false;
  // Explicit date shapes: 12.03.2020, 12-03-2020, 03.2021.
  if (FULL_DATE_PATTERN.test(trimmed) || MONTH_YEAR_PATTERN.test(trimmed)) return false;

  const cleaned = trimmed.replace(/[\s().-]/g, "");
  if (!/^\+?\d{8,15}$/.test(cleaned)) return false;

  // Reject year lists and year ranges such as "2014 - 2018" or "2020 2021".
  const groups = trimmed.split(/[\s().-]+/).filter((group) => group.length > 0);
  if (groups.length > 0 && groups.every((group) => /^(?:19|20)\d{2}$/.test(group))) {
    return false;
  }

  return true;
}

/**
 * Detect contact information in a privacy-conscious way: only booleans and
 * counts are returned, never the raw email, phone number or URLs. The results
 * UI must not echo personal data back to the user.
 */
export function detectContact(normalizedText: string): ContactInfo {
  const emails = normalizedText.match(EMAIL_PATTERN) ?? [];
  const hasEmail = emails.length > 0;

  let hasPhone = false;
  for (const candidate of normalizedText.match(PHONE_CANDIDATE_PATTERN) ?? []) {
    if (isLikelyPhoneNumber(candidate)) {
      hasPhone = true;
      break;
    }
  }

  const hasLinkedIn = LINKEDIN_PATTERN.test(normalizedText);
  const hasGitHub = GITHUB_PATTERN.test(normalizedText);

  let otherLinkCount = 0;
  for (const url of normalizedText.match(URL_PATTERN) ?? []) {
    const lower = url.toLowerCase();
    if (lower.includes("linkedin.com")) continue;
    if (lower.includes("github.com")) continue;
    if (lower.startsWith("mailto:")) continue;
    otherLinkCount += 1;
  }

  return {
    hasEmail,
    hasPhone,
    hasLinkedIn,
    hasPortfolio: otherLinkCount > 0,
    hasGitHub,
    otherLinkCount,
  };
}
