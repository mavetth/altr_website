// GitHub'ın 100 MB dosya sınırı yüzünden 73.178 ürünlük gerçek katalog
// (.data/catalog.new-full.json, ~120 MB) depoda SIKIŞTIRILMIŞ hâliyle durur
// (.data/catalog.new-full.json.gz, ~13 MB). Bu script `npm install` sonrası
// otomatik çalışıp onu geri açar. Ham dosya zaten varsa dokunmaz.
import { existsSync } from "node:fs";
import { createReadStream, createWriteStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");
const TARGETS = ["catalog.new-full.json"];

for (const name of TARGETS) {
  const raw = path.join(DATA_DIR, name);
  const gz = `${raw}.gz`;
  if (existsSync(raw) || !existsSync(gz)) continue;
  console.log(`[altr] ${name}.gz açılıyor...`);
  await pipeline(createReadStream(gz), createGunzip(), createWriteStream(raw));
  console.log(`[altr] ${name} hazır.`);
}
