import { load } from "cheerio";

import type { ScholarMetrics } from "@/lib/publications";

export type ScrapedPublication = {
  title: string;
  authors: string;
  venue: string;
  year: string;
  citations: string;
  scholarCitationUrl: string;
};

const SCHOLAR_ORIGIN = "https://scholar.google.ca";

function absScholarUrl(href: string): string {
  if (href.startsWith("http")) return href;
  return `${SCHOLAR_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
}

/**
 * Parse Google Scholar "list works" HTML (desktop table with gsc_a_* classes).
 */
export function parseScholarListHtml(html: string): {
  publications: ScrapedPublication[];
  metrics: ScholarMetrics | null;
} {
  const $ = load(html);
  const publications: ScrapedPublication[] = [];

  $("tr.gsc_a_tr").each((_, tr) => {
    const $tr = $(tr);
    const $a = $tr.find("a.gsc_a_at");
    const title = $a.text().replace(/\s+/g, " ").trim();
    if (!title) return;

    const href = ($a.attr("href") ?? "").trim();
    const scholarCitationUrl = href ? absScholarUrl(href) : SCHOLAR_ORIGIN;

    const grays = $tr.find("td.gsc_a_t .gs_gray");
    const authors = grays.eq(0).text().replace(/\s+/g, " ").trim();
    const venue = grays.eq(1).text().replace(/\s+/g, " ").trim();

    const citeText = $tr.find("td.gsc_a_c a").first().text().trim();
    const citations = citeText.length ? citeText : "—";

    const year = $tr.find("td.gsc_a_y").text().replace(/\s+/g, " ").trim();

    publications.push({
      title,
      authors,
      venue,
      year,
      citations,
      scholarCitationUrl,
    });
  });

  const nums = $(".gsc_rsb_std")
    .map((_, el) => {
      const n = parseInt($(el).text().trim(), 10);
      return Number.isFinite(n) ? n : NaN;
    })
    .get()
    .filter((n) => !Number.isNaN(n));

  let metrics: ScholarMetrics | null = null;
  if (nums.length >= 5) {
    metrics = {
      citations: nums[0] ?? 0,
      hIndex: nums[2] ?? 0,
      i10Index: nums[4] ?? 0,
    };
  }

  return { publications, metrics };
}
