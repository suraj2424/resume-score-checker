import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Report data never exists on the server, and the tool page has no
        // crawlable content of its own.
        disallow: "/check",
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
