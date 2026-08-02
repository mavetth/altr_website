import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { aggregateProducts } from "@/lib/aggregate";
import { runQuery, parseQuery } from "@/lib/query";
import { isDeadImage } from "@/lib/img-cache";

export const dynamic = "force-dynamic"; // önbellek adaptör seviyesinde (marka başına TTL)

export async function GET(req: NextRequest) {
  const params = parseQuery(req.nextUrl.searchParams);
  const all = await aggregateProducts();
  // Görseli ölü bilinen ürünler akışın sonuna — yetenek buradan enjekte ediliyor,
  // çünkü img-cache Node modülleri kullanıyor ve query.ts istemci paketine de giriyor.
  const result = runQuery(all, params, { isDeadImage });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
