/**
 * ÜYELİK — e-posta + 6 haneli kod, Google ile giriş, "beni hatırla".
 *
 * Hesap artık listelere ve tercihlere BAĞLI (bkz. lib/user-data.ts): giriş yapan
 * kullanıcının listeleri cihazdakiyle birleşip sunucuda tutulur.
 *
 * NORMAL kullanıcıda parola YOK. Her girişte e-postaya 6 haneli kod gider; kod tek
 * kullanımlık ve kısa ömürlüdür. Parolasız akış bu vitrin için doğru olan: kullanıcı bir
 * liste tutmak için geliyor, parola yönetmek için değil — ve bizim tarafımızda çalınacak
 * parola olmuyor.
 *
 * TEK İSTİSNA admin hesapları (bkz. "admin parolası" bölümü): kod e-postayla gittiği
 * ve henüz bir SMTP bağlı olmadığı için, yönetim hesabı postaya bağımlı olamaz.
 *
 * Depolama events.ts/restock.ts ile aynı sadelikte: JSON dosyaları + süreç-içi harita.
 * Veritabanı bağlanacağı gün değişmesi gereken tek yer bu dosyanın "depo" bölümü;
 * yukarısındaki oturum/kod mantığı olduğu gibi kalır.
 */
import { promises as fs } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

/* ------------------------------------------------------------- modeller --- */

/**
 * ROLLER.
 * - `user`     : normal ziyaretçi. Varsayılan.
 * - `business` : marka/işletme hesabı. Kayıtta seçilir; şimdilik yalnız bir ETİKET —
 *                hiçbir yetki açmıyor, çünkü doğrulama (marka gerçekten bu kişinin mi)
 *                henüz yok. Yetki, doğrulama gelince eklenecek.
 * - `admin`    : ADMIN_EMAILS ortam değişkenindeki adresler. Arayüzden SEÇİLEMEZ —
 *                seçilebilir olsaydı herkes admin olurdu.
 */
export type Role = "user" | "business" | "admin";

export interface User {
  id: string;
  email: string;
  /** Görünen ad. İlk girişte sorulur; o ana kadar null. */
  nick: string | null;
  role: Role;
  /** Kayıtta seçilen hesap türü — admin'e yükseltme buna bakmaz. */
  requestedRole: Exclude<Role, "admin">;
  /** Girişi hangi yolla yaptı: kod mu, Google mı (ikisi de olabilir). */
  providers: Array<"email" | "google">;
  createdAt: string;
  lastLoginAt: string;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  /** "Beni hatırla" işaretlendi mi — oturumun ömrünü bu belirledi. */
  remember: boolean;
}

/* -------------------------------------------------------------- ayarlar --- */

const DIR = process.env.AUTH_DIR ?? path.join(process.cwd(), ".data", "auth");
const USERS_FILE = path.join(DIR, "users.json");
const SESSIONS_FILE = path.join(DIR, "sessions.json");

export const SESSION_COOKIE = "altr-session";
/** "Beni hatırla" işaretliyse 60 gün, değilse 12 saat. */
export const REMEMBER_MAX_AGE = 60 * 60 * 24 * 60;
export const SHORT_MAX_AGE = 60 * 60 * 12;

/** Kodun ömrü ve bir e-postanın penceredeki deneme hakkı. */
const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_MAX_ATTEMPTS = 5;
/** Aynı adrese arka arkaya kod isteme sınırı. */
const CODE_COOLDOWN_MS = 45 * 1000;

/**
 * Kodu kullanıcıya nasıl ulaştırıyoruz: HENÜZ bir e-posta sağlayıcısı bağlı değil.
 * Bu bayrak açıkken kod API cevabında ve sunucu günlüğünde görünür — geliştirme için.
 * Canlıya çıkmadan ÖNCE bir SMTP/servis bağlanmalı ve bu bayrak kapanmalı; kapalıyken
 * kod hiçbir yerde sızmaz, sadece gönderilir (gönderilemezse giriş başarısız olur).
 */
export const DEV_CODES =
  process.env.AUTH_DEV_CODES === "1" ||
  (process.env.AUTH_DEV_CODES !== "0" && process.env.NODE_ENV !== "production");

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/* --------------------------------------------------------------- depo ----- */

type Users = Record<string, User>; // id -> user
type Sessions = Record<string, Session>; // token -> session

const g = globalThis as unknown as {
  __altrUsers?: Users;
  __altrSessions?: Sessions;
  __altrCodes?: Map<string, CodeEntry>;
};

let users: Users | null = g.__altrUsers ?? null;
let sessions: Sessions | null = g.__altrSessions ?? null;
let writable = true;

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  if (!writable) return;
  try {
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(file, JSON.stringify(value), "utf8");
  } catch {
    // Salt-okunur dosya sistemi: hesaplar sürecin ömrü boyunca bellekte yaşar.
    writable = false;
  }
}

async function loadUsers(): Promise<Users> {
  users ??= g.__altrUsers = await readJson<Users>(USERS_FILE, {});
  return users;
}

async function loadSessions(): Promise<Sessions> {
  sessions ??= g.__altrSessions = await readJson<Sessions>(SESSIONS_FILE, {});
  return sessions;
}

/* --------------------------------------------------------------- kodlar --- */

interface CodeEntry {
  /** Kodun kendisi DEĞİL, karması saklanır: dosyaya/loga düşse bile işe yaramasın. */
  hash: string;
  expiresAt: number;
  attempts: number;
  sentAt: number;
  requestedRole: Exclude<Role, "admin">;
}

// Kodlar bilerek yalnız BELLEKTE: 10 dakikalık ömürleri var, sunucu yeniden başlarsa
// kullanıcı yeni kod ister. Diske yazmak, kısa ömürlü bir sırrı kalıcı hale getirmek olur.
const codes: Map<string, CodeEntry> = g.__altrCodes ?? (g.__altrCodes = new Map());

function hashCode(email: string, code: string): string {
  return crypto.createHash("sha256").update(`${email}|${code}`).digest("hex");
}

export function normalizeEmail(raw: string): string | null {
  const e = String(raw ?? "").trim().toLowerCase();
  // Kasıtlı olarak gevşek ama işe yarar bir kontrol: tek @, iki yanında da içerik,
  // alan adında en az bir nokta ve boşluk yok.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e) || e.length > 254) return null;
  return e;
}

export interface RequestCodeResult {
  ok: boolean;
  /** DEV_CODES açıkken kodun kendisi — arayüz ekranda gösterir. */
  devCode?: string;
  /** Çok sık istendi: kaç saniye sonra tekrar denenebilir. */
  retryAfter?: number;
}

export async function requestCode(
  email: string,
  requestedRole: Exclude<Role, "admin"> = "user",
): Promise<RequestCodeResult> {
  const prev = codes.get(email);
  const now = Date.now();
  if (prev && now - prev.sentAt < CODE_COOLDOWN_MS) {
    return { ok: false, retryAfter: Math.ceil((CODE_COOLDOWN_MS - (now - prev.sentAt)) / 1000) };
  }

  // 6 hane, baştaki sıfır dahil. Math.random DEĞİL: bu bir kimlik doğrulama sırrı.
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  codes.set(email, {
    hash: hashCode(email, code),
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    sentAt: now,
    requestedRole,
  });

  await deliverCode(email, code);
  return { ok: true, ...(DEV_CODES ? { devCode: code } : {}) };
}

/**
 * Kodu kullanıcıya ulaştırır. Bir e-posta sağlayıcısı bağlanana kadar tek yaptığı
 * sunucu günlüğüne yazmak — bu yüzden DEV_CODES kapalıyken sistem canlıda ÇALIŞMAZ,
 * ve bu bilerek böyle: sessizce "kod gönderildi" deyip göndermemekten iyidir.
 */
async function deliverCode(email: string, code: string): Promise<void> {
  if (DEV_CODES) {
    console.log(`[auth] ${email} için giriş kodu: ${code}`);
    return;
  }
  console.warn(
    `[auth] E-posta sağlayıcısı bağlı değil; ${email} adresine kod GÖNDERİLEMEDİ. ` +
      `Canlıya çıkmadan önce deliverCode() bir SMTP/servise bağlanmalı.`,
  );
}

export type VerifyResult =
  | { ok: true; user: User; session: Session }
  | { ok: false; reason: "gecersiz" | "suresi-doldu" | "cok-deneme" };

export async function verifyCode(
  email: string,
  code: string,
  remember: boolean,
): Promise<VerifyResult> {
  const entry = codes.get(email);
  if (!entry) return { ok: false, reason: "gecersiz" };
  if (Date.now() > entry.expiresAt) {
    codes.delete(email);
    return { ok: false, reason: "suresi-doldu" };
  }
  if (entry.attempts >= CODE_MAX_ATTEMPTS) {
    codes.delete(email);
    return { ok: false, reason: "cok-deneme" };
  }

  const given = hashCode(email, String(code ?? "").trim());
  // Sabit zamanlı karşılaştırma: kodun kaç hanesinin tuttuğu yanıt süresinden anlaşılmasın.
  const match =
    given.length === entry.hash.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(entry.hash));
  if (!match) {
    entry.attempts++;
    return { ok: false, reason: "gecersiz" };
  }

  codes.delete(email);
  const user = await upsertUser(email, "email", entry.requestedRole);
  const session = await createSession(user.id, remember);
  return { ok: true, user, session };
}

/* ------------------------------------------------------ admin parolası ---- */

/**
 * YÖNETİM HESAPLARI — nick + parola.
 *
 * Neden normal akıştan ayrı: giriş kodu e-postayla gidiyor, e-posta sağlayıcısı henüz
 * bağlı değil (bkz. deliverCode). Yönetim hesabının çalışması bu bağa bağlı olamaz —
 * canlıda AUTH_DEV_CODES=0 olduğu anda panele hiç girilemezdi.
 *
 * Arayüzde AYRI BİR DÜĞME YOK: giriş kutusuna `@` içermeyen bir değer yazılırsa parola
 * adımına geçilir (bkz. AuthModal). Normal kullanıcı her zaman bir e-posta adresi yazar,
 * onun için ekran birebir aynı kalır. Var olmayan bir handle da geçersiz parolayla aynı
 * cevabı alır: hangi handle'ların var olduğu dışarıdan anlaşılmaz.
 *
 * Yapılandırma — `.env.local`:
 *   ADMIN_ACCOUNTS=guap:guap@altr.local:scrypt.<tuz>.<özet>,maveth:...
 * Özet `npm run admin-hash -- <handle> <eposta> <parola>` ile üretilir; parolanın
 * kendisi hiçbir yerde saklanmaz.
 *
 * Ayraç neden `.`: Next'in env yükleyicisi `$` ile başlayan parçaları DEĞİŞKEN sanıp
 * boşa çeviriyor (`scrypt$abc$def` → `scrypt`). Base64url alfabesinde `.` geçmediği
 * için ayraç olarak güvenli.
 */

const SCRYPT_KEYLEN = 32;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

/** Yanlış parola penceresi: 10 dakikada 5 deneme, sonra 15 dakika kilit. */
const ADMIN_MAX_ATTEMPTS = 5;
const ADMIN_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_LOCK_MS = 15 * 60 * 1000;

interface AdminAccount {
  handle: string;
  email: string;
  salt: Buffer;
  hash: Buffer;
}

interface AdminAttempts {
  count: number;
  first: number;
  lockedUntil: number;
}

const adminAttempts: Map<string, AdminAttempts> =
  (g as { __altrAdminTries?: Map<string, AdminAttempts> }).__altrAdminTries ??
  ((g as { __altrAdminTries?: Map<string, AdminAttempts> }).__altrAdminTries = new Map());

function b64(raw: string): Buffer {
  return Buffer.from(raw, "base64url");
}

/** ADMIN_ACCOUNTS -> handle (küçük harf) -> hesap. Bozuk satırlar sessizce atlanır. */
function adminAccounts(): Map<string, AdminAccount> {
  const out = new Map<string, AdminAccount>();
  for (const row of (process.env.ADMIN_ACCOUNTS ?? "").split(/[,\s]+/)) {
    const line = row.trim();
    if (!line) continue;
    const [handle, email, secret] = line.split(":");
    if (!handle || !email || !secret) continue;
    const parts = secret.split(".");
    if (parts[0] !== "scrypt" || parts.length !== 3) continue;
    try {
      out.set(handle.toLowerCase(), {
        handle,
        email: email.toLowerCase(),
        salt: b64(parts[1]),
        hash: b64(parts[2]),
      });
    } catch {
      // bozuk base64 — bu satır yok sayılır
    }
  }
  return out;
}

/** ADMIN_ACCOUNTS'taki adresler de admindir; ayrıca ADMIN_EMAILS'e yazmak gerekmesin. */
function adminAccountEmails(): Set<string> {
  return new Set([...adminAccounts().values()].map((a) => a.email));
}

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/** Handle biçimi nick kurallarıyla aynı, ama `@` içeremez (o zaten e-posta yoludur). */
export function normalizeHandle(raw: string): string | null {
  const h = String(raw ?? "").trim();
  if (h.includes("@")) return null;
  return normalizeNick(h);
}

export type AdminLoginResult =
  | { ok: true; user: User; session: Session }
  | { ok: false; reason: "gecersiz" }
  | { ok: false; reason: "kilitli"; retryAfter: number };

/**
 * Nick + parola ile yönetim girişi.
 *
 * Handle bulunamasa bile scrypt yine de çalıştırılır (kukla tuzla): var olan ve olmayan
 * handle'ın cevap süresi ayrışmasın.
 */
export async function adminLogin(
  handleRaw: string,
  password: string,
  remember: boolean,
): Promise<AdminLoginResult> {
  const handle = normalizeHandle(handleRaw);
  const key = (handle ?? String(handleRaw ?? "")).toLowerCase().slice(0, 64);
  const now = Date.now();

  const tries = adminAttempts.get(key);
  if (tries && tries.lockedUntil > now) {
    return { ok: false, reason: "kilitli", retryAfter: Math.ceil((tries.lockedUntil - now) / 1000) };
  }
  if (tries && now - tries.first > ADMIN_WINDOW_MS) adminAttempts.delete(key);

  const account = handle ? adminAccounts().get(handle.toLowerCase()) : undefined;
  const salt = account?.salt ?? Buffer.alloc(16);
  const given = await scrypt(String(password ?? ""), salt);
  const match =
    account != null &&
    given.length === account.hash.length &&
    crypto.timingSafeEqual(given, account.hash);

  if (!match) {
    const cur = adminAttempts.get(key) ?? { count: 0, first: now, lockedUntil: 0 };
    cur.count++;
    if (cur.count >= ADMIN_MAX_ATTEMPTS) cur.lockedUntil = now + ADMIN_LOCK_MS;
    adminAttempts.set(key, cur);
    return { ok: false, reason: "gecersiz" };
  }

  adminAttempts.delete(key);
  let user = await upsertUser(account.email, "email", "user");
  // Nick'i handle'a sabitle: yönetim hesabı "son adım" ekranına düşmesin.
  if (!user.nick) {
    const r = await setNick(user.id, account.handle);
    if (r.ok) user = r.user;
  }
  const session = await createSession(user.id, remember);
  return { ok: true, user, session };
}

/* ------------------------------------------------------------ kullanıcı --- */

function roleFor(email: string, requested: Exclude<Role, "admin">): Role {
  // İki kaynak: ADMIN_EMAILS (parolasız, normal kod akışıyla girer) ve ADMIN_ACCOUNTS
  // (parolalı yönetim hesabı). İkincisinin ayrıca ADMIN_EMAILS'e yazılması gerekmez —
  // yazılması unutulursa hesap açılır ama yetkisiz kalırdı.
  return adminEmails().has(email) || adminAccountEmails().has(email) ? "admin" : requested;
}

export async function upsertUser(
  email: string,
  provider: "email" | "google",
  requestedRole: Exclude<Role, "admin"> = "user",
): Promise<User> {
  const all = await loadUsers();
  const now = new Date().toISOString();
  let user = Object.values(all).find((u) => u.email === email);

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email,
      nick: null,
      requestedRole,
      role: roleFor(email, requestedRole),
      providers: [provider],
      createdAt: now,
      lastLoginAt: now,
    };
    all[user.id] = user;
  } else {
    if (!user.providers.includes(provider)) user.providers.push(provider);
    user.lastLoginAt = now;
    // Admin listesi ortam değişkeninden gelir; her girişte yeniden değerlendirilir ki
    // listeye eklenen/çıkarılan bir adres için kullanıcı kaydını elle düzenlemek gerekmesin.
    user.role = roleFor(email, user.requestedRole);
  }

  await writeJson(USERS_FILE, all);
  return user;
}

export async function getUser(id: string): Promise<User | null> {
  return (await loadUsers())[id] ?? null;
}

/** Nick kuralları: 2–24 karakter, harf/rakam/alt çizgi/nokta/tire; benzersiz. */
export function normalizeNick(raw: string): string | null {
  const n = String(raw ?? "").trim();
  if (n.length < 2 || n.length > 24) return null;
  if (!/^[\p{L}\p{N}._-]+$/u.test(n)) return null;
  return n;
}

export type SetNickResult =
  | { ok: true; user: User }
  | { ok: false; reason: "gecersiz" | "kullanimda" };

export async function setNick(userId: string, raw: string): Promise<SetNickResult> {
  const nick = normalizeNick(raw);
  if (!nick) return { ok: false, reason: "gecersiz" };
  const all = await loadUsers();
  const user = all[userId];
  if (!user) return { ok: false, reason: "gecersiz" };
  // Benzersizlik İKİ küçültmeyle birden bakılır. Ayrışma yalnız BÜYÜK "I"da çıkar:
  // "MILLA" Türkçe kuralla "mılla", düz kuralla "milla" olur. Tek bir kurala bakarsak
  // "MILLA" ile "milla" ayrı iki hesaba verilebilirdi. ("mılla" ile "milla" ise
  // gerçekten farklı iki sözcüktür ve ayrı kalmalıdır — bu kontrol onları ayırmaz.)
  const keys = [nick.toLocaleLowerCase("tr"), nick.toLowerCase()];
  const taken = Object.values(all).some(
    (u) =>
      u.id !== userId &&
      u.nick != null &&
      (keys.includes(u.nick.toLocaleLowerCase("tr")) || keys.includes(u.nick.toLowerCase())),
  );
  if (taken) return { ok: false, reason: "kullanimda" };
  user.nick = nick;
  await writeJson(USERS_FILE, all);
  return { ok: true, user };
}

/* -------------------------------------------------------------- oturum ---- */

export async function createSession(userId: string, remember: boolean): Promise<Session> {
  const all = await loadSessions();
  const maxAge = (remember ? REMEMBER_MAX_AGE : SHORT_MAX_AGE) * 1000;
  const session: Session = {
    token: crypto.randomBytes(32).toString("base64url"),
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + maxAge,
    remember,
  };
  all[session.token] = session;
  pruneSessions(all);
  await writeJson(SESSIONS_FILE, all);
  return session;
}

function pruneSessions(all: Sessions): void {
  const now = Date.now();
  for (const [token, s] of Object.entries(all)) if (s.expiresAt < now) delete all[token];
}

export async function sessionUser(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const all = await loadSessions();
  const s = all[token];
  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    delete all[token];
    await writeJson(SESSIONS_FILE, all);
    return null;
  }
  return getUser(s.userId);
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  const all = await loadSessions();
  if (all[token]) {
    delete all[token];
    await writeJson(SESSIONS_FILE, all);
  }
}

/* ------------------------------------------------------- dışa açılan tip -- */

/** Arayüze giden kullanıcı — e-posta dışında hassas alan zaten yok. */
export interface PublicUser {
  id: string;
  email: string;
  nick: string | null;
  role: Role;
  /** Nick henüz verilmemiş: arayüz ilk giriş adımını gösterir. */
  needsNick: boolean;
}

export function publicUser(u: User): PublicUser {
  return { id: u.id, email: u.email, nick: u.nick, role: u.role, needsNick: !u.nick };
}
