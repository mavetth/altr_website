import { NextResponse } from "next/server";
import { BRANDS } from "@/lib/brands";

export const dynamic = "force-dynamic";

export async function GET() {
  const brands = BRANDS.map((b) => ({
    name: b.name,
    slug: b.slug,
    live: Boolean(b.url && b.platform !== "none"),
    url: b.url,
  }));
  const liveCount = brands.filter((b) => b.live).length;
  return NextResponse.json(
    { brands, total: brands.length, liveCount },
    { headers: { "Cache-Control": "no-store" } },
  );
}
