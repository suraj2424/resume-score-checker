import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/**
 * Three sources once disagreed about `/check`: `robots.ts` disallowed it, the
 * page carried `robots: { index: false }`, and this file listed it at priority
 * 0.9 — the second-highest here. A page that asks not to be indexed does not
 * belong in the list that tells search engines what to index, so the
 * disallow and the `noindex` stand and the entry is gone.
 *
 * `lastModified` is omitted rather than faked. The old `new Date()` stamped the
 * build time onto all six URLs on every rebuild, which reads to a crawler as
 * every page on the site having just changed — the exact signal that trains
 * crawlers to stop trusting `lastmod` and re-fetch content that has not moved.
 * There is no git-history dependency in this repo, so the real date a page last
 * changed is not knowable here; absent `lastmod` says "no reliable date", which
 * is the truth. `changeFrequency` and `priority` are kept because those are
 * declared intent about importance, not a false claim about recency.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const pages = [
    { path: "/", priority: 1, changeFrequency: "weekly" as const },
    { path: "/how-scoring-works", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/contact", priority: 0.3, changeFrequency: "yearly" as const },
  ];

  return pages.map((page) => ({
    url: `${base}${page.path}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
