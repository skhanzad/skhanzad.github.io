import { NextResponse } from "next/server";
import { buildRssFeedXml } from "@/lib/rss";

export async function GET() {
  const xml = buildRssFeedXml();
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
