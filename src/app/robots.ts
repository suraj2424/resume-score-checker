import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Report data never exists on the server, and the tool page has no
        // crawlable content of its own — the whole page is client-rendered, so a
        // fetch returns an empty shell.
        //
        // Kept in step with `/check`'s own `robots: { index: false }`: the
        // sitemap deliberately does not list the route, so all three files now
        // agree. Worth knowing that a disallow and a meta `noindex` work against
        // each other — a crawler that cannot fetch the page never reads the tag,
        // so the URL can still surface in an index from an external link, with no
        // snippet. Removing the disallow is the fix for that, and it was left
        // alone deliberately: crawling a page this cheap is not a cost worth
        // changing crawl behaviour for without the maintainer's call.
        disallow: "/check",
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
