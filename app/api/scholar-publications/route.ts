import { NextResponse } from "next/server";
import { mergeScrapedPublication } from "@/lib/scholarEnrichment";
import { FALLBACK_PUBLICATIONS } from "@/lib/publicationsFallback";
import type { ScholarPublicationsResponse } from "@/lib/publications";
import { parseScholarListHtml } from "@/lib/scholarParser";

/** Fetches live data on each request (no CDN cache). */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SCHOLAR_LIST =
  "https://scholar.google.ca/citations?user=rMUfQ20AAAAJ&hl=en&view_op=list_works&pagesize=100";

export async function GET(): Promise<NextResponse<ScholarPublicationsResponse>> {
  const updatedAt = new Date().toISOString();
  try {
    const res = await fetch(SCHOLAR_LIST, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-CA,en;q=0.9",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Scholar returned HTTP ${res.status}`);
    }
    const html = await res.text();
    if (html.length < 8000 || !html.includes("gsc_a_tr")) {
      throw new Error(
        "Unexpected Scholar HTML (blocked, CAPTCHA, or layout change)"
      );
    }
    const { publications: scraped, metrics } = parseScholarListHtml(html);
    if (!scraped.length) {
      throw new Error("No publication rows parsed from Scholar");
    }
    const publications = scraped.map(mergeScrapedPublication);
    return NextResponse.json({
      ok: true,
      updatedAt,
      metrics,
      publications,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        updatedAt,
        metrics: null,
        publications: FALLBACK_PUBLICATIONS,
      },
      { status: 200 }
    );
  }
}
