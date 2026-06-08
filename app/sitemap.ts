import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/blog";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const posts = getPublishedPosts();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/subscribe`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/newsletter`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const blogEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));

  return [...staticRoutes, ...blogEntries];
}
