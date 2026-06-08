import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** TinaCMS ships static admin UI to `public/admin/index.html` after `tinacms build` / `tinacms dev`. */
export default function AdminPage() {
  redirect("/admin/index.html");
}
