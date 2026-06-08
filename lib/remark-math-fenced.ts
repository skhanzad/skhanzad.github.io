import type { Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

/**
 * GitHub-style ` ```math ` / ` ```latex ` fences are plain code to remark-math.
 * Turn them into display `math` mdast nodes so rehype-katex renders them.
 */
export const remarkMathFenced: Plugin<[], Root> = () => (tree) => {
  visit(tree, "code", (node, index, parent) => {
    const lang = node.lang?.toLowerCase();
    if (
      (lang !== "math" && lang !== "latex") ||
      parent == null ||
      typeof index !== "number"
    ) {
      return;
    }
    const mathNode = {
      type: "math",
      value: node.value.trim(),
    };
    parent.children[index] = mathNode as (typeof parent.children)[number];
  });
};
