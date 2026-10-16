import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const pages = [
    { path: "/", priority: 1, changeFrequency: "weekly" as const },
    { path: "/how-scoring-works", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/check", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/contact", priority: 0.3, changeFrequency: "yearly" as const },
  ];

  return pages.map((page) => ({
    url: `${base}${page.path}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
