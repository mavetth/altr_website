// Node'un tip-soymayla doğrudan çalıştırdığı scriptlerde (import-catalog) JSON modülü
// import attribute ister; webpack/tsc (bundler) de bunu destekler.
import RAW from "../../data/brand-scores.json" with { type: "json" };

/**
 * Editoryal marka puanı (1–5). Keşfet akışının omurgası.
 *
 * Neden elle puan: davranış verisi (tıklama, satın alma, dönüş) daha yok. Soğuk
 * başlangıçta sıralamanın en güvenilir sinyali insan kararıdır — "algoritma" burada
 * iyi kürasyon + akıllı karıştırma demek. Davranış biriktiğinde bu puan tek başına
 * sıralamayı belirlemekten çıkıp bir girdiye dönüşecek (bkz. discovery.ts).
 *
 * Dosya: data/brand-scores.json — elle düzenlenir, scraper dokunmaz.
 */
const TABLE = (RAW as { puanlar: Record<string, number> }).puanlar;
const DEFAULT_SCORE = (RAW as { _varsayilan?: number })._varsayilan ?? 3;

/** Ölçek uçları — puanı 0..1'e indirgerken kullanılır. */
export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

/** Markanın 1–5 arası ham editoryal puanı. Listede yoksa nötr (3). */
export function brandScore(slug: string): number {
  const v = TABLE[slug];
  return typeof v === "number" ? v : DEFAULT_SCORE;
}

/** Aynı puanın 0–1'e sıkıştırılmış hâli — skor karışımlarında bu kullanılır. */
export function brandScore01(slug: string): number {
  const s = brandScore(slug);
  return Math.min(1, Math.max(0, (s - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)));
}

/** Puanı verilmiş marka sayısı — denetim/rapor için. */
export function scoredBrandCount(): number {
  return Object.keys(TABLE).length;
}
