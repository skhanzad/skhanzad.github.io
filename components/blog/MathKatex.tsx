import katex from "katex";

function fromB64(encoded: string): string {
  return Buffer.from(encoded, "base64").toString("utf8");
}

export type MathBlockProps = {
  encoded: string;
};

/** Display math (from `$$`, `\[…\]`, or `` ```math ``) — KaTeX on the server. */
export function MathBlock({ encoded }: MathBlockProps) {
  const latex = fromB64(encoded);
  const html = katex.renderToString(latex, {
    displayMode: true,
    throwOnError: false,
    strict: "ignore",
  });
  return (
    <div
      className="my-6 overflow-x-auto text-center [&_.katex]:text-[var(--foreground)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export type MathInlineProps = {
  encoded: string;
};

/** Inline math from `\( … \)` — KaTeX on the server. */
export function MathInline({ encoded }: MathInlineProps) {
  const latex = fromB64(encoded);
  const html = katex.renderToString(latex, {
    displayMode: false,
    throwOnError: false,
    strict: "ignore",
  });
  return (
    <span
      className="katex-inline [&_.katex]:text-[var(--foreground)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
