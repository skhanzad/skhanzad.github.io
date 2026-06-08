import Link from "next/link";
import { getPublishedPosts } from "@/lib/blog";

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function FeaturedBlogPosts() {
  const posts = getPublishedPosts().slice(0, 3);
  if (posts.length === 0) return null;

  return (
    <section
      className="relative z-10 w-full border-t border-gray-200/70 px-6 py-16 dark:border-purple-500/15"
      aria-labelledby="featured-blog-heading"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div>
            <h2
              id="featured-blog-heading"
              className="text-2xl font-bold tracking-tight text-[var(--foreground)] md:text-3xl"
            >
              From the blog
            </h2>
            <p className="mt-2 max-w-xl text-[var(--foreground)]/70">
              Recent writing on AI systems, engineering, and research.
            </p>
          </div>
          <Link
            href="/blog"
            className="shrink-0 rounded-full border border-purple-600/25 bg-white/80 px-5 py-2 text-sm font-semibold text-purple-800 shadow-sm transition hover:border-purple-500/50 hover:bg-purple-50 dark:border-purple-400/35 dark:bg-white/5 dark:text-purple-200 dark:hover:bg-purple-500/15"
          >
            View all posts
          </Link>
        </div>

        <ul className="grid gap-6 md:grid-cols-3">
          {posts.map((post) => (
            <li key={post.slug}>
              <article className="flex h-full flex-col rounded-2xl border border-gray-200/90 bg-white/95 p-5 text-left shadow-sm ring-1 ring-gray-900/[0.04] backdrop-blur-sm transition hover:border-purple-300 hover:shadow-md dark:border-purple-500/25 dark:bg-white/[0.07] dark:ring-white/10 dark:hover:border-purple-500/45">
                <time
                  dateTime={post.date}
                  className="text-xs font-medium uppercase tracking-wide text-purple-700 dark:text-purple-400"
                >
                  {formatDate(post.date)}
                </time>
                <h3 className="mt-2 text-lg font-semibold leading-snug text-[var(--foreground)]">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-[var(--foreground)] transition hover:text-purple-700 dark:hover:text-purple-300"
                  >
                    {post.title}
                  </Link>
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--foreground)]/80 line-clamp-3">
                  {post.description}
                </p>
                {post.tags.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {post.tags.slice(0, 3).map((tag) => (
                      <li
                        key={tag}
                        className="rounded-md bg-purple-100/90 px-2 py-0.5 text-xs font-medium text-purple-900 dark:bg-purple-500/20 dark:text-purple-200"
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
      </div>
    </section>
  );
}
