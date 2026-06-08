import type { Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

/** MDX JSX AST for fenced ```tikz → <TikzDiagram source="…" /> (runtime shape matches @mdx-js/mdx). */
type MdxJsxAttr = {
  type: "mdxJsxAttribute";
  name: string;
  value: string;
  valueType: "string";
};

type MdxJsxFlow = {
  type: "mdxJsxFlowElement";
  name: string;
  attributes: MdxJsxAttr[];
  children: never[];
};

/**
 * Turns fenced ```tikz blocks into <TikzDiagram source="..." /> so they are not fed to Shiki
 * and can be rendered client-side with TikZJax.
 */
export const remarkTikz: Plugin<[], Root> = () => (tree) => {
  visit(tree, "code", (node, index, parent) => {
    if (node.lang !== "tikz" || parent == null || typeof index !== "number") {
      return;
    }
    const flow: MdxJsxFlow = {
      type: "mdxJsxFlowElement",
      name: "TikzDiagram",
      attributes: [
        {
          type: "mdxJsxAttribute",
          name: "source",
          value: node.value,
          valueType: "string",
        },
      ],
      children: [],
    };
    parent.children[index] = flow as (typeof parent.children)[number];
  });
};
