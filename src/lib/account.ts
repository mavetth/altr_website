"use client";
import type { PublicUser, Role } from "./auth";

/** Rolün arayüzde görünen adı. */
export const ROLE_LABEL: Record<Role, string> = {
  user: "ÜYE",
  business: "İŞLETME",
  admin: "ADMIN",
};

export type { PublicUser, Role };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!res.ok) throw new Error(data.message ?? data.error ?? "İşlem başarısız.");
  return data;
}

export function fetchMe(): Promise<{ user: PublicUser | null; google: boolean }> {
  return fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json());
}

export function requestLoginCode(
  email: string,
  role: "user" | "business",
): Promise<{ ok: true; devCode?: string }> {
  return post("/api/auth/code", { email, role });
}

export function verifyLoginCode(
  email: string,
  code: string,
  remember: boolean,
): Promise<{ user: PublicUser }> {
  return post("/api/auth/verify", { email, code, remember });
}

/**
 * Yönetim girişi — nick + parola. Arayüzde ayrı bir düğmesi yok: giriş kutusuna `@`
 * içermeyen bir değer yazılınca AuthModal bu yola sapar (bkz. lib/auth.ts).
 */
export function adminLogin(
  handle: string,
  password: string,
  remember: boolean,
): Promise<{ user: PublicUser }> {
  return post("/api/auth/admin", { handle, password, remember });
}

export function saveNick(nick: string): Promise<{ user: PublicUser }> {
  return post("/api/auth/nick", { nick });
}

export function logout(): Promise<{ ok: true }> {
  return post("/api/auth/logout", {});
}
