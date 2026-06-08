import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export type BlogFrontmatter = {
  title: string;
  description: string;
  date: string;
  tags: string[];
  /** Defaults to true when omitted */
  published?: boolean;
};

export type BlogPostListItem = BlogFrontmatter & {
  slug: string;
};

export type BlogPostSource = BlogPostListItem & {
  /** Markdown/MDX body only (no frontmatter) */
  body: string;
};

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

function parseFrontmatter(data: Record<string, unknown>): BlogFrontmatter {
  const title = typeof data.title === "string" ? data.title : "Untitled";
  const description =
    typeof data.description === "string" ? data.description : "";
  const date =
    typeof data.date === "string" ? data.date : new Date(0).toISOString();
  const tags = normalizeTags(data.tags);
  const published =
    data.published === undefined ? true : Boolean(data.published);

  return { title, description, date, tags, published };
}

function slugFromFilename(filename: string): string {
  return filename.replace(/\.(mdx|md)$/i, "");
}

function listPostFilenames(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs.readdirSync(BLOG_DIR).filter(
    (f) => f.endsWith(".mdx") || f.endsWith(".md")
  );
}

/**
 * All published posts, newest first. Slug comes from the filename (without extension).
 */
export function getPublishedPosts(): BlogPostListItem[] {
  const files = listPostFilenames();
  const posts: BlogPostListItem[] = [];

  for (const file of files) {
    const full = path.join(BLOG_DIR, file);
    const raw = fs.readFileSync(full, "utf8");
    const { data } = matter(raw);
    const meta = parseFrontmatter(data as Record<string, unknown>);
    if (!meta.published) continue;

    posts.push({
      ...meta,
      slug: slugFromFilename(file),
    });
  }

  posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  return posts;
}

function findFileForSlug(slug: string): string | null {
  for (const ext of [".mdx", ".md"]) {
    const candidate = path.join(BLOG_DIR, `${slug}${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Published post with raw MDX body for compilation, or null if missing / unpublished.
 */
export function getPostBySlug(slug: string): BlogPostSource | null {
  const filePath = findFileForSlug(slug);
  if (!filePath) return null;

  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const meta = parseFrontmatter(data as Record<string, unknown>);
  if (!meta.published) return null;

  return {
    ...meta,
    slug,
    body: content.trim(),
  };
}

export function getPublishedSlugs(): string[] {
  return getPublishedPosts().map((p) => p.slug);
}
