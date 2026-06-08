import type { Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

function toB64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

type MdxJsxAttr = {
  type: "mdxJsxAttribute";
  name: string;
  value: string;
  valueType: "string";
};

/**
 * MDX does not turn mdast `math` / `inlineMath` into hast for rehype-katex; they become
 * HTML comments + escaped text. Replace them with `<MathBlock />` / `<MathInline />` that
 * call KaTeX on the server (payload base64 in a JSX attribute to avoid escaping issues).
 */
export const remarkMathToKaTeXJsx: Plugin<[], Root> = () => (tree) => {
  visit(tree, "math", (node, index, parent) => {
    if (parent == null || typeof index !== "number") return;
    const attrs: MdxJsxAttr[] = [
      {
        type: "mdxJsxAttribute",
        name: "encoded",
        value: toB64(node.value.trim()),
        valueType: "string",
      },
    ];
    parent.children[index] = {
      type: "mdxJsxFlowElement",
      name: "MathBlock",
      attributes: attrs,
      children: [],
    } as (typeof parent.children)[number];
  });

  visit(tree, "inlineMath", (node, index, parent) => {
    if (parent == null || typeof index !== "number") return;
    const attrs: MdxJsxAttr[] = [
      {
        type: "mdxJsxAttribute",
        name: "encoded",
        value: toB64(node.value.trim()),
        valueType: "string",
      },
    ];
    parent.children[index] = {
      type: "mdxJsxTextElement",
      name: "MathInline",
      attributes: attrs,
      children: [],
    } as (typeof parent.children)[number];
  });
};
