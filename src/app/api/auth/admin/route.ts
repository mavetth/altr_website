import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { adminLogin, publicUser } from "@/lib/auth";
import { setSessionCookie } from "@/lib/auth-cookie";
import { NO_STORE } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { handle, password, remember } → yönetim oturumu açar.
 *
 * Hata mesajı TEK: handle yok da olsa parola yanlış da olsa aynı cevap döner, yoksa
 * hangi handle'ların var olduğu denenerek çıkarılabilirdi.
 */
export async function POST(req: NextRequest) {
  let body: { handle?: string; password?: string; remember?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const r = await adminLogin(
    String(body.handle ?? ""),
    String(body.password ?? ""),
    body.remember === true,
  );

  if (!r.ok) {
    if (r.reason === "kilitli") {
      return NextResponse.json(
        { error: "kilitli", message: `Çok fazla deneme. ${r.retryAfter} sn sonra tekrar dene.` },
        { status: 429, headers: { ...NO_STORE, "Retry-After": String(r.retryAfter) } },
      );
    }
    return NextResponse.json(
      { error: "gecersiz", message: "Kullanıcı adı veya parola hatalı." },
      { status: 401, headers: NO_STORE },
    );
  }

  return setSessionCookie(
    NextResponse.json({ user: publicUser(r.user) }, { headers: NO_STORE }),
    r.session,
  );
}
