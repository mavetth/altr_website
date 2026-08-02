import crypto from "node:crypto";

/**
 * GOOGLE İLE GİRİŞ — OAuth 2.0 "authorization code" akışı.
 *
 * Kütüphane yok, bilerek: akış üç HTTP isteğinden ibaret ve bir auth kütüphanesi bu
 * projeye kendi oturum/veritabanı modelini de getirirdi (bizimki dosya tabanlı).
 *
 * Yapılandırılmadıysa (env yok) sistem KAPALI kalır ve arayüzde Google düğmesi hiç
 * çizilmez — çalışmayacak bir düğme göstermek, göstermemekten kötüdür.
 *
 * Gerekli ortam değişkenleri:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   APP_ORIGIN (ör. https://altr.example) — dönüş adresi buradan kurulur.
 * Google Cloud Console'da izin verilen dönüş adresi: <APP_ORIGIN>/api/auth/google/callback
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

/** CSRF koruması: gidiş ve dönüş aynı tarayıcıya ait mi. */
export const STATE_COOKIE = "altr-oauth-state";
/** Dönüşte "beni hatırla" tercihini taşımak için (Google'a gönderilemez). */
export const REMEMBER_COOKIE = "altr-oauth-remember";
export const STATE_MAX_AGE = 600;

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(origin: string): string {
  return `${process.env.APP_ORIGIN ?? origin}/api/auth/google/callback`;
}

export function newState(): string {
  return crypto.randomBytes(16).toString("base64url");
}

export function authorizeUrl(origin: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(origin),
    response_type: "code",
    // Yalnız kimlik: e-posta ve doğrulanmışlık bilgisi. Profil/foto istenmiyor —
    // istemediğimiz veriyi toplamamak en basit gizlilik önlemi.
    scope: "openid email",
    state,
    prompt: "select_account",
  });
  return `${AUTH_URL}?${p.toString()}`;
}

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
}

/** Kod → token → kullanıcı kimliği. Herhangi bir adım düşerse null. */
export async function exchangeCode(code: string, origin: string): Promise<GoogleIdentity | null> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return null;
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) return null;

  const infoRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!infoRes.ok) return null;
  const info = (await infoRes.json()) as { email?: string; email_verified?: boolean };
  if (!info.email) return null;

  return { email: info.email.toLowerCase(), emailVerified: info.email_verified !== false };
}
