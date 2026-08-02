import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { normalizeEmail, publicUser, verifyCode } from "@/lib/auth";
import { setSessionCookie } from "@/lib/auth-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  gecersiz: "Kod hatalı.",
  "suresi-doldu": "Kodun süresi doldu, yeni kod iste.",
  "cok-deneme": "Çok fazla deneme yapıldı, yeni kod iste.",
};

/** POST { email, code, remember } → oturum açar, çerezi basar. */
export async function POST(req: NextRequest) {
  let body: { email?: string; code?: string; remember?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");
  if (!email) return NextResponse.json({ error: "gecersiz-eposta" }, { status: 400 });

  const r = await verifyCode(email, String(body.code ?? ""), body.remember === true);
  if (!r.ok) {
    return NextResponse.json({ error: r.reason, message: REASONS[r.reason] }, { status: 401 });
  }

  return setSessionCookie(
    NextResponse.json({ user: publicUser(r.user) }, { headers: { "Cache-Control": "no-store" } }),
    r.session,
  );
}
