import { redirect } from "next/navigation";
import { SUBSTACK_URL } from "@/lib/site";

/**
 * Keeps /newsletter working for old links; sends readers to Substack.
 */
export default function NewsletterPage() {
  redirect(SUBSTACK_URL);
}
