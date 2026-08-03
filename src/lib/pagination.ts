/** Sayfalama penceresi: 1 … (aktifin çevresi) … son. GridView ve BrandPage ortak kullanır. */
export function pageList(page: number, count: number): Array<number | "…"> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const around = [page - 1, page, page + 1].filter((n) => n > 1 && n < count);
  const out: Array<number | "…"> = [1];
  if (around[0] > 2) out.push("…");
  out.push(...around);
  if ((around[around.length - 1] ?? 1) < count - 1) out.push("…");
  out.push(count);
  return out;
}
