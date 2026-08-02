#!/usr/bin/env node
/**
 * ÇATI KATEGORİ DENETİMİ.
 *
 * CAT_GROUPS sol menünün TEK görünüm kaynağı: bir ürün kategorisi hiçbir çatının
 * altında değilse menüden tamamen kaybolur ve o kategorideki ürünlere sol menüden
 * ulaşılamaz (sessiz, gözle fark edilmesi zor bir kayıp). Bu script kapsamayı ve
 * mükerrerliği denetler.
 *
 * Kapsama NAV_CATS üzerinden ölçülür: ARCHIVE_CATS (ayakkabı) bilerek menüde değildir,
 * o kategorideki ürünler kataloga hiç girmez (bkz. scripts/import-catalog.mjs). Arşiv
 * kaleminin bir çatıya YANLIŞLIKLA eklenmesi de hata sayılır — menüde boş bir başlık
 * belirirdi.
 */
import { PRODUCT_CATS, NAV_CATS, ARCHIVE_CATS, CAT_GROUPS } from "../src/lib/types.ts";

let fail = 0;

const seen = new Map();
for (const g of CAT_GROUPS) {
  for (const c of g.cats) {
    if (seen.has(c)) {
      console.log(`FAIL  "${c}" iki çatıda birden: ${seen.get(c)} + ${g.key}`);
      fail++;
    }
    seen.set(c, g.key);
    if (!PRODUCT_CATS.includes(c)) {
      console.log(`FAIL  "${c}" (${g.key}) PRODUCT_CATS'te yok — yetim kalem`);
      fail++;
    }
    if (ARCHIVE_CATS.includes(c)) {
      console.log(`FAIL  "${c}" (${g.key}) ARŞİV kategorisi — menüde boş başlık olur`);
      fail++;
    }
  }
}

for (const c of NAV_CATS) {
  if (!seen.has(c)) {
    console.log(`FAIL  "${c}" hiçbir çatının altında değil — sol menüde görünmez`);
    fail++;
  }
}

console.log(
  `${CAT_GROUPS.length} çatı · ${seen.size}/${NAV_CATS.length} kategori kapsandı` +
    ` (arşiv: ${ARCHIVE_CATS.join(", ")})` +
    (fail ? `\n${fail} sorun` : "\ntamam"),
);
// `process.exit()` DEĞİL: Windows'ta stdout bir pipe'a bağlıyken (npm run),
// son `console.log`un yazımı bitmeden süreç kapatılınca libuv çöküyor
// ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)"). Denetim geçtiği
// hâlde `npm run check` zinciri bu yüzden kırılıyordu. `exitCode` ile süreç
// tamponu boşaltıp kendiliğinden çıkar.
process.exitCode = fail ? 1 : 0;
