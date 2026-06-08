import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedPosts } from "@/lib/blog";
import { getSiteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog",
  description: "Writing on AI systems, software engineering, and research.",
  openGraph: {
    title: "Blog",
    description: "Writing on AI systems, software engineering, and research.",
    type: "website",
    url: "/blog",
  },
  alternates: {
    canonical: `${getSiteUrl()}/blog`,
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
};

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

export default function BlogIndexPage() {
  const posts = getPublishedPosts();

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24">
      <header className="mb-12 border-b border-purple-500/20 pb-8">
        <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)]">
          Blog
        </h1>
        <p className="mt-3 text-lg text-[var(--foreground)]/75">
          Notes on building reliable AI systems and turning research into products.
        </p>
        <p className="mt-4">
          <a
            href="/feed.xml"
            className="text-sm font-medium text-purple-600 underline decoration-purple-500/30 underline-offset-2 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
          >
            RSS feed
          </a>
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-[var(--foreground)]/70">No posts yet. Check back soon.</p>
      ) : (
        <ul className="flex flex-col gap-10">
          {posts.map((post) => (
            <li key={post.slug}>
              <article>
                <time
                  dateTime={post.date}
                  className="text-sm font-medium text-purple-600 dark:text-purple-400"
                >
                  {formatDate(post.date)}
                </time>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-[var(--foreground)] transition-colors hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-2 text-[var(--foreground)]/80">{post.description}</p>
                {post.tags.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
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
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
