/**
 * Çıkış (outbound) olay deposu.
 *
 * Kullanıcıyı hangi markaya / hangi ürüne yolladığımızı kaydeder. İleride sıralama
 * algoritmasının girdisi bu: hangi ürün gerçekten tıklanıyor, hangi marka trafiği
 * çeviriyor, hangi kategori ölü.
 *
 * Depolama bilinçli olarak sade: günlük JSONL dosyası (satır başına bir olay). Bir
 * veritabanı bağlanana kadar bu hem kayıpsız, hem eşzamanlı yazmaya (append) uygun,
 * hem de `wc -l`/`jq` ile incelenebilir. Diske yazılamayan ortamda (salt-okunur
 * serverless FS) olay sessizce düşürülür — vitrin çalışmaya devam eder.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export interface OutboundEvent {
  /** Olay anı (ISO). */
  at: string;
  /** "brand" = mağazaya git, "product" = ürün sayfasına git. */
  kind: "brand" | "product";
  brand: string;
  brandSlug: string;
  /** Ürün id'si (ürün tıklamasıysa). */
  productId?: string;
  productName?: string;
  category?: string;
  /** Gidilen dış adres (host'a indirgenmiş hâli de tutulur). */
  targetHost: string;
  /** Fiyat/para birimi — zaman içinde fiyat-tıklama ilişkisi kurmak için. */
  price?: number | null;
  currency?: string;
  /** Kullanıcının o an uyguladığı bağlam: hangi kategoride/aramadaydı. */
  ctxCat?: string;
  ctxQuery?: string;
  /** Kaba oturum ayrımı için anonim, kalıcı olmayan işaret. */
  session?: string;
}

/**
 * ÜRÜN GÖRÜNTÜLEME olayı — kullanıcı bir ürün kartına tıklayıp modalı açtı.
 *
 * Çıkış olayından AYRI dosyada tutulur: ikisi farklı sorulara cevap verir ("kaç kişi
 * ürünü inceledi" ve "kaç kişi mağazaya gitti") ve tek dosyaya karıştırmak eski
 * `outbound-*.jsonl` dosyalarındaki sayımları geçmişe dönük bozardı.
 */
export interface ViewEvent {
  at: string;
  kind: "modal";
  brand: string;
  brandSlug: string;
  productId: string;
  productName?: string;
  category?: string;
  price?: number | null;
  currency?: string;
  ctxCat?: string;
  ctxQuery?: string;
  session?: string;
}

const DIR = process.env.EVENTS_DIR ?? path.join(process.cwd(), ".data", "events");

let usable = true;

function fileFor(prefix: string, d = new Date()): string {
  const day = d.toISOString().slice(0, 10);
  return path.join(DIR, `${prefix}-${day}.jsonl`);
}

async function append(prefix: string, ev: unknown): Promise<void> {
  if (!usable) return;
  try {
    await fs.mkdir(DIR, { recursive: true });
    await fs.appendFile(fileFor(prefix), `${JSON.stringify(ev)}\n`, "utf8");
  } catch {
    usable = false;
  }
}

/** Günlük dosyayı satır satır okur; olmayan gün sessizce atlanır. */
async function readDay<T>(prefix: string, d: Date): Promise<T[] | null> {
  let text: string;
  try {
    text = await fs.readFile(fileFor(prefix, d), "utf8");
  } catch {
    return null;
  }
  const out: T[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      /* bozuk satır */
    }
  }
  return out;
}

/** Olayı günün dosyasına ekler. Hata yutulur: ölçüm, vitrini bozmamalı. */
export async function recordOutbound(ev: OutboundEvent): Promise<void> {
  await append("outbound", ev);
}

/** Ürün modalı açılışını kaydeder. */
export async function recordView(ev: ViewEvent): Promise<void> {
  await append("views", ev);
}

export interface OutboundSummary {
  total: number;
  byBrand: Array<{ brandSlug: string; brand: string; count: number }>;
  byProduct: Array<{ productId: string; productName: string; brand: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  days: number;
}

/** Son N günün olaylarını özetler (basit sayım — algoritma girdisi için ham malzeme). */
export async function summarizeOutbound(days = 30): Promise<OutboundSummary> {
  const brand = new Map<string, { brand: string; count: number }>();
  const product = new Map<string, { productName: string; brand: string; count: number }>();
  const category = new Map<string, number>();
  let total = 0;
  let seenDays = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000);
    const lines = await readDay<OutboundEvent>("outbound", d);
    if (!lines) continue;
    seenDays++;
    for (const ev of lines) {
      total++;
      const b = brand.get(ev.brandSlug) ?? { brand: ev.brand, count: 0 };
      b.count++;
      brand.set(ev.brandSlug, b);
      if (ev.productId) {
        const p = product.get(ev.productId) ?? {
          productName: ev.productName ?? "",
          brand: ev.brand,
          count: 0,
        };
        p.count++;
        product.set(ev.productId, p);
      }
      if (ev.category) category.set(ev.category, (category.get(ev.category) ?? 0) + 1);
    }
  }

  const byCount = (a: { count: number }, b: { count: number }) => b.count - a.count;

  return {
    total,
    days: seenDays,
    byBrand: [...brand.entries()]
      .map(([brandSlug, v]) => ({ brandSlug, brand: v.brand, count: v.count }))
      .sort(byCount)
      .slice(0, 50),
    byProduct: [...product.entries()]
      .map(([productId, v]) => ({
        productId,
        productName: v.productName,
        brand: v.brand,
        count: v.count,
      }))
      .sort(byCount)
      .slice(0, 50),
    byCategory: [...category.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort(byCount),
  };
}

/* ------------------------------------------------- admin istatistikleri --- */

/** İki ölçünün yan yana durduğu bir satır: görüntülenme ve çıkış. */
export interface StatPair {
  view: number;
  out: number;
}

export interface StatsSummary {
  /** İstenen pencere (gün) ve içinde veri BULUNAN gün sayısı. */
  days: number;
  daysWithData: number;
  totals: StatPair & {
    /** Çıkış / görüntülenme — "modalı açan kaç kişi mağazaya gitti". */
    ctr: number;
    /** Çıkışın türü: ürünün kendi sayfası mı, markanın vitrini mi. */
    outProduct: number;
    outBrand: number;
    sessions: number;
  };
  /** Gün gün seri — grafiğin x ekseni. Boş günler 0 ile DOLDURULUR (çizgi kopmasın). */
  daily: Array<{ day: string } & StatPair>;
  /** Günün saatine göre dağılım (0–23, sunucu saati UTC). */
  hourly: Array<{ hour: number } & StatPair>;
  byBrand: Array<{ brandSlug: string; brand: string } & StatPair>;
  byCategory: Array<{ category: string } & StatPair>;
  byProduct: Array<{ productId: string; productName: string; brand: string } & StatPair>;
}

/** Haritada yoksa açar, sonra alanı arttırır. */
function bump<K>(map: Map<K, StatPair>, key: K, field: "view" | "out"): void {
  const cur = map.get(key) ?? { view: 0, out: 0 };
  cur[field]++;
  map.set(key, cur);
}

const byTotal = (a: StatPair, b: StatPair) => b.view + b.out - (a.view + a.out);

/**
 * Admin panelinin tek veri kaynağı: son N günün ürün görüntülemeleri ve çıkışları.
 *
 * İki günlük dosya (views-*.jsonl ve outbound-*.jsonl) TEK GEÇİŞTE birleştirilir;
 * her kırılım iki ölçüyü yan yana taşır, çünkü paneldeki asıl soru tek başına
 * "kaç tıklama" değil, "ne kadarı mağazaya gitti" (dönüşüm).
 */
export async function summarizeStats(days = 30): Promise<StatsSummary> {
  const daily = new Map<string, StatPair>();
  const hourly = new Map<number, StatPair>();
  const brand = new Map<string, StatPair & { brand: string }>();
  const category = new Map<string, StatPair>();
  const product = new Map<string, StatPair & { productName: string; brand: string }>();
  const sessions = new Set<string>();
  const totals = { view: 0, out: 0, outProduct: 0, outBrand: 0 };
  let daysWithData = 0;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const day = d.toISOString().slice(0, 10);
    // Veri olmayan gün de seriye 0 olarak girer: eksik gün atlanırsa grafikteki
    // x ekseni sıkışıp "her gün trafik vardı" yalanını söylüyor.
    daily.set(day, { view: 0, out: 0 });

    const views = (await readDay<ViewEvent>("views", d)) ?? [];
    const outs = (await readDay<OutboundEvent>("outbound", d)) ?? [];
    if (views.length || outs.length) daysWithData++;

    const feed = (
      list: Array<ViewEvent | OutboundEvent>,
      field: "view" | "out",
    ) => {
      for (const ev of list) {
        totals[field]++;
        if (field === "out") {
          if ((ev as OutboundEvent).kind === "product") totals.outProduct++;
          else totals.outBrand++;
        }
        if (ev.session) sessions.add(ev.session);
        bump(daily, day, field);
        const hour = new Date(ev.at).getUTCHours();
        bump(hourly, Number.isFinite(hour) ? hour : 0, field);
        if (ev.brandSlug) {
          const b = brand.get(ev.brandSlug) ?? { view: 0, out: 0, brand: ev.brand };
          b[field]++;
          brand.set(ev.brandSlug, b);
        }
        if (ev.category) bump(category, ev.category, field);
        if (ev.productId) {
          const p = product.get(ev.productId) ?? {
            view: 0,
            out: 0,
            productName: ev.productName ?? "",
            brand: ev.brand,
          };
          p[field]++;
          product.set(ev.productId, p);
        }
      }
    };

    feed(views, "view");
    feed(outs, "out");
  }

  for (let h = 0; h < 24; h++) if (!hourly.has(h)) hourly.set(h, { view: 0, out: 0 });

  return {
    days,
    daysWithData,
    totals: {
      ...totals,
      ctr: totals.view ? totals.out / totals.view : 0,
      sessions: sessions.size,
    },
    daily: [...daily.entries()].map(([day, v]) => ({ day, ...v })),
    hourly: [...hourly.entries()].map(([hour, v]) => ({ hour, ...v })).sort((a, b) => a.hour - b.hour),
    byBrand: [...brand.entries()]
      .map(([brandSlug, v]) => ({ brandSlug, brand: v.brand, view: v.view, out: v.out }))
      .sort(byTotal)
      .slice(0, 20),
    byCategory: [...category.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort(byTotal)
      .slice(0, 15),
    byProduct: [...product.entries()]
      .map(([productId, v]) => ({
        productId,
        productName: v.productName,
        brand: v.brand,
        view: v.view,
        out: v.out,
      }))
      .sort(byTotal)
      .slice(0, 20),
  };
}
