import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  REMEMBER_COOKIE,
  STATE_COOKIE,
  STATE_MAX_AGE,
  authorizeUrl,
  googleConfigured,
  newState,
} from "@/lib/google-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?remember=1 → Google'ın onay ekranına yönlendirir. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (!googleConfigured()) {
    return NextResponse.redirect(`${origin}/?giris=google-kapali`);
  }

  const state = newState();
  const res = NextResponse.redirect(authorizeUrl(origin, state));
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_MAX_AGE,
  };
  // state: dönüşte "bu yönlendirmeyi gerçekten biz mi başlattık" sorusunun cevabı.
  res.cookies.set(STATE_COOKIE, state, opts);
  // "beni hatırla" Google'a gidip gelemez; dönüşte okumak üzere burada bırakılır.
  res.cookies.set(REMEMBER_COOKIE, req.nextUrl.searchParams.get("remember") === "1" ? "1" : "0", opts);
  return res;
}
