import { getPublishedPosts } from "@/lib/blog";
import { SITE_NAME, getSiteUrl } from "@/lib/site";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildRssFeedXml(): string {
  const site = getSiteUrl();
  const posts = getPublishedPosts();
  const buildDate = new Date().toUTCString();

  const items = posts
    .map((post) => {
      const url = `${site}/blog/${post.slug}`;
      const pub = new Date(post.date).toUTCString();
      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${pub}</pubDate>
      <description>${escapeXml(post.description)}</description>
    </item>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:atom="http://www.w3.org/2005/Atom" version="2.0">
  <channel>
    <title>${escapeXml(SITE_NAME)} — Blog</title>
    <link>${escapeXml(site)}/blog</link>
    <description>Writing on AI systems, software engineering, and research.</description>
    <language>en</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${escapeXml(site)}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;
}
