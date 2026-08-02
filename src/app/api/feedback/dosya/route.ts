import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { findFeedback } from "@/lib/feedback";
import { isInlineViewable, readAttachment } from "@/lib/feedback-files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?id=<geribildirim>&dosya=<ad> — geri bildirim ekini servis eder. ADMİNE ÖZEL.
 *
 * Neden admin denetimi ŞART: bu uç olmadan da dosyalar diskte duruyor, ama herkese
 * açık bir okuma ucu siteyi bir dosya barındırma servisine çevirir — biri ek yükleyip
 * linkini başka yerde paylaşabilir. Kutuyu yalnız admin okur, ekleri de yalnız admin.
 *
 * Dosya adı doğrudan kullanılmıyor: istenen ad ÖNCE kaydın kendi ek listesinde
 * aranıyor. Yani yalnız gerçekten o geri bildirime ait bir ek okunabilir; uydurulmuş
 * bir ad (ya da bir yol kaçışı) hiçbir zaman diske ulaşmaz.
 */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("deny" in gate) return gate.deny;

  const sp = req.nextUrl.searchParams;
  const item = await findFeedback(sp.get("id") ?? "");
  if (!item) return new NextResponse(null, { status: 404 });

  const wanted = sp.get("dosya") ?? "";
  const meta = item.attachments?.find((a) => a.file === wanted);
  if (!meta) return new NextResponse(null, { status: 404 });

  const body = await readAttachment(meta.file);
  if (!body) return new NextResponse(null, { status: 404 });

  // Tür BİZİM tablomuzdan geliyor (bkz. feedback-files.ts): yüklenirken izin listesinden
  // geçmiş bir MIME. Görsel olmayanlar tarayıcıda AÇILMAZ, indirilir — bir PDF'in ya da
  // videonun kendi origin'imizde render edilmesi için hiçbir sebep yok.
  const inline = isInlineViewable(meta.mime);
  const safeName = encodeURIComponent(meta.name);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": meta.mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${safeName}`,
      "X-Content-Type-Options": "nosniff",
      // Ek özel veri: ara sunucular ve tarayıcı geçmişi saklamasın.
      "Cache-Control": "private, no-store",
      // Bu uçtan dönen içerik hiçbir script/çerçeve çalıştıramasın.
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; sandbox",
    },
  });
}
