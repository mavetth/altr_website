import { NextResponse } from "next/server";
import { REMEMBER_MAX_AGE, SESSION_COOKIE, SHORT_MAX_AGE, type Session } from "./auth";

/**
 * Oturum çerezi — tek yerde. Beş ayrı route'ta beş kez yazılırsa biri er geç
 * `httpOnly`u unutur.
 *
 * `httpOnly`: sayfadaki hiçbir script token'ı okuyamaz (XSS ile oturum çalınamaz).
 * `sameSite: lax`: başka siteden gelen POST'lar çerezi taşımaz (CSRF), ama Google
 * dönüşü gibi normal yönlendirmeler çalışır.
 * `secure`: canlıda yalnız HTTPS. Geliştirmede http://localhost için kapalı olmalı.
 */
export function setSessionCookie(res: NextResponse, session: Session): NextResponse {
  res.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: session.remember ? REMEMBER_MAX_AGE : SHORT_MAX_AGE,
  });
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
