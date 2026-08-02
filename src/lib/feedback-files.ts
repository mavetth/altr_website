/**
 * GERİ BİLDİRİM EKLERİ — fotoğraf / video / PDF.
 *
 * Bir hata raporunda ekran görüntüsü her açıklamadan iyi anlatıyor; bu yüzden "Bize
 * Ulaşın" formunun geri bildirim konusuna dosya eki eklendi.
 *
 * GÜVENLİK KARARLARI (hepsi bilinçli):
 *
 * 1. TÜR BEYANA GÖRE DEĞİL, İZİN LİSTESİNE GÖRE. Tarayıcının gönderdiği MIME'a
 *    güveniliyor ama yalnız SEÇMEK için; dosya diske bizim belirlediğimiz uzantıyla
 *    yazılıyor ve okunurken de bizim tablomuzdaki tür ile servis ediliyor. Yani
 *    "resim.png" adıyla gelen bir HTML dosyası asla text/html olarak dönmez.
 * 2. DOSYA ADI KULLANILMAZ. Diskteki ad rastgele üretiliyor; kullanıcının yazdığı ad
 *    yalnız GÖSTERİM için metadata'da duruyor. Böylece "../../.env" gibi bir ad ya da
 *    Windows'ta ayrılmış adlar (CON, NUL) dosya yoluna hiç karışmıyor.
 * 3. EKLER ADMİNE ÖZEL. Herkese açık bir yükleme ucu, herkese açık bir dosya barındırma
 *    servisi demektir. Okuma ucu admin denetiminden geçiyor (bkz. api/feedback/dosya).
 * 4. GÖRSEL DIŞINDAKİLER İNDİRİLİR, AÇILMAZ: PDF ve video `Content-Disposition:
 *    attachment` ile dönüyor, ayrıca `X-Content-Type-Options: nosniff` var.
 */
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/** Ek başına tavan. Video için düşük ama bir hata kaydı için 10 MB fazlasıyla yeter. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Gönderim başına ek sayısı. */
export const MAX_FILES = 4;

/**
 * İZİN VERİLEN TÜRLER → diskteki uzantı.
 *
 * SVG BİLEREK YOK: SVG bir belgedir, içinde script çalıştırabilir; "fotoğraf" diye
 * kabul edilip bir gün doğrudan servis edilirse XSS olur.
 */
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
};

/** `<input accept>` için — istemciye kolaylık, kural değil. */
export const UPLOAD_ACCEPT = Object.keys(TYPES).join(",");

export function isAllowedUploadType(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(TYPES, mime);
}

/** Türün "güvenli görüntülenebilir" (gömülebilir görsel) olup olmadığı. */
export function isInlineViewable(mime: string): boolean {
  return mime.startsWith("image/");
}

export interface Attachment {
  /** Diskteki ad — rastgele, kullanıcı girdisi içermez. */
  file: string;
  /** Kullanıcının gördüğü ad. Yalnız GÖSTERİM için; yola asla girmez. */
  name: string;
  mime: string;
  size: number;
}

const DIR = process.env.FEEDBACK_FILES_DIR ?? path.join(process.cwd(), ".data", "feedback-files");

/**
 * Diskteki adın yola çıkmadığını garanti eder.
 *
 * `file` alanını biz üretiyoruz ama bu değer JSON dosyasından geri okunuyor; dosya elle
 * düzenlenirse (ya da ileride başka bir yol eklenirse) yol kaçışına dönüşmesin diye
 * okuma tarafında da denetleniyor. Savunma derinliği: üretimi güvenli olduğu için
 * "gerek yok" demek, tam olarak böyle hataların oluştuğu yerdir.
 */
export function isSafeStoredName(file: string): boolean {
  return /^[a-f0-9]{32}\.[a-z0-9]{2,5}$/.test(file);
}

/**
 * Kullanıcının gördüğü dosya adı. YOLA ASLA GİRMEZ (diskteki ad ayrı üretiliyor);
 * bu yalnız admin panelinde düz metin olarak çizilen etiket.
 *
 * Kontrol karakterleri atılıyor: satır sonu ve ANSI kaçış dizileri, adı bir günlüğe
 * ya da terminale yazan herhangi bir aracı yanıltabilir.
 */
function sanitizeName(raw: unknown): string {
  const s = String(raw ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 120);
  return s || "dosya";
}

/** Ekleri diske yazar; kabul edilmeyen/bozuk olanlar sessizce atlanır. */
export async function saveAttachments(files: File[]): Promise<Attachment[]> {
  const out: Attachment[] = [];
  if (!files.length) return out;
  await fs.mkdir(DIR, { recursive: true });

  for (const f of files.slice(0, MAX_FILES)) {
    const ext = TYPES[f.type];
    if (!ext) continue;
    if (f.size <= 0 || f.size > MAX_FILE_BYTES) continue;

    const buf = Buffer.from(await f.arrayBuffer());
    // İkinci kontrol: `size` beyanı ile gerçek gövde uyuşmayabilir.
    if (buf.byteLength > MAX_FILE_BYTES) continue;

    const stored = `${createHash("md5").update(randomUUID()).digest("hex")}.${ext}`;
    try {
      await fs.writeFile(path.join(DIR, stored), buf);
    } catch {
      continue; // diske yazılamadıysa eki atla — geri bildirimin kendisi kaydedilmeye devam
    }
    out.push({
      file: stored,
      name: sanitizeName(f.name),
      mime: f.type,
      size: buf.byteLength,
    });
  }
  return out;
}

/** Eki diskten okur. Ad güvenli değilse ya da dosya yoksa null. */
export async function readAttachment(file: string): Promise<Buffer | null> {
  if (!isSafeStoredName(file)) return null;
  try {
    return await fs.readFile(path.join(DIR, file));
  } catch {
    return null;
  }
}

/** Geri bildirim silinince ekleri de sil — yoksa disk sessizce dolar. */
export async function removeAttachments(list: readonly Attachment[] | undefined): Promise<void> {
  for (const a of list ?? []) {
    if (!isSafeStoredName(a.file)) continue;
    await fs.unlink(path.join(DIR, a.file)).catch(() => {});
  }
}
