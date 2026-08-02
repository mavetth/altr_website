// Next'i AÇIKÇA BELİRLENMİŞ bir V8 heap tavanıyla başlatır.
//
// Neden ayrı bir başlatıcı gerekiyor:
//
// 1. Tavan MAKİNEYE GÖRE DEĞİŞİYOR. Node varsayılan `max-old-space-size`ı sistem
//    RAM'ine göre seçiyor: bu geliştirme makinesinde (16 GB) 4288 MB çıkıyor, 8 GB'lık
//    bir sunucuda ~2 GB'a iniyor. Gerçek katalog (.data/catalog.new-full.json,
//    73.214 ürün) tek başına ~480 MB heap, süreç toplamı ~1.5 GB tutuyor; Next'in
//    derleyicisiyle birlikte 2 GB'lık bir tavana yaklaşmak mümkün. Tavanı burada
//    sabitlemek, "benim makinemde çalışıyordu"yu ortadan kaldırıyor.
// 2. `next dev`/`next start` asıl sunucuyu AYRI BİR ALT SÜREÇTE açıyor
//    (`next/dist/server/lib/start-server.js`). Komut satırında verilen
//    `node --max-old-space-size=… next dev` bayrağı o çocuğa GEÇMEZ — yalnız kataloğu
//    hiç okumayan üst süreci ayarlar (ölçüldü: çocukta `NODE_OPTIONS` boş geliyor).
//    `NODE_OPTIONS` ise ortam değişkeni olduğu için çocuğa kendiliğinden miras kalır.
// 3. `NODE_OPTIONS=… next dev` yazımı npm script'inde Windows'ta (cmd.exe) çalışmıyor,
//    POSIX kabuğunda çalışıyor. Bu dosya iki platformda da aynı.
//
// DİKKAT — bu, bu makinedeki eski `next dev` OOM'larının çözümü DEĞİL. O ölümler V8
// heap tavanına dayanmaktan değil, boş sistem RAM'i 1,5 GB'a inince işletim sisteminin
// belleği vermemesinden oluyordu; heap'i büyütmek orada bir şeyi değiştirmiyor
// (bkz. docs/DEVIR-NOTU.md → TUZAKLAR, "Bellek"). Bu dosyanın işi taşınabilirlik.
//
// Kullanım:
//   node scripts/next-with-heap.mjs dev
//   node scripts/next-with-heap.mjs dev --katalog .data/catalog.sample.json
//   node scripts/next-with-heap.mjs start -p 3005
//
// `--katalog <yol>` ALTR_CATALOG'u bu çalıştırma için ezer (bkz. src/lib/cache.ts).
// Diğer bütün argümanlar olduğu gibi Next'e aktarılır.

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// 4096 DEĞİL: bu makinenin kendi varsayılanı 4288 MB, yani 4096 vermek tavanı
// yükseltmek yerine hafifçe DÜŞÜRÜYORDU. 6144, her iki tarafta da gerçek bir tavan.
const HEAP_MB = Number(process.env.ALTR_HEAP_MB ?? 6144) || 6144;

// `--katalog`ı ayıkla; kalanı Next'in argümanı.
const args = [];
let katalog = null;
const raw = process.argv.slice(2);
for (let i = 0; i < raw.length; i++) {
  if (raw[i] === "--katalog") katalog = raw[++i];
  else args.push(raw[i]);
}

// Zaten bir heap ayarı verilmişse ona dokunma — kullanıcının kararı bizimkini yener.
const existing = process.env.NODE_OPTIONS ?? "";
const nodeOptions = /--max-old-space-size/.test(existing)
  ? existing
  : `${existing} --max-old-space-size=${HEAP_MB}`.trim();

const env = { ...process.env, NODE_OPTIONS: nodeOptions };
if (katalog) env.ALTR_CATALOG = katalog;

const child = spawn(process.execPath, [resolve(ROOT, "node_modules/next/dist/bin/next"), ...args], {
  cwd: ROOT,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  // Sinyalle ölen süreçte code null gelir; kabuğa anlamlı bir çıkış kodu bırak.
  process.exit(signal ? 1 : (code ?? 0));
});
