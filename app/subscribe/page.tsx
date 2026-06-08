import type { Metadata } from "next";
import BlogChrome from "@/components/blog/BlogChrome";
import { SUBSTACK_EMBED_URL, SUBSTACK_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Subscribe | Sourena Khanzadeh",
  description: "Get updates on new posts and projects via Substack.",
};

export default function SubscribePage() {
  return (
    <BlogChrome>
      <main className="mx-auto max-w-xl px-6 pb-24 pt-8">
        <h1 className="text-center text-3xl font-bold tracking-tight text-[var(--foreground)]">
          Subscribe
        </h1>
        <p className="mt-4 text-center text-[var(--foreground)]/80">
          Get new posts by email. You can also open the publication on{" "}
          <a
            href={SUBSTACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-purple-600 underline decoration-purple-500/30 underline-offset-2 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
          >
            Substack
          </a>
          .
        </p>

        <div className="mt-10 overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-md ring-1 ring-gray-900/[0.04] dark:border-purple-500/30 dark:bg-[#111] dark:ring-white/10">
          <iframe
            src={SUBSTACK_EMBED_URL}
            title="Subscribe on Substack"
            width="100%"
            height="320"
            className="min-h-[320px] w-full bg-white dark:bg-[#111]"
            style={{ border: "0" }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </main>
    </BlogChrome>
  );
}
