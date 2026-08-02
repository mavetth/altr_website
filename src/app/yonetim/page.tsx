import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SESSION_COOKIE, sessionUser } from "@/lib/auth";
import { AdminConsole } from "@/components/admin/AdminConsole";

export const dynamic = "force-dynamic";

// Yönetim ekranı hiçbir arama motoruna girmemeli; varlığı da duyurulmamalı.
export const metadata = {
  title: "altr · yönetim",
  robots: { index: false, follow: false },
};

/**
 * /yonetim — YÖNETİM KONSOLU.
 *
 * Vitrinden BAĞIMSIZ bir arayüz: kendi kabuğu var, `PageChrome`/`Sidebar`/`TopBar`
 * kullanmıyor, sitenin karanlık-psychedelic dilini de taşımıyor. Sebep şu: yönetim
 * ekranı bir VİTRİN değil, bir ALET. Vitrinin tipografisi (Anton başlıklar, geniş
 * letter-spacing, glitch gölgeler) bakmayı keyifli kılmak için var; burada istenen şey
 * ekrana çok satır sığması ve satırların hızlı taranabilmesi. Tarayıcıların geliştirici
 * araçları tam da bunu çözüyor, referans o: dar satır yüksekliği, monospace, ince
 * ayraçlar, sabit üst şerit, sol sekme sütunu.
 *
 * Eskiden yönetim, vitrinin içinde birer SEKME idi (`store.View` → "istatistik" /
 * "geribildirim"). Bu iki şeyi birden bozuyordu: yönetim ekranı vitrin ızgarasının
 * ölçülerine sıkışıyor, vitrin store'u da yalnız adminde anlam taşıyan durumu
 * taşıyordu. Artık ayrı bir yol; vitrin store'una hiç dokunmuyor.
 *
 * YETKİ: admin olmayan (ve giriş yapmamış) herkes 404 görür — 403 "burada bir yönetim
 * ekranı var" bilgisini sızdırırdı (aynı kural api-auth.ts'te de uygulanıyor).
 */
export default async function YonetimPage() {
  const jar = await cookies();
  const user = await sessionUser(jar.get(SESSION_COOKIE)?.value);
  if (!user || user.role !== "admin") notFound();

  return <AdminConsole nick={user.nick ?? user.email ?? "admin"} />;
}
