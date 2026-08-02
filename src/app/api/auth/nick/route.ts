import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, publicUser, sessionUser, setNick } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  gecersiz: "Nick 2–24 karakter olmalı; harf, rakam, . _ - kullanılabilir.",
  kullanimda: "Bu nick alınmış.",
};

/** POST { nick } → ilk girişte sorulan görünen adı yazar. */
export async function POST(req: NextRequest) {
  const u = await sessionUser(req.cookies.get(SESSION_COOKIE)?.value);
  if (!u) return NextResponse.json({ error: "oturum-yok" }, { status: 401 });

  let body: { nick?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const r = await setNick(u.id, body.nick ?? "");
  if (!r.ok) {
    return NextResponse.json({ error: r.reason, message: REASONS[r.reason] }, { status: 400 });
  }
  return NextResponse.json(
    { user: publicUser(r.user) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
