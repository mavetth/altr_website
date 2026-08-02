import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { NO_STORE, currentUser, requireAdmin } from "@/lib/api-auth";
import {
  addFeedback,
  findFeedback,
  isTopic,
  listFeedback,
  markRead,
  removeFeedback,
  type Topic,
} from "@/lib/feedback";
import { MAX_FILES, removeAttachments, saveAttachments } from "@/lib/feedback-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bir IP'nin arka arkaya gönderim aralığı. Kutu spam ile dolmasın. */
const COOLDOWN_MS = 60 * 1000;

const g = globalThis as unknown as { __altrFeedbackSeen?: Map<string, number> };
const seen: Map<string, number> = g.__altrFeedbackSeen ?? (g.__altrFeedbackSeen = new Map());

/**
 * İstemcinin IP'si. Proxy arkasında `x-forwarded-for`un İLK adresi gerçek istemcidir;
 * sonrakiler ara sunucular. Hiçbiri yoksa tek bir kovaya düşeriz — o durumda hız
 * sınırı herkesi birlikte kısar, ki spam'e karşı yine de bir şeydir.
 */
function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "yerel";
}

function sweep(now: number): void {
  if (seen.size < 5000) return;
  for (const [k, t] of seen) if (now - t > COOLDOWN_MS) seen.delete(k);
}

const str = (v: unknown, max = 2000): string => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * POST — herkese açık. Oturum varsa kim yazdığı kaydedilir, yoksa anonimdir.
 *
 * Honeypot: formda gizli bir alan var; insan onu göremez, basit bot doldurur. Dolu
 * gelirse 204 döneriz — bot "başarılı" sanıp tekrar denemesin, ama kutuya hiçbir şey
 * girmesin.
 */
export async function POST(req: NextRequest) {
  // Gönderim iki biçimde gelebilir: düz JSON (ek yok) ya da multipart (ek var).
  // Ekler yalnız GERİ BİLDİRİM konusunda çiziliyor ama kontrol burada, sunucuda.
  let body: Record<string, unknown>;
  let uploads: File[] = [];
  const ctype = req.headers.get("content-type") ?? "";

  if (ctype.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "bad form" }, { status: 400 });
    }
    body = {};
    for (const [k, v] of form.entries()) {
      if (typeof v === "string") body[k] = v;
    }
    uploads = form
      .getAll("dosya")
      .filter((v): v is File => typeof v !== "string")
      .slice(0, MAX_FILES);
  } else {
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "bad json" }, { status: 400 });
    }
  }

  if (str(body.website)) return new NextResponse(null, { status: 204 });

  const now = Date.now();
  const ip = clientIp(req);
  const last = seen.get(ip);
  if (last && now - last < COOLDOWN_MS) {
    const retryAfter = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    return NextResponse.json(
      { error: "cok-sik", message: `Biraz yavaş. ${retryAfter} sn sonra tekrar dene.` },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(retryAfter) } },
    );
  }

  const topic = body.topic;
  if (!isTopic(topic)) return NextResponse.json({ error: "konu" }, { status: 400 });

  const user = await currentUser(req);
  // Ekler yalnız geri bildirimde kabul edilir: diğer konularda dosya taşımanın bir
  // karşılığı yok ve her ek uç, herkese açık bir dosya barındırma servisidir.
  const attachments = topic === "geri-bildirim" ? await saveAttachments(uploads) : [];
  const r = await addFeedback({
    topic,
    brand: str(body.brand, 200),
    link: str(body.link, 400),
    text: str(body.text, 4000),
    email: str(body.email, 300),
    ...(attachments.length ? { attachments } : {}),
    ...(user ? { userId: user.id, ...(user.nick ? { nick: user.nick } : {}) } : {}),
  });

  if (!r.ok) {
    // Kayıt reddedildiyse diske yazılmış ekler ORTADA KALMAMALI — yoksa her başarısız
    // gönderim disk üzerinde erişilemez bir dosya bırakır.
    await removeAttachments(attachments);
    return NextResponse.json({ error: r.error, message: MESSAGES[r.error] }, { status: 400 });
  }

  seen.set(ip, now);
  sweep(now);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

const MESSAGES: Record<string, string> = {
  konu: "Konu seçilmedi.",
  metin: "Birkaç kelime yaz — ne olduğunu anlayamıyoruz.",
  marka: "Marka adını yazman gerekiyor.",
  eposta: "Geçerli bir e-posta adresi gerekiyor.",
};

/** GET — ADMİNE ÖZEL, admin olmayana 404 (bkz. lib/api-auth.ts). */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("deny" in gate) return gate.deny;

  const sp = req.nextUrl.searchParams;
  const rawTopic = sp.get("topic");
  const page = await listFeedback({
    ...(isTopic(rawTopic) ? { topic: rawTopic as Topic } : {}),
    unreadOnly: sp.get("okunmamis") === "1",
    limit: Number(sp.get("limit") ?? 50),
    offset: Number(sp.get("offset") ?? 0),
  });
  return NextResponse.json(page, { headers: NO_STORE });
}

/** PATCH { id, read } — okundu işareti. Admine özel. */
export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("deny" in gate) return gate.deny;

  let body: { id?: string; read?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const ok = await markRead(str(body.id, 40), body.read !== false);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404, headers: NO_STORE });
}

/** DELETE ?id= — kayıt silme. Admine özel. */
export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("deny" in gate) return gate.deny;

  // Kaydı silmeden ÖNCE eklerini oku: silindikten sonra dosya adlarına ulaşamayız
  // ve diskte sahipsiz dosyalar kalır.
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const doomed = await findFeedback(id);
  const ok = await removeFeedback(id);
  if (ok) await removeAttachments(doomed?.attachments);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404, headers: NO_STORE });
}
