#!/usr/bin/env node
/**
 * ADMIN PAROLA ÖZETİ — `.env.local`e yazılacak satırı üretir.
 *
 *   npm run admin-hash -- guap guap@altr.local "parola"
 *
 * Parolayı komut satırına yazmak istemezsen üçüncü argümanı boş bırak, script sorar
 * (girdi ekrana yazılmaz). Parola hiçbir yerde saklanmaz; çıktıdaki özetten geri
 * çevrilemez.
 *
 * Parametreler src/lib/auth.ts ile AYNI olmak zorunda (N/r/p/keylen) — biri değişirse
 * üretilmiş bütün özetler geçersiz olur.
 */
import crypto from "node:crypto";
import readline from "node:readline";

const KEYLEN = 32;
const PARAMS = { N: 16384, r: 8, p: 1 };

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEYLEN, PARAMS, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** Parolayı ekrana yazmadan sorar. */
function askHidden(soru) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const out = process.stdout;
    rl.question(soru, (cevap) => {
      rl.close();
      out.write("\n");
      resolve(cevap);
    });
    rl._writeToOutput = (s) => {
      if (s.startsWith(soru)) out.write(s);
    };
  });
}

async function main() {
  const [handle, email, parolaArg] = process.argv.slice(2);

  if (!handle || !email) {
    console.error("Kullanım: npm run admin-hash -- <handle> <eposta> [parola]");
    console.error('Örnek:    npm run admin-hash -- guap guap@altr.local "cok-gizli"');
    process.exit(1);
  }
  if (handle.includes("@") || handle.includes(":")) {
    console.error("Handle '@' veya ':' iceremez (giris kutusunda e-postadan bu sekilde ayriliyor).");
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) {
    console.error("E-posta biçimi gecersiz.");
    process.exit(1);
  }

  const parola = parolaArg ?? (await askHidden("Parola: "));
  if (!parola || parola.length < 8) {
    console.error("Parola en az 8 karakter olmali.");
    process.exit(1);
  }

  const salt = crypto.randomBytes(16);
  const hash = await scrypt(parola, salt);
  // Ayrac `.` — `$` kullanilamaz: Next'in env yukleyicisi `$...` parcasini degisken
  // sanip bosa cevirir ve ozet sessizce bozulur.
  const secret = `scrypt.${salt.toString("base64url")}.${hash.toString("base64url")}`;

  console.log("");
  console.log(".env.local icindeki ADMIN_ACCOUNTS satirina EKLE (virgulle ayir):");
  console.log("");
  console.log(`${handle}:${email.toLowerCase()}:${secret}`);
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
