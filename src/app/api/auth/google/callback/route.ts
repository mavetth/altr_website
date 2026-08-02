import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSession, upsertUser } from "@/lib/auth";
import { setSessionCookie } from "@/lib/auth-cookie";
import { REMEMBER_COOKIE, STATE_COOKIE, exchangeCode, googleConfigured } from "@/lib/google-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Google'dan dönüş: kodu kimliğe çevir, oturumu aç, ana sayfaya gönder. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const fail = (why: string) => {
    const res = NextResponse.redirect(`${origin}/?giris=${why}`);
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(REMEMBER_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  };

  if (!googleConfigured()) return fail("google-kapali");

  const sp = req.nextUrl.searchParams;
  if (sp.get("error")) return fail("iptal");

  const code = sp.get("code");
  const state = sp.get("state");
  const expected = req.cookies.get(STATE_COOKIE)?.value;
  // state eşleşmiyorsa bu dönüşü biz başlatmadık — CSRF; hiçbir oturum açma.
  if (!code || !state || !expected || state !== expected) return fail("dogrulanamadi");

  const identity = await exchangeCode(code, origin);
  if (!identity) return fail("dogrulanamadi");
  // Google'ın doğrulamadığı bir adresle hesap açmak, o adresin sahibi olmayan birine
  // o hesabı vermek demek.
  if (!identity.emailVerified) return fail("eposta-dogrulanmamis");

  const remember = req.cookies.get(REMEMBER_COOKIE)?.value === "1";
  const user = await upsertUser(identity.email, "google");
  const session = await createSession(user.id, remember);

  // Nick yoksa arayüz ilk giriş adımını açsın diye işaretle.
  const res = NextResponse.redirect(`${origin}/?giris=${user.nick ? "tamam" : "nick"}`);
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(REMEMBER_COOKIE, "", { path: "/", maxAge: 0 });
  return setSessionCookie(res, session);
}
