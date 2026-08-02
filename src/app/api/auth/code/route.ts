import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { normalizeEmail, requestCode } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { email, role? } → adrese 6 haneli giriş kodu gönderir. */
export async function POST(req: NextRequest) {
  let body: { email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");
  if (!email) return NextResponse.json({ error: "gecersiz-eposta" }, { status: 400 });

  // "admin" arayüzden SEÇİLEMEZ (bkz. lib/auth.ts roleFor): admin, ADMIN_EMAILS
  // listesinden gelir. İstemciden gelen her şey `user`/`business` ile sınırlanır.
  const role = body.role === "business" ? "business" : "user";

  const r = await requestCode(email, role);
  if (!r.ok) {
    return NextResponse.json(
      { error: "cok-sik", retryAfter: r.retryAfter },
      { status: 429, headers: { "Retry-After": String(r.retryAfter ?? 45) } },
    );
  }
  return NextResponse.json(
    { ok: true, ...(r.devCode ? { devCode: r.devCode } : {}) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
