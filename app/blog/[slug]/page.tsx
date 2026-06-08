import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypePrettyCode from "rehype-pretty-code";
import { getPostBySlug, getPublishedSlugs } from "@/lib/blog";
import {
  DEFAULT_OG_IMAGE_PATH,
  SITE_NAME,
  SUBSTACK_URL,
  getSiteUrl,
} from "@/lib/site";
import { createMdxComponents } from "@/components/blog/mdx-components";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getPublishedSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) {
    return { title: "Post not found" };
  }

  const site = getSiteUrl();
  const url = `${site}/blog/${slug}`;
  const ogImage = {
    url: DEFAULT_OG_IMAGE_PATH,
    width: 512,
    height: 512,
    alt: post.title,
  };

  return {
    title: post.title,
    description: post.description,
    keywords: post.tags,
    authors: [{ name: SITE_NAME, url: site }],
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url,
      siteName: SITE_NAME,
      locale: "en_US",
      publishedTime: post.date,
      modifiedTime: post.date,
      authors: [SITE_NAME],
      tags: post.tags,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [`${site}${DEFAULT_OG_IMAGE_PATH}`],
    },
  };
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const { content } = await compileMDX({
    source: post.body,
    components: createMdxComponents(),
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          [
            rehypePrettyCode,
            {
              theme: "github-dark-dimmed",
            },
          ],
        ],
      },
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24">
      <nav className="mb-8">
        <Link
          href="/blog"
          className="text-sm font-medium text-purple-600 transition-colors hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
        >
          ← Back to blog
        </Link>
      </nav>

      <article>
        <header className="mb-10 border-b border-purple-500/20 pb-8">
          <time
            dateTime={post.date}
            className="text-sm font-medium text-purple-600 dark:text-purple-400"
          >
            {formatDate(post.date)}
          </time>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-5xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg text-[var(--foreground)]/80">{post.description}</p>
          {post.tags.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full bg-purple-500/10 px-3 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </header>

        <div className="mdx-content text-[var(--foreground)]">{content}</div>
      </article>

      <aside
        className="mt-16 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6 text-center"
        aria-label="Newsletter"
      >
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Subscribe for updates
        </h2>
        <p className="mt-2 text-sm text-[var(--foreground)]/75">
          Occasional notes on AI systems and engineering. No spam.
        </p>
        <Link
          href={SUBSTACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:from-purple-600 hover:to-pink-600"
        >
          Join the newsletter
        </Link>
      </aside>
    </main>
  );
}
