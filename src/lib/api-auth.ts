/**
 * ROUTE KAPILARI — oturum/yetki kontrolünün tek yeri.
 *
 * `auth.ts` bilerek `next/server`den habersiz kalıyor (saf Node; script'ler de import
 * edebilsin). Route'ların ihtiyacı olan "çerezi oku, yetkiyi ölç, uygun cevabı dön"
 * adımı burada duruyor.
 *
 * Bu blok daha önce /api/stats ve /api/outbound içinde birebir kopyaydı; üçüncü kopya
 * (/api/feedback) yazılacakken tek yere alındı. Kopyalanan bir yetki kontrolünde er geç
 * biri `!user` kontrolünü ya da 404'ü unutur.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionUser, type User } from "./auth";

/** Hassas/oturuma bağlı her cevapta. */
export const NO_STORE = { "Cache-Control": "no-store" } as const;

/** İstekteki oturumun kullanıcısı (yoksa null). */
export function currentUser(req: NextRequest): Promise<User | null> {
  return sessionUser(req.cookies.get(SESSION_COOKIE)?.value);
}

/**
 * Admin kapısı.
 *
 * Admin olmayana **404** döner — 403 "burada bir yönetim ucu var" bilgisini sızdırırdı;
 * yönetim uçlarının varlığı dışarıdan görünmemeli.
 *
 *   const gate = await requireAdmin(req);
 *   if ("deny" in gate) return gate.deny;
 *   gate.user  // admin
 */
export async function requireAdmin(
  req: NextRequest,
): Promise<{ user: User } | { deny: NextResponse }> {
  const user = await currentUser(req);
  if (!user || user.role !== "admin") {
    return { deny: NextResponse.json({ error: "bulunamadı" }, { status: 404 }) };
  }
  return { user };
}

/**
 * Oturum kapısı — admin değil, sadece "giriş yapmış olmak" isteyen uçlar için.
 * Burada 401 doğru: ucun varlığı zaten gizli değil, kullanıcının yapması gereken şey
 * giriş yapmak.
 */
export async function requireUser(
  req: NextRequest,
): Promise<{ user: User } | { deny: NextResponse }> {
  const user = await currentUser(req);
  if (!user) {
    return {
      deny: NextResponse.json(
        { error: "oturum-yok", message: "Bunun için giriş yapmalısın." },
        { status: 401, headers: NO_STORE },
      ),
    };
  }
  return { user };
}
