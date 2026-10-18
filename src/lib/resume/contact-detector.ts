import type { ContactInfo } from "./types";

/**
 * Anchored on the left. Without it every character position is a candidate start
 * for the local part and the scan degrades quadratically on text that has no
 * `@` in it at all - which is exactly what a two-column PDF export produces when
 * the extractor fuses space-free runs together. Measured on 32 kB of fused text:
 * 909 ms unanchored, 0.2 ms anchored.
 */
const EMAIL_PATTERN = /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

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

/**
 * Domains a candidate can be, spelled the way people write them. These run
 * before the digit test rather than after it, because a date range and a phone
 * number are indistinguishable once the separators are stripped.
 */
const FULL_DATE_PATTERN = /^\d{1,2}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{2,4}$/;
const MONTH_YEAR_PATTERN = /^\d{1,2}\s*[.\-/]\s*(?:19|20)\d{2}$/;
const ISO_MONTH_PATTERN = /^(?:19|20)\d{2}\s*-\s*(?:0?[1-9]|1[0-2])$/;
const YEAR_RANGE_PATTERN =
  /^(?:19|20)\d{2}\s*(?:-|–|—|−|to|until|till)\s*(?:(?:19|20)\d{2}|present|current|now|today|ongoing)$/i;
const MONTH_YEAR_RANGE_PATTERN =
  /^\d{1,2}\s*[.\-/]\s*(?:19|20)\d{2}\s*(?:-|–|—|−|to|until|till)\s*\d{1,2}\s*[.\-/]\s*(?:19|20)\d{2}$/i;
const YEAR_PAIR_PATTERN = /^(?:19|20)\d{2}\s+(?:19|20)\d{2}$/;

/** A chunk that could only be part of a date: `2019`, `20`, `01`. */
const CALENDAR_CHUNK_PATTERN = /^(?:\d{1,2}|(?:19|20)\d{2})$/;

const CLEANED_PHONE_PATTERN = /^\+?\d{8,15}$/;
const YEAR_GROUP_PATTERN = /^(?:19|20)\d{2}$/;

/**
 * Whether a run of digits and separators is a phone number rather than a date.
 *
 * Exported so the display boundary can ask the same question before it decides
 * what to redact: a redactor with its own idea of what a phone number is will
 * eventually disagree with the detector, and the report then claims a contact
 * detail is missing while showing it.
 */
export function isLikelyPhoneNumber(candidate: string): boolean {
  const trimmed = candidate.trim();
  // Dates use slashes; phones essentially never do.
  if (trimmed.includes("/")) return false;
  // Explicit date shapes: 12.03.2020, 12-03-2020, 03.2021, 01.2020 - 03.2021,
  // 2014 - 2018, 2020 to 2021. These all survive the separator strip below and
  // then read as an 8-15 digit number, which is how a resume with no phone
  // number at all came back as having one.
  if (
    FULL_DATE_PATTERN.test(trimmed) ||
    MONTH_YEAR_PATTERN.test(trimmed) ||
    ISO_MONTH_PATTERN.test(trimmed) ||
    YEAR_RANGE_PATTERN.test(trimmed) ||
    MONTH_YEAR_RANGE_PATTERN.test(trimmed) ||
    YEAR_PAIR_PATTERN.test(trimmed)
  ) {
    return false;
  }

  const cleaned = trimmed.replace(/[\s().-]/g, "");
  if (!CLEANED_PHONE_PATTERN.test(cleaned)) return false;

  // Reject year lists and mixed calendar chunks such as "2020 2021" or
  // "01 2020 03 2021", which are ranges rather than numbers.
  const groups = trimmed.split(/[\s().-]+/).filter((group) => group.length > 0);
  if (groups.length > 0 && groups.every((group) => YEAR_GROUP_PATTERN.test(group))) {
    return false;
  }
  if (groups.length >= 2 && groups.every((group) => CALENDAR_CHUNK_PATTERN.test(group))) {
    return false;
  }

  return true;
}

/**
 * Top-level domains a personal site actually lives on.
 *
 * `.js`, `.py` and `.sh` are absent on purpose: `Node 18`, `next.js` and
 * `script.py` are technology names that would otherwise read as websites.
 */
/**
 * A leading boundary of `^`, whitespace, a bracket/quote/`(`, an `@`, or the
 * `//` after a scheme. The `/` cases are lookbehinds rather than a character in
 * a class because the character before the host is not what matters: what
 * matters is that it is *exactly* a scheme separator. Adding `/` to the class
 * would also match the first path segment of every other link, so
 * `github.com/janedoe.dev` would report a portfolio the candidate never gave.
 */
const PORTFOLIO_TLD_PATTERN =
  /(?:^|(?<=[\s(<@])|(?<=https?:\/\/)|(?<=www\.))((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|net|org|io|dev|co|me|app|ai|tech|studio|design|page|site|xyz|info|biz|online|blog|website|works|us|uk|ca|in|de|fr|au|eu|shop|store))\b(?::\d{2,5})?(?:[/?#]\S*)?/gi;

/**
 * Hosts that parse as a site but are not one. Software vendor domains, content
 * hosts and code forges: an article link or a reference to ASP.NET is not
 * evidence that the candidate can show their work.
 *
 * The placeholder rows are the domain spellings a resume template ships with.
 * A candidate who uploads the template has demonstrated nothing, and the check
 * awards points for a link they never chose to give.
 */
const NON_PORTFOLIO_HOSTS = new Set([
  "asp.net",
  "vb.net",
  "ado.net",
  "core.windows.net",
  "node.js",
  "next.js",
  "vue.js",
  "three.js",
  "d3.js",
  "w3.org",
  "schema.org",
  "json.org",
  "xml.org",
  "nuget.org",
  "npmjs.com",
  "pypi.org",
  "medium.com",
  "substack.com",
  "dev.to",
  "stackoverflow.com",
  "wikipedia.org",
  "news.ycombinator.com",
  "youtube.com",
  "linkedin.com",
  "github.com",
]);

/**
 * Host labels a resume template ships with. `example.*` is reserved by
 * RFC 2606/6761; the rest are the fill-in-the-blank rows people leave behind
 * after deleting their own site. A candidate who uploads the template has
 * demonstrated nothing, and the check awards points for a link they never chose
 * to give.
 *
 * Matched per label rather than as whole hosts, because the template usually
 * survives as `jane.mydomain.com` and only sometimes as `mydomain.com`. `example`
 * is checked in the TLD position too: `*.example` is reserved as well, and a
 * host called `myexample.com` is a real host, which is why the label has to be
 * the whole one.
 */
const PLACEHOLDER_LABELS = new Set([
  "example",
  "domain",
  "email",
  "yourdomain",
  "yoursite",
  "mydomain",
  "mywebsite",
  "yourwebsite",
  "myportfolio",
  "yourportfolio",
  "myresum",
  "yourresum",
]);

function isReservedPlaceholderHost(host: string): boolean {
  for (const label of host.split(".")) {
    if (PLACEHOLDER_LABELS.has(label)) return true;
  }
  return false;
}

/**
 * Whether a host is a site the candidate could plausibly own.
 *
 * Returns a boolean over a host the caller already has, never the link itself:
 * this module's contract is booleans and counts out, so a helper that handed a
 * URL back would be the first thing in it to leak one.
 */
export function isPortfolioHost(candidate: string): boolean {
  const host = (candidate.replace(/^https?:\/\//i, "").split(/[/?#]/)[0] ?? "")
    .toLowerCase()
    .replace(/^www\./, "")
    .split(":")[0];
  if (host === undefined || host.length === 0) return false;
  if (NON_PORTFOLIO_HOSTS.has(host)) return false;
  return !isReservedPlaceholderHost(host);
}

/**
 * How many sites the candidate actually put in the document.
 *
 * Exported so the behaviour is assertable without running the whole detector,
 * which is what let this ship broken: the pattern accepts a leading `@` so that
 * a bare `myportfolio.com/x` is visible, and that same allowance handed the
 * domain half of every email address to `isPortfolioHost` as if it were a link.
 * `jane.roe@example.com` therefore reported a portfolio, and the contact check
 * passed a resume that contained none.
 *
 * Exported as a count rather than as the matches themselves, for the same reason
 * `isPortfolioHost` returns a boolean.
 */
export function countPortfolioLinks(text: string): number {
  let count = 0;
  PORTFOLIO_TLD_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PORTFOLIO_TLD_PATTERN.exec(text)) !== null) {
    if (match[0].length === 0) {
      PORTFOLIO_TLD_PATTERN.lastIndex += 1;
      continue;
    }
    // A candidate that sits against an `@` is part of an email address, not a
    // link: either the host half after it, or the local part before it. Rejecting
    // both ends is the actual fix - the placeholder-host list above is defence
    // in depth against the template domains this heuristic would otherwise let
    // through, and would not have helped at all here.
    //
    // Read from the character *before* the host rather than from the start of
    // the match: the boundary is a lookbehind now, so the match no longer
    // carries the `@` that a scheme-less `@`-adjacent host would have brought
    // with it.
    if (match.index > 0 && text.charAt(match.index - 1) === "@") continue;
    if (text.charAt(match.index + match[0].length) === "@") continue;
    if (isPortfolioHost(match[1] ?? "")) count += 1;
  }
  return count;
}

/**
 * Detect contact information in a privacy-conscious way: only booleans and
 * counts are returned, never the raw email, phone number or URLs. The results
 * UI must not echo personal data back to the user.
 */
export function detectContact(normalizedText: string): ContactInfo {
  // `.test()` on a global regex is stateful, so lastIndex is cleared on both
  // sides: before, because the previous call left it past the last match, and
  // after, so the next caller starts from the beginning.
  EMAIL_PATTERN.lastIndex = 0;
  const hasEmail = EMAIL_PATTERN.test(normalizedText);
  EMAIL_PATTERN.lastIndex = 0;

  let hasPhone = false;
  const phoneCandidates = normalizedText.match(PHONE_CANDIDATE_PATTERN);
  if (phoneCandidates !== null) {
    for (const candidate of phoneCandidates) {
      if (isLikelyPhoneNumber(candidate)) {
        hasPhone = true;
        break;
      }
    }
  }

  const hasLinkedIn = LINKEDIN_PATTERN.test(normalizedText);
  const hasGitHub = GITHUB_PATTERN.test(normalizedText);

  let otherLinkCount = 0;
  const urls = normalizedText.match(URL_PATTERN);
  if (urls !== null) {
    for (const url of urls) {
      const lower = url.toLowerCase();
      if (lower.includes("linkedin.com")) continue;
      if (lower.includes("github.com")) continue;
      if (lower.startsWith("mailto:")) continue;
      otherLinkCount += 1;
    }
  }

  // A portfolio is evidence the candidate can show their work, so any old link
  // is not enough: it has to be a site that looks like theirs. Counting scheme-
  // bearing links as proof is what let an article link satisfy a check worth
  // points, and what made `myportfolio.com/x` invisible because it has no
  // `https://` in front of it.
  const portfolioCount = countPortfolioLinks(normalizedText);
  otherLinkCount += portfolioCount;

  return {
    hasEmail,
    hasPhone,
    hasLinkedIn,
    hasPortfolio: portfolioCount > 0,
    hasGitHub,
    otherLinkCount,
  };
}