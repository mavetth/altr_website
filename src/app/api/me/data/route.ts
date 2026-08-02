import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { NO_STORE, requireUser } from "@/lib/api-auth";
import { aggregateProducts } from "@/lib/aggregate";
import { getUserData, putUserData } from "@/lib/user-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * HESABA BAĞLI VERİ.
 *
 * GET → { data, products }   — `products`, listelerdeki id'lerin katalogdan çözülmüş
 *                              gövdeleri. İstemcinin katalogu yok; kart çizebilmesi
 *                              için gövdeler burada üretiliyor (api/lists ile aynı yol).
 * PUT { data, base? }        — `base`, istemcinin elindeki sürümün updatedAt'i.
 *                              Sunucudaki daha yeniyse 409 + güncel veri döner;
 *                              istemci birleştirip tekrar dener (bkz. lib/sync.ts).
 */

/** Gövde çözümü: kullanıcının TÜM listelerindeki id'ler, tekilleştirilmiş. */
async function resolve(ids: string[]) {
  if (!ids.length) return [];
  const want = new Set(ids);
  const all = await aggregateProducts();
  return all.filter((p) => want.has(p.id));
}

export async function GET(req: NextRequest) {
  const gate = await requireUser(req);
  if ("deny" in gate) return gate.deny;

  const data = await getUserData(gate.user.id);
  const products = await resolve(data.lists.flatMap((l) => l.ids));
  return NextResponse.json({ data, products }, { headers: NO_STORE });
}

export async function PUT(req: NextRequest) {
  const gate = await requireUser(req);
  if ("deny" in gate) return gate.deny;

  let body: { data?: unknown; base?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const r = await putUserData(gate.user.id, body.data, body.base);
  if (!r.ok) {
    // 409: "senin elindeki sürüm eski". Hata değil, birleştirme daveti.
    const products = await resolve(r.current.lists.flatMap((l) => l.ids));
    return NextResponse.json(
      { error: "eski", data: r.current, products },
      { status: 409, headers: NO_STORE },
    );
  }
  return NextResponse.json({ data: r.data }, { headers: NO_STORE });
}
