import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { aggregateProducts } from "@/lib/aggregate";
import {
  bumpViews,
  getPublic,
  listPublic,
  publish,
  toPublicView,
  unpublish,
  type PublicSort,
} from "@/lib/public-lists";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * HERKESE AÇIK LİSTELER API'si.
 *
 * Sahiplik, cihazda üretilen gizli bir anahtarla kanıtlanıyor (hesap yok — bkz.
 * lib/public-lists.ts). Anahtar istekle birlikte gelir, sunucu yalnız SHA-256'sını
 * saklar; yani veritabanı sızsa bile kimsenin listesi ele geçirilemez.
 *
 * GET  ?sort=yeni|populer&limit&offset   → akış
 * GET  ?id=<id>                          → tek liste (görüntülenmeyi artırır)
 * POST { id?, nick, name, ids, covers, ownerKey }  → yayınla / güncelle
 * DELETE ?id=<id>  (x-owner-key başlığı)  → yayından kaldır
 */

const MAX_LIMIT = 60;

/** Anahtar istemcide üretiliyor; biçimi doğrulanmazsa çöp veriyle kayıt açılabilir. */
const KEY_RE = /^[a-z0-9-]{16,64}$/i;

function ownerKeyOf(req: NextRequest): string | undefined {
  const k = req.headers.get("x-owner-key") ?? "";
  return KEY_RE.test(k) ? k : undefined;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ownerKey = ownerKeyOf(req);

  const id = sp.get("id");
  if (id) {
    const l = await getPublic(id);
    if (!l) return NextResponse.json({ error: "yok" }, { status: 404 });
    await bumpViews(id);

    // Ürün gövdeleri BURADA çözülür: liste yalnız id taşıyor ve istemcinin katalogu
    // yok. Katalogdan düşmüş ürünler sessizce eksilir — paylaşım linkindeki `missing`
    // ile aynı davranış. Sıra listenin kendi sırası olmalı, katalogunki değil.
    const all = await aggregateProducts();
    const byId = new Map(all.map((p) => [p.id, p]));
    const items = l.ids.map((pid) => byId.get(pid)).filter(Boolean);

    return NextResponse.json(
      { list: toPublicView(l, ownerKey), items, missing: l.ids.length - items.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const sort: PublicSort = sp.get("sort") === "populer" ? "populer" : "yeni";
  const limit = Math.min(MAX_LIMIT, Number(sp.get("limit") ?? "40") || 40);
  const offset = Math.max(0, Number(sp.get("offset") ?? "0") || 0);
  const { items, total } = await listPublic(sort, limit, offset);
  return NextResponse.json(
    { items: items.map((l) => toPublicView(l, ownerKey)), total },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  let body: {
    id?: string;
    nick?: string;
    name?: string;
    ids?: string[];
    covers?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const ownerKey = ownerKeyOf(req);
  if (!ownerKey) return NextResponse.json({ error: "anahtar" }, { status: 400 });

  const r = await publish({
    id: body.id,
    nick: String(body.nick ?? ""),
    name: String(body.name ?? ""),
    ids: Array.isArray(body.ids) ? body.ids.map(String) : [],
    covers: Array.isArray(body.covers) ? body.covers.map(String) : [],
    ownerKey,
  });

  if (!r.ok) {
    // Sahiplik hatası 403; geri kalanı istemcinin düzeltebileceği girdi hataları.
    const status = r.error === "sahip" ? 403 : r.error === "yok" ? 404 : 400;
    return NextResponse.json({ error: r.error }, { status });
  }
  return NextResponse.json(
    { list: toPublicView(r.list, ownerKey) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const ownerKey = ownerKeyOf(req);
  if (!id || !ownerKey) return NextResponse.json({ error: "eksik" }, { status: 400 });
  const ok = await unpublish(id, ownerKey);
  if (!ok) return NextResponse.json({ error: "sahip" }, { status: 403 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
