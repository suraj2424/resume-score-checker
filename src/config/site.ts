/**
 * Central site configuration.
 *
 * Brand name, tagline, URLs and contact details live here so the product can
 * be renamed or re-pointed without touching components.
 *
 * The canonical URL and contact email MUST be overridden in production via
 * environment variables (see `.env.example`). The module throws during a
 * production build when the placeholder domain is still in use, so a
 * misconfigured deploy fails fast instead of shipping example.com URLs to
 * canonical tags, Open Graph, sitemap and robots.
 */

function resolveSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  return "https://resumegauge.example.com";
}

function resolveContactEmail(): string {
  const fromEnv = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  if (fromEnv) return fromEnv;
  return "hello@resumegauge.example.com";
}

const resolvedUrl = resolveSiteUrl();

if (process.env.NODE_ENV === "production" && resolvedUrl.includes("example.com")) {
  // Evaluated at build/runtime in production. Local `next dev` (NODE_ENV=development)
  // is unaffected; `next build` sets NODE_ENV=production and will fail here until
  // NEXT_PUBLIC_SITE_URL is set to the real domain.
  throw new Error(
    `[siteConfig] Canonical URL still points to a placeholder (${resolvedUrl}). ` +
      `Set NEXT_PUBLIC_SITE_URL (and NEXT_PUBLIC_CONTACT_EMAIL) to the real domain before deploying. ` +
      `See .env.example.`,
  );
}

export const siteConfig = {
  /** Product display name. Change here to rename the whole product. */
  name: "ResumeGauge",
  tagline: "Know what's working. Fix what isn't.",
  description:
    "Check your resume for structure, readability, content quality, and common applicant-tracking-system compatibility issues before applying.",
  /**
   * Canonical site URL (no trailing slash). Overridden by NEXT_PUBLIC_SITE_URL.
   */
  url: resolvedUrl,
  locale: "en_US",
  /** Contact email shown on the contact page. Overridden by NEXT_PUBLIC_CONTACT_EMAIL. */
  contactEmail: resolveContactEmail(),
  links: {
    howItWorks: "/#how-it-works",
    whatWeCheck: "/#what-we-check",
    faq: "/#faq",
    howScoringWorks: "/how-scoring-works",
    privacy: "/privacy",
    terms: "/terms",
    contact: "/contact",
    check: "/check",
  },
} as const;

export type SiteConfig = typeof siteConfig;
