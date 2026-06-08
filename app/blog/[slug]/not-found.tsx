import Link from "next/link";

export default function BlogPostNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-8 text-center">
      <h1 className="text-2xl font-bold text-[var(--foreground)]">Post not found</h1>
      <p className="mt-3 text-[var(--foreground)]/75">
        This post does not exist or is not published.
      </p>
      <Link
        href="/blog"
        className="mt-6 inline-block text-sm font-medium text-purple-600 dark:text-purple-400"
      >
        ← Back to blog
      </Link>
    </main>
  );
}
