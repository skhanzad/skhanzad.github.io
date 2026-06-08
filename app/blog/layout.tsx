import "katex/dist/katex.min.css";

import BlogChrome from "@/components/blog/BlogChrome";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BlogChrome>{children}</BlogChrome>;
}
