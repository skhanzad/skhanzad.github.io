import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";

function isExternalHref(href: string | undefined): boolean {
  return typeof href === "string" && /^https?:\/\//i.test(href);
}

function linkClassName(): string {
  return "font-medium text-purple-600 underline decoration-purple-500/35 underline-offset-[3px] transition-colors hover:text-purple-800 hover:decoration-purple-600 dark:text-purple-400 dark:hover:text-purple-200 dark:hover:decoration-purple-300";
}

/**
 * Maps MDX elements to Tailwind-styled components for readable articles.
 */
export function createMdxComponents(): MDXComponents {
  return {
    h1: (props) => (
      <h1
        className="mt-10 mb-4 text-3xl font-bold tracking-tight text-[var(--foreground)] first:mt-0 md:text-4xl"
        {...props}
      />
    ),
    h2: (props) => (
      <h2
        className="mt-12 mb-3 scroll-mt-24 border-b border-purple-500/25 pb-2 text-2xl font-semibold tracking-tight text-[var(--foreground)]"
        {...props}
      />
    ),
    h3: (props) => (
      <h3
        className="mt-10 mb-2 scroll-mt-24 text-xl font-semibold tracking-tight text-[var(--foreground)]"
        {...props}
      />
    ),
    h4: (props) => (
      <h4
        className="mt-8 mb-2 scroll-mt-24 text-lg font-semibold text-[var(--foreground)]"
        {...props}
      />
    ),
    h5: (props) => (
      <h5
        className="mt-6 mb-2 text-base font-semibold text-[var(--foreground)]"
        {...props}
      />
    ),
    p: (props) => (
      <p
        className="mb-4 text-[1.0625rem] leading-[1.75] text-[var(--foreground)]/90"
        {...props}
      />
    ),
    a: ({ href, children, className, ...rest }: ComponentPropsWithoutRef<"a">) => {
      const external = isExternalHref(href);
      return (
        <a
          href={href}
          className={[linkClassName(), className].filter(Boolean).join(" ")}
          {...(external
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
          {...rest}
        >
          {children}
          {external ? (
            <span className="ml-0.5 inline-block translate-y-px text-[0.7em] opacity-70">
              ↗
            </span>
          ) : null}
        </a>
      );
    },
    strong: (props) => (
      <strong className="font-semibold text-[var(--foreground)]" {...props} />
    ),
    em: (props) => <em className="italic text-[var(--foreground)]/95" {...props} />,
    ul: (props) => (
      <ul
        className="mb-5 list-disc space-y-2 pl-6 marker:text-purple-500/80 text-[var(--foreground)]/90"
        {...props}
      />
    ),
    ol: (props) => (
      <ol
        className="mb-5 list-decimal space-y-2 pl-6 marker:font-medium marker:text-purple-600 dark:marker:text-purple-400 text-[var(--foreground)]/90"
        {...props}
      />
    ),
    li: (props) => <li className="leading-relaxed [&>p]:mb-2" {...props} />,
    blockquote: (props) => (
      <blockquote
        className="my-8 rounded-r-xl border-l-4 border-purple-500/60 bg-gradient-to-r from-purple-500/[0.08] to-transparent py-3 pl-5 pr-4 text-[var(--foreground)]/88 [&>p]:mb-0 [&>p:last-child]:mb-0"
        {...props}
      />
    ),
    hr: (props) => (
      <hr className="my-12 border-0 border-t border-purple-500/20" {...props} />
    ),
    code: (props) => {
      const { className, children, ...rest } = props;
      const cls = typeof className === "string" ? className : "";
      const isBlock = cls.includes("language-") || cls.includes("shiki");
      if (isBlock) {
        return (
          <code
            className={`${cls} block bg-transparent p-0 font-mono text-[0.875em] leading-relaxed text-inherit`}
            {...rest}
          >
            {children}
          </code>
        );
      }
      return (
        <code
            className="rounded-md border border-purple-200/80 bg-purple-50 px-1.5 py-0.5 font-mono text-[0.9em] font-medium text-purple-950 dark:border-purple-400/25 dark:bg-purple-400/15 dark:text-purple-100"
          {...rest}
        >
          {children}
        </code>
      );
    },
    pre: (props) => (
      <pre
        className="my-8 overflow-x-auto rounded-xl border border-purple-500/25 bg-[#0d1117] p-4 font-mono text-sm leading-relaxed text-gray-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] [&>code]:rounded-none [&>code]:border-0 [&>code]:bg-transparent [&>code]:p-0"
        {...props}
      />
    ),
    img: ({ alt, ...rest }: ComponentPropsWithoutRef<"img">) => (
      <img
        alt={alt ?? ""}
        className="my-8 mx-auto block max-h-[480px] w-auto max-w-full rounded-xl border border-purple-500/20 bg-[var(--background)] shadow-lg ring-1 ring-black/5 dark:ring-white/10"
        loading="lazy"
        decoding="async"
        {...rest}
      />
    ),
    table: (props) => (
      <div className="my-8 overflow-x-auto rounded-xl border border-purple-500/20 shadow-sm">
        <table
          className="w-full min-w-[280px] border-collapse text-left text-sm text-[var(--foreground)]/95"
          {...props}
        />
      </div>
    ),
    thead: (props) => (
      <thead className="bg-purple-500/[0.12] dark:bg-purple-500/20" {...props} />
    ),
    tbody: (props) => (
      <tbody className="divide-y divide-purple-500/15" {...props} />
    ),
    tr: (props) => (
      <tr
        className="transition-colors even:bg-purple-500/[0.04] hover:bg-purple-500/[0.07] dark:even:bg-white/[0.03] dark:hover:bg-white/[0.05]"
        {...props}
      />
    ),
    th: (props) => (
      <th
        className="border-b border-purple-500/25 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]"
        {...props}
      />
    ),
    td: (props) => (
      <td className="border-b border-purple-500/10 px-4 py-3 align-top" {...props} />
    ),
  };
}
