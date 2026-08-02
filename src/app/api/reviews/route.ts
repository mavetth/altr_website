import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionUser } from "@/lib/auth";
import { normalizeNick } from "@/lib/public-lists";
import {
  deleteReview,
  listReviews,
  saveReview,
  summaries,
  summaryOf,
  toReviewView,
} from "@/lib/reviews";

/**
 * YORUM ve PUAN API'si.
 *
 *   GET    ?id=<ürün>             → o ürünün yorumları + özeti
 *   GET    ?ids=a,b,c             → yalnız özetler (ızgaradaki yıldızlar, tek istekte)
 *   POST   { productId, rating, text, nick? }  → kendi yorumunu yaz/güncelle
 *   DELETE ?id=<ürün>             → kendi yorumunu sil
 *
 * KİMLİK. Oturum açıksa yorum HESABA bağlanır (`user:<id>`): kullanıcı başka cihazdan
 * girse de kendi yorumunu düzenleyebilir ve nick'i hesabından gelir. Oturum yoksa
 * yayınlanan listelerdeki yol geçerli: cihaz anahtarı + istenen nick. İkisi bilerek
 * birlikte destekleniyor — yorum yazmak için üye olmayı şart koşmak, henüz hiçbir
 * özelliğin hesaba bağlı olmadığı bir vitrinde sesin çoğunu susturur.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Anahtar istemcide üretiliyor; biçimi doğrulanmazsa çöp veriyle kayıt açılabilir. */
const KEY_RE = /^[a-z0-9-]{16,64}$/i;
const MAX_IDS = 120;
const noStore = { "Cache-Control": "no-store" };

/** İsteği yazana bağlayan anahtar: oturum varsa hesap, yoksa cihaz. */
async function identify(
  req: NextRequest,
): Promise<{ ownerKey?: string; nick?: string; fromAccount: boolean }> {
  const u = await sessionUser(req.cookies.get(SESSION_COOKIE)?.value);
  if (u?.nick) return { ownerKey: `user:${u.id}`, nick: u.nick, fromAccount: true };

  const k = req.headers.get("x-owner-key") ?? "";
  return { ownerKey: KEY_RE.test(k) ? k : undefined, fromAccount: false };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const idsRaw = sp.get("ids");
  if (idsRaw) {
    const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS);
    return NextResponse.json({ summaries: await summaries(ids) }, { headers: noStore });
  }

  const id = sp.get("id");
  if (!id) return NextResponse.json({ error: "eksik" }, { status: 400, headers: noStore });

  const { ownerKey } = await identify(req);
  const items = await listReviews(id);
  return NextResponse.json(
    { items: items.map((r) => toReviewView(r, ownerKey)), summary: await summaryOf(id) },
    { headers: noStore },
  );
}

export async function POST(req: NextRequest) {
  let body: { productId?: string; rating?: number; text?: string; nick?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400, headers: noStore });
  }

  const productId = String(body.productId ?? "").trim();
  if (!productId) return NextResponse.json({ error: "urun" }, { status: 400, headers: noStore });

  const who = await identify(req);
  if (!who.ownerKey) return NextResponse.json({ error: "anahtar" }, { status: 400, headers: noStore });

  // Oturum açıksa nick hesaptan gelir; istemcinin gönderdiği ad dikkate ALINMAZ,
  // yoksa biri hesabıyla yazıp başkasının adını gösterebilirdi.
  const nick = who.fromAccount ? who.nick! : normalizeNick(String(body.nick ?? ""));
  if (!nick) return NextResponse.json({ error: "nick" }, { status: 400, headers: noStore });

  const r = await saveReview({
    productId,
    nick,
    rating: Number(body.rating),
    text: String(body.text ?? ""),
    ownerKey: who.ownerKey,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400, headers: noStore });

  return NextResponse.json(
    { review: toReviewView(r.review, who.ownerKey), summary: r.summary },
    { headers: noStore },
  );
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const { ownerKey } = await identify(req);
  if (!id || !ownerKey) return NextResponse.json({ error: "eksik" }, { status: 400, headers: noStore });

  const r = await deleteReview(id, ownerKey);
  if (!r.ok) return NextResponse.json({ error: "yok" }, { status: 404, headers: noStore });
  return NextResponse.json({ ok: true, summary: r.summary }, { headers: noStore });
}
