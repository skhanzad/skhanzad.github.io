"use client";

import { useId, useMemo } from "react";

const TIKZ_CSS = "https://tikzjax.com/v1/fonts.css";
const TIKZ_JS = "https://tikzjax.com/v1/tikzjax.js";

/** Avoid closing the HTML wrapper when LaTeX contains `</script`. */
function escapeForHtmlScriptBody(s: string): string {
  return s.trim().replace(/<\/script/gi, "<\\/script");
}

/**
 * TikZJax is built for normal HTML page load; dynamically appended
 * `script[type="text/tikz"]` in React often never runs. We embed TikZ in an
 * iframe `srcDoc` so the browser loads CSS + tikzjax.js + the TikZ script
 * together like a tiny standalone page.
 */
function buildIframeDoc(tikzSource: string): string {
  const body = escapeForHtmlScriptBody(tikzSource);
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<link rel="stylesheet" href="${TIKZ_CSS}"/>
<style>
  html,body{margin:0;background:#fafafa;min-height:100%;}
  body{display:flex;justify-content:center;align-items:flex-start;padding:8px;box-sizing:border-box;}
</style>
<script src="${TIKZ_JS}"></script>
</head><body>
<script type="text/tikz">
${body}
</script>
</body></html>`;
}

export type TikzDiagramProps = {
  /** Raw TikZ source, usually \\begin{tikzpicture} ... \\end{tikzpicture} */
  source: string;
};

/**
 * Client-side TikZ via [TikZJax](https://tikzjax.com/).
 * Fenced `` ```tikz `` in MDX is mapped here by `lib/remark-tikz.ts`.
 */
export function TikzDiagram({ source }: TikzDiagramProps) {
  const id = useId();
  const title = `TikZ diagram ${id}`;

  const srcDoc = useMemo(() => buildIframeDoc(source), [source]);

  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border border-purple-500/25 bg-zinc-50 text-zinc-900 shadow-[inset_0_1px_0_rgba(0,0,0,0.04)] [color-scheme:light]"
      aria-label="TikZ diagram"
    >
      <iframe
        title={title}
        className="block w-full min-h-[320px] border-0 bg-zinc-50"
        sandbox="allow-scripts allow-same-origin"
        srcDoc={srcDoc}
      />
    </figure>
  );
}
