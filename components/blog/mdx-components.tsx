import type { MDXComponents } from "mdx/types";

/**
 * Maps MDX elements to Tailwind-styled components for readable articles.
 */
export function createMdxComponents(): MDXComponents {
  return {
    h1: (props) => (
      <h1
        className="mt-10 mb-4 text-3xl font-bold tracking-tight text-[var(--foreground)] md:text-4xl"
        {...props}
      />
    ),
    h2: (props) => (
      <h2
        className="mt-10 mb-3 border-b border-purple-500/20 pb-2 text-2xl font-semibold text-[var(--foreground)]"
        {...props}
      />
    ),
    h3: (props) => (
      <h3
        className="mt-8 mb-2 text-xl font-semibold text-[var(--foreground)]"
        {...props}
      />
    ),
    p: (props) => (
      <p
        className="mb-4 text-base leading-relaxed text-[var(--foreground)]/90"
        {...props}
      />
    ),
    a: (props) => (
      <a
        className="font-medium text-purple-600 underline decoration-purple-500/30 underline-offset-2 transition-colors hover:text-purple-700 hover:decoration-purple-600 dark:text-purple-400 dark:hover:text-purple-300"
        {...props}
      />
    ),
    ul: (props) => (
      <ul
        className="mb-4 list-disc space-y-2 pl-6 text-[var(--foreground)]/90"
        {...props}
      />
    ),
    ol: (props) => (
      <ol
        className="mb-4 list-decimal space-y-2 pl-6 text-[var(--foreground)]/90"
        {...props}
      />
    ),
    li: (props) => <li className="leading-relaxed" {...props} />,
    blockquote: (props) => (
      <blockquote
        className="my-6 border-l-4 border-purple-500/50 bg-purple-500/5 py-1 pl-4 italic text-[var(--foreground)]/85"
        {...props}
      />
    ),
    hr: (props) => (
      <hr className="my-10 border-purple-500/20" {...props} />
    ),
    code: (props) => {
      const { className, children, ...rest } = props;
      const cls = typeof className === "string" ? className : "";
      const isBlock = cls.includes("language-") || cls.includes("shiki");
      if (isBlock) {
        return (
          <code className={`${cls} block bg-transparent text-inherit`} {...rest}>
            {children}
          </code>
        );
      }
      return (
        <code
          className="rounded bg-purple-500/10 px-1.5 py-0.5 font-mono text-sm text-purple-800 dark:text-purple-200"
          {...rest}
        >
          {children}
        </code>
      );
    },
    pre: (props) => (
      <pre
        className="my-6 overflow-x-auto rounded-xl border border-purple-500/20 bg-[#0d1117] p-4 text-sm leading-relaxed text-gray-100 shadow-inner"
        {...props}
      />
    ),
    table: (props) => (
      <div className="my-6 overflow-x-auto rounded-lg border border-purple-500/20">
        <table className="w-full border-collapse text-sm" {...props} />
      </div>
    ),
    th: (props) => (
      <th
        className="border-b border-purple-500/30 bg-purple-500/10 px-3 py-2 text-left font-semibold"
        {...props}
      />
    ),
    td: (props) => (
      <td className="border-b border-purple-500/15 px-3 py-2" {...props} />
    ),
  };
}
