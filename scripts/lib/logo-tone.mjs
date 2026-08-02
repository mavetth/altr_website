/**
 * "Bu logo karanlık temada ters çevrilmeli mi?" kararı — NİHAİ webp üstünden.
 *
 * Eski karar (analyzeTone) zemini KENAR HALKASINDAN okuyordu ve sistematik olarak
 * yanılıyordu: logo `trim()` ile kırpıldığı için kenar halkası artık zemini değil
 * İŞARETİN KENDİSİNİ örnekliyor. Kalın bir wordmark (abluka, giowear, zincir-wear)
 * kenarları harfleriyle doldurunca "zemin açık" sanılıp ters çevriliyordu; sonuç,
 * karanlık sayfanın ortasında bembeyaz bir slab. Renkli kutulu logolarda ise invert
 * markanın rengini bozuyordu (cordelia kırmızıdan camgöbeğine, cucire lacivertten
 * sarıya, manic-sellout maviden sarıya).
 *
 * Yeni kural üç adım:
 *   1) RENKLİ ve YETERİNCE AÇIK logo ters çevrilmez. Invert bir markanın rengini tam
 *      karşıtına taşır; okunurluk için kazandığı şey marka kimliğini bozmasına değmez.
 *      "Yeterince açık" koşulu 2026-08-01'de eklendi: kural renge bakıp tona hiç
 *      bakmıyordu, koyu renkli işaretler (amuse-bouche kahvesi, balina-butik lacivertti,
 *      2downstreet, diddy-studios, doomster, taxim) karanlık sayfada siyah üstüne siyah
 *      kalıyordu — korunan renk zaten GÖRÜNMÜYORDU. Duruşta logolar `grayscale(1)` ile
 *      çiziliyor, yani renk ancak hover'da ortaya çıkıyor: bedeli hover'da ters bir ton,
 *      karşılığı logonun görünmesi.
 *   2) Zemini DOLU (kutulu) logoda zemin tonu KÖŞE YAMALARINDAN okunur — köşeler
 *      kırpmadan sonra bile işaretin en az değdiği yerdir. Kutu açıksa ters çevrilir.
 *   3) Zemini ŞEFFAF logoda karar işaretin kendi tonundadır: koyuysa ters çevrilir.
 */

/** @returns {Promise<boolean>} karanlık temada invert edilmeli mi */
export async function decideInvert(sharp, buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const lumAt = (o) => (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
  const satAt = (o) =>
    (Math.max(data[o], data[o + 1], data[o + 2]) - Math.min(data[o], data[o + 1], data[o + 2])) /
    255;

  let opaque = 0;
  let sum = 0;
  let colored = 0;
  for (let o = 0; o < data.length; o += 4) {
    if (data[o + 3] < 128) continue;
    opaque++;
    sum += lumAt(o);
    if (satAt(o) > 0.2) colored++;
  }
  if (!opaque) return false;

  // 1) Renkli logo: ters çevirmek markanın rengini yalanlar — ama o renk karanlıkta
  //    okunuyorsa. Eşik adım 3'ünkinden (0.45) DÜŞÜK: renkli bir logoyu çevirmenin
  //    bedeli marka kimliği, o yüzden "biraz sönük" yetmez, işaretin AÇIKÇA koyu olması
  //    aranır. Sınırdaki tek örnek slatra (0.45): çevrilse camgöbeğinden pembeye
  //    düşüyordu, kazancı ise bir tık kontrasttı.
  if (colored / opaque > 0.12 && sum / opaque >= 0.4) return false;

  const fill = opaque / (W * H);

  // 2) Kutulu logo: zemin = köşe yamalarının medyanı.
  if (fill > 0.85) {
    const p = Math.max(2, Math.round(Math.min(W, H) * 0.08));
    const vals = [];
    for (const [x0, y0] of [
      [0, 0],
      [W - p, 0],
      [0, H - p],
      [W - p, H - p],
    ]) {
      for (let y = y0; y < y0 + p; y++) {
        for (let x = x0; x < x0 + p; x++) {
          const o = (y * W + x) * 4;
          if (data[o + 3] > 128) vals.push(lumAt(o));
        }
      }
    }
    if (vals.length) {
      vals.sort((a, b) => a - b);
      return vals[vals.length >> 1] > 0.5;
    }
  }

  // 3) Şeffaf zemin: işaret koyuysa karanlık temada görünmez, ters çevir.
  return sum / opaque < 0.45;
}
