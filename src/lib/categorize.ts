import type { ProductCat } from "./types";

/**
 * Ürün adından KATEGORİ tespiti.
 *
 * Taksonomi düz: "üst giyim" gibi çatı kategori yok, doğrudan ürün tipi var
 * (TİŞÖRT, HOODIE, GÖMLEK, ŞORT…). Gruplama sonra, arayüz katmanında yapılacak.
 *
 * Üç tuzak bu dosyanın biçimini belirledi:
 *
 * 1) JS'in `\b` sınırı Türkçe harfleri sözcük karakteri saymaz; `\bşort\b` bir boşluktan
 *    sonra ASLA eşleşmez (boşluk da "ş" de sözcük-dışı, aralarında sınır yok). Bu yüzden
 *    kendi sınırımızı kuruyoruz: `w()`.
 * 2) Sıra kritik. "t-shirt" içindeki "shirt" gömlek kuralına takılıyordu; hoodie de bir
 *    sweat türü. Spesifik olan daima önce gelir: HOODIE > SWEATSHIRT > TİŞÖRT > GÖMLEK.
 * 3) TÜRKÇE KÜÇÜLTME İNGİLİZCEYİ BOZAR. `trLower` her büyük "I"yı noktasız "ı" yapar —
 *    Türkçe için doğru ("IŞIK" → "ışık"), ama BÜYÜK HARFLE yazılmış İngilizce adlarda
 *    yıkıcı: "CARDIGAN" → "cardıgan", "BEANIE" → "beanıe", "ZIP-UP" → "zıp-up". Katalogda
 *    büyük harfli ve "I" içeren 1553 ürün adı var; hepsi sessizce DİĞER'e düşüyordu.
 *    Eskiden bu, kural listesine tek tek bozuk yazımlar eklenerek yamanıyordu ("hoodıe",
 *    "shırt", "sweatshırt" — hâlâ duruyorlar). Kök çözüm: her kural İKİ metne birden
 *    bakar (Türkçe küçültme + düz küçültme), biri tutarsa eşleşme sayılır. Bkz. `haystacks`.
 */

/** Türkçe'ye duyarlı küçültme. "İ" JS'te birleşik noktalı i'ye dönüşür; bazı siteler
 *  zaten ayrık noktayla (i + U+0307) yazıyor — ikisini de sadeleştiriyoruz. */
export function trLower(s: string): string {
  return String(s).replace(/İ/g, "i").replace(/I/g, "ı").replace(/̇/g, "").toLowerCase();
}

/**
 * Bir metnin iki küçük harfli hâli: Türkçe kurallı ve düz (İngilizce) — bkz. yukarıdaki
 * 3 numaralı tuzak. İkisi aynıysa tek metin döner, boşuna iki kez arama yapılmaz.
 */
function haystacks(s: string): string[] {
  const tr = trLower(s);
  // Birleşik nokta KÜÇÜLTMEDEN SONRA atılır: "İ".toLowerCase() tek karakteri "i"+U+0307'ye
  // açar, önce silmek bu noktayı yakalayamaz ve metin bozuk kalırdı.
  const en = String(s).toLowerCase().replace(/̇/g, "");
  const out = tr === en ? [tr] : [tr, en];

  // TİRENİN ETRAFINDAKİ BOŞLUK. Bazı mağazalar ürün adını "T - Shirt", "Zip - Up",
  // "Crew - Neck" diye yazıyor. Bu hâlde "t-shirt" kuralı tutmuyor ve ad GÖMLEK
  // kuralındaki "shirt"e düşüyordu — tişörtler gömlek kovasına gidiyordu. Boşluksuz
  // bir kopya daha üretiliyor; kurallar bu kopyada da deneniyor.
  for (const h of [...out]) {
    const tight = h.replace(/\s*[-–—]\s*/g, "-");
    if (tight !== h && !out.includes(tight)) out.push(tight);
  }
  return out;
}

const L = "a-zçğıöşü0-9";
/** Sözcük sınırlı eşleşme (Türkçe harfler dahil). */
const w = (...alts: string[]) => new RegExp(`(?<![${L}])(?:${alts.join("|")})(?![${L}])`, "i");
/** Serbest (içerik) eşleşme — ek almış hâlleri de yakalasın diye. */
const c = (...alts: string[]) => new RegExp(`(?:${alts.join("|")})`, "i");

const RULES: Array<[ProductCat, ...RegExp[]]> = [
  // "bot" serbest arama OLAMAZ (robot/botanik/sabotaj); ekli hâlleri tek tek yazılı.
  ["AYAKKABI", c("ayakkab", "sneaker", "makosen", "loafer", "çizme", "cizme", "terlik", "sandalet"), w("bot", "botu", "botlar", "botları", "boot", "boots", "shoe", "shoes", "yeezy", "postal", "postalı", "postallar")],
  ["SAAT", c("kol saati", "kol saatı"), w("saat", "saati", "watch")],

  // --- aksesuar ailesi: spesifik olanlar genel "AKSESUAR"dan önce
  ["ÇANTA", c("çanta", "canta", "backpack", "crossbody", "valiz", "bavul"), w("bag", "bags", "tote", "clutch", "shopper", "suitcase")],
  ["ŞAPKA", c("şapka", "sapka", "snapback", "trucker", "beanie", "bucket", "balaklava", "balaclava", "kasket"), w("cap", "bere", "hat", "hats")],
  // "çorabı/çorabın" ekli hâllerinde p → b yumuşuyor; "çorap" tek başına kaçırıyordu.
  ["ÇORAP", c("çorap", "çorab", "corap", "corab", "tozluk", "patik"), w("sock", "socks", "crews")],
  // İÇ GİYİM, ÇORAP'tan SONRA: "Külotlu Çorap" bir çoraptır, iç giyim değil. Ama
  // TAKIM'dan ÖNCE kalmalı — "pijama takımı" iç giyimdir.
  ["İÇ GİYİM", c("boxer", "külot", "kulot", "sütyen", "sutyen", "iç giyim", "ic giyim", "iç çamaşır", "ic camasir", "bikini", "mayo", "pijama", "gecelik", "jartiyer", "babydoll"), w("brief", "briefs", "thong")],
  // NOT: "lingerie" bilerek YOK — katalogda baskı yazısı olarak geçiyor
  // ("Buy Me Lingerie Oversize Tişört") ve dört tişörtü iç giyime taşıyordu.
  ["GÖZLÜK", c("gözlü", "gozlu", "sunglass", "eyewear"), w("glasses", "shades")],
  ["CÜZDAN", c("cüzdan", "cuzdan", "kartlık", "kartlik", "card holder", "cardholder"), w("wallet")],
  // "kemer" SERBEST ARANAMAZ: "kemerli pantolon/etek/trençkot" bir kemer değil, belinde
  // kemer olan giysidir (ölçüldü: 18 etek, 15 pantolon yanlış kovaya gitti).
  ["KEMER", c("harness", "kuşağı", "kusagi"), w("kemer", "kemeri", "kemerler", "kemerleri", "belt", "belts")],
  // "yüzüğü/yüzüğün"de k → ğ yumuşuyor. Yumuşamış gövde SERBEST aranmalı (`c`), sözcük
  // sınırlı değil: `w("yüzüğ")` ekin kendisine ("…ğü") takılıp asla eşleşmiyor.
  // "küpe" serbest aranır ("küpeler", "küpesi" ekli hâlleri sözcük sınırından kaçıyordu).
  // "earring"/"bilezik"/"hızma" SERBEST aranır: çoğul ve ekli hâlleri ("Earrings",
  // "Bilezikler", "hızması") sözcük sınırından kaçıyordu — katalogdaki DİĞER kovasında
  // ölçülen en kalabalık grup buydu.
  ["TAKI", c("kolye", "bileklik", "bilezik", "piercing", "choker", "halhal", "broş", "gerdanlık", "gerdanlik", "yüzüğ", "yuzug", "küpe", "kupe", "earring", "hızma", "hizma", "septum", "grillz"), w("yüzük", "yuzuk", "zincir", "zinciri", "chain", "takı", "necklace", "bracelet", "pendant", "ring", "rings")],
  ["ATKI / ELDİVEN", c("eldiven", "boyunluk", "bandana", "kolluk", "kol ısıtıcı", "kol isitici", "bacak ısıtıcı", "bacak isitici", "boyunbağı", "boyunbagi"), w("atkı", "atki", "glove", "gloves", "scarf", "şal", "buff")],
  ["AKSESUAR", c("aksesuar", "accessor", "anahtarl", "keychain", "rozet", "maske", "kılıf", "kilif", "poşet", "çakmak", "sticker", "poster", "kupa", "kravat", "papyon", "jartiyer", "duvar örtüsü", "saç band", "sac band", // "hediye seti"/"kırtasiye" burada, TAKIM'dan ÖNCE: yeni "set/seti" kuralı yoksa
  // bunları giysi takımı sanıyordu.
  "saç toka", "headband", "peruk", "kolluğu", "hediye seti", "kırtasiye", "kirtasiye"),
  // "patch" (yama/arma) SÖZCÜK SINIRLI olmalı: "Patchwork Jean", "Patchli T-Shirt"
  // giysidir, aksesuar değil — serbest arandığında 38 tişört aksesuar kovasına düştü.
  w("pin", "mug", "mask", "masks", "taç", "case", "toka", "tokası", "patch", "patchler", "patchleri")],

  // --- dış giyim
  ["MONT", c("parka", "puffer", "şişme", "sisme", "trençkot", "trench", "yağmurluk", "anorak", "polar"), w("mont", "montu", "coat", "kaban")],
  ["CEKET", c("ceket", "jacket", "bomber", "blazer", "varsity")],
  ["YELEK", c("yelek"), w("vest")],
  ["HIRKA", c("hırka", "hirka", "cardigan")],

  // --- elbise / etek / takım
  ["ELBİSE", c("elbise", "gelinlik", "tulum", "jumpsuit", "salopet"), w("dress")],
  ["ETEK", c("etekli"), w("etek", "eteği", "etegi", "skirt")],
  // "set/seti": aksesuar ailesi (sticker seti, kupa seti…) YUKARIDA yakalandığı için
  // buraya yalnız giysi setleri düşer.
  ["TAKIM", c("takımı", "takimi", "eşofman takım", "ikili takım", "full set", "pijama", "tracksuit"), w("takım", "takim", "suit", "set", "seti")],

  // --- üst giyim (sıra kritik, yukarıdaki nota bak)
  ["HOODIE", c("hoodie", "hoodıe", "hoddie", "kapüşonlu", "kapusonlu", "kapşonlu", "kapsonlu", "zip up", "zip-up", "full zip"), w("hood")],
  ["SWEATSHIRT", c("sweatshirt", "sweatshırt", "sweathirt", "swetshirt", "crewneck", "crew neck"), w("sweat", "sweati")],
  ["TRİKO / KAZAK", c("triko", "kazak", "süveter", "suveter", "sweater", "balıkçı", "boğazlı", "bogazli"), w("knit")],
  // "t shirt" SERBEST aranamaz: "slim fiT SHIRT" içinde eşleşip gömlekleri tişörte
  // gönderiyordu. Boşluklu yazım sözcük sınırlı olmak zorunda.
  // UZUN KOLLU, TİŞÖRT'ten ÖNCE: "UZUN KOLLU T-SHIRT" bir tişört değil, uzun kollunun
  // kendisidir — kategori zaten bunun için var. (Bu ürünler eskiden de UZUN KOLLU'ya
  // düşüyordu, ama yanlış sebeple: büyük harfli "T-SHIRT" hiç eşleşmiyordu. Sıra artık
  // niyeti açıkça yazıyor.)
  ["UZUN KOLLU", c("uzun kollu", "longsleeve", "long sleeve", "long-sleeve", "raglan kollu")],
  ["TİŞÖRT", c("tişört", "tisort", "tişort", "t-shirt", "tshirt"), w("t shirt", "tee", "tees")],
  ["POLO", w("polo")],
  ["FORMA", c("jersey", "maillot"), w("forma", "forması")],
  ["GÖMLEK", c("gömlek", "gömleğ", "gomlek", "frak"), w("shirt", "shırt", "shirts")],
  // "bra" burada, İÇ GİYİM'de değil: katalogdaki "…Spor Bra" ürünleri askılı/halter
  // üstler; İÇ GİYİM kuralı listede daha önce olduğu için oraya yazmak hepsini
  // iç giyime taşırdı.
  ["ATLET / KOLSUZ", c("kolsuz", "askılı", "askili", "bralet", "büstiyer", "bustiyer", "tank top", "sleeveless"), w("atlet", "atleti", "tank", "halter", "singlet", "bra")],
  ["KORSE / BODY", c("korse", "corset", "bodysuit", "bustier"), w("body")],
  ["BLUZ", c("bluz", "blouse", "crop top", "croptop", "kroptop", "pelerin", "kimono", "tunik", "tunic", "off shoulder", "off-shoulder", "düşük omuz")],

  // --- alt giyim
  ["JEAN", c("jean", "jeans", "jorts", "denim pantolon", "kot pantolon", "denım", "kot alt")],
  ["EŞOFMAN ALTI", c("eşofman", "esofman", "sweatpant", "jogger", "jogging", "track pant", "trackpant")],
  ["ŞORT", c("bermuda", "şortu", "sortu", "şortolon", "kapri", "capri"), w("şort", "sort", "short", "shorts")],
  ["TAYT", c("legging"), w("tayt", "taytı")],
  ["PANTOLON", c("pantolon", "kargo", "cargo", "baggy", "chino", "trouser", "şalvar", "salvar"), w("pant", "pants")],

  // --- geç kural: "kombin"
  // Void ve Zaee tamamlanmış bir kıyafeti tek ürün olarak satıyor ("KOMBİN 238") — bu
  // gerçekten bir takımdır. Ama "kombin" aynı zamanda SIFAT olarak da geçiyor ("Çift
  // Kombin Tişört" = eşli tişört, takım değil). Bu yüzden kural listenin SONUNDA:
  // adında gerçek bir parça tipi geçen ürün zaten yukarıda yakalanmış olur, buraya
  // yalnız adı "kombin"den ibaret olanlar düşer.
  ["TAKIM", w("kombin", "kombini", "kombinini")],

  // --- son çare: adı yalnızca "üst"/"top" diyen parçalar
  ["ÜST", c("üst giyim", "cropped"), w("üst", "üstü", "top", "tops", "crop", "croplu")],
];

/**
 * Verilen metinlerden (ad, kaynak kategorisi, etiketler…) ürün kategorisini bulur.
 * Hiçbir kural tutmazsa DİĞER döner — eskiden bilinmeyenler TİŞÖRT'e atılıyordu ve
 * o kategoriyi kirletiyordu.
 */
/**
 * İç giyim sözcüğü ÜRÜNÜN KENDİSİ değil, üstündeki baskı ya da bir detay olabiliyor:
 * "Bikini Lines Baskılı Tshirt", "Nakış İşlemeli Leopard Boxer Detay Baggy Eşofman".
 * Adda gerçek bir dış giysi tipi de geçiyorsa İÇ GİYİM kuralı atlanır ve sıra o giysinin
 * kendi kuralına geçer. ("pijama pantolon" bilerek dışarıda — o gerçekten iç giyimdir.)
 */
const OUTER_OVERRIDE =
  /tişört|tisort|tişort|t-shirt|tshirt|sweatshirt|sweatshırt|hoodie|hoodıe|eşofman|esofman|elbise|ceket|gömlek|gomlek|mont|hırka|hirka/i;

export function categorize(...parts: (string | null | undefined)[]): ProductCat {
  const hays = haystacks(parts.filter(Boolean).join(" "));
  for (const [cat, ...res] of RULES) {
    if (cat === "İÇ GİYİM" && hays.some((h) => OUTER_OVERRIDE.test(h))) continue;
    if (res.some((re) => hays.some((h) => re.test(h)))) return cat;
  }
  return "DİĞER";
}

/**
 * GİYİLEMEZ ürünler: bazı markalar aynı vitrinde tablo, perde, halı, havlu, kupa,
 * parfüm de satıyor. Burası bir giyim vitrini; bunlar katalogu kirletiyor.
 *
 * Kontrol YALNIZCA kategorisi DİĞER'e düşen ürünlere uygulanmalı — aksi hâlde
 * "Kanvas Çanta" (çanta), "Halı Desenli T-Shirt" (tişört) ve "Havlu Triko Polo"
 * (havlu kumaş) gibi tamamen geçerli ürünler elenir.
 */
const NON_WEARABLE =
  /tablo|kanvas tablo|perde|halı|havlusu|bardak|bardağ|kupa bardağ|mutfak|parfüm|yastık|nevresim|mum|mumluk|vazo|saksı|tepsi|masa örtü|abajur|duvar örtüsü|puzzle|oyuncak|defter|kalemlik|küllük|tesbih|poster|sticker|magnet|takvim|termos|matara|plaj örtü|pareo|banyo|bornoz|taşıma araba|lamba|aydınlatma|dekorasyon|lego|figür|figur|tasma|şemsiye|semsiye|takma tırnak|saç boyası|sac boyasi|boyası 8|runner örtü|kapı askısı|biblo|çerçeve|halı yıkama|kadeh|şarap kadehi|oje|kitap|kitap ayra|dekor|oda kokusu|el ısıtıcı|cep ısıtıcı|buhurdan|ayakkabı boyası|battaniye|şarj|sarj|adaptör|adaptor|kablo|ekran koruyucu|şerit led|serit led|led ışık|led isik|harita|bayrağ|bayrak|halı yıkama|duvar çıkartma|duvar cikartma|maket|puzzel/i;

export function isNonWearable(name: string, category: ProductCat): boolean {
  const s = trLower(name);
  // Yalnız DİĞER'e uygulanır (bkz. yukarıdaki not). İki metne birden bakmaya gerek yok:
  // buradaki sözcüklerin tamamı Türkçe ve küçük harf duyarlılığı sorun çıkarmıyor.
  return category === "DİĞER" && NON_WEARABLE.test(s);
}

/* ------------------------------------------------------ sneaker modelleri -- */

/**
 * SPOR AYAKKABI MODEL ADLARI — ayakkabıyı ADINDAN tanıyamadığımız durumun çaresi.
 *
 * Sorun: ayakkabı 2026-07-29'da vitrinden çıkarıldı (`ARCHIVE_CATS`) ve ayıklama
 * `category === "AYAKKABI"` etiketine bakıyor. Ama `RULES`teki AYAKKABI kuralı jenerik
 * sözcükler arıyor ("ayakkabı", "sneaker", "boot"); sneaker satan markalar ürünlerine
 * jenerik ad YAZMIYOR — "Nike Air Force 1", "SB Dunk Low ‘Panda’", "Adidas Samba OG",
 * "New Balance 9060". Bunlar DİĞER'e düşüyor, arşiv filtresinden kaçıyor ve vitrinde
 * "SINIFLANDIRILMAMIŞ" başlığı altında ayakkabı olarak görünüyorlardı (ölçüldü: tam
 * katalogda **34 ürün**, 8 markada).
 *
 * NEDEN SADECE MODEL ADI, beden değil: bedene bakmak cazip ("36,38,40,42" bir ayakkabı
 * olmalı) ama TÜRKİYE'DE KADIN KONFEKSİYON BEDENLERİ DE 34–46. Elbise, etek ve
 * pantolonun büyük kısmı aynı aralıkta. Beden tek başına sinyal sayılırsa vitrin
 * kadın giyimini ayakkabı sanıp arşive atardı. Model adı ise kesin.
 *
 * "jordan" TEK BAŞINA BURADA YOK ve olmamalı: katalogda 36 tişört, 29 şort, 10 hoodie,
 * 2 çorap adında "Jordan" geçiyor (NBA lisanslı giyim). Yalnız model numarasıyla
 * birlikte ("Jordan 1", "Air Jordan 4") ayakkabı sayılır.
 */
const SNEAKER_MODELS = [
  // Nike
  c("air ?force", "\\baf1\\b", "air ?max", "sb dunk", "dunk (low|high|mid)", "\\bdunk\\b",
    "air ?jordan\\s*\\d", "jordan\\s+\\d+\\s*(low|high|mid|retro)?", "blazer mid",
    "cortez", "\\bvomero\\b", "pegasus", "\\bp-?6000\\b", "\\btn\\b\\s*(plus)?"),
  // adidas
  c("\\bsamba\\b", "\\bgazelle\\b", "superstar", "stan smith", "campus\\s*(00s|80s)?",
    "forum (low|mid|high)", "\\bhandball spezial\\b", "\\bspezial\\b", "\\byeezy\\b",
    "\\bozweego\\b", "\\badizero\\b"),
  // New Balance — model numaraları
  c("new ?balance", "\\b(9060|2002r|1906r|1906a|530|550|327|574|990v?\\d?|991|992|993)\\b"),
  // Vans / Converse / diğer
  c("old ?skool", "knu ?skool", "sk8-?hi", "\\bauthentic\\b\\s*vans", "\\bvans\\b",
    "chuck taylor", "all ?star", "converse", "\\bone star\\b",
    "\\bgel-?(kayano|lyte|nyc|1130|1090)\\b", "\\basics\\b", "salomon\\s*(xt|acs)",
    "\\bmargiela tabi\\b", "\\btabi\\b"),
];

/**
 * Ürün adı bir spor ayakkabı MODELİ mi?
 *
 * `categorize()` DİĞER dönerse çağrılır (bkz. import-catalog). Ayrı bir fonksiyon
 * olmasının sebebi kural sırası: model adları `RULES`in en üstüne konsaydı
 * "Air Force Oversize Tişört" gibi baskı adları da ayakkabı olurdu. Burada yalnız
 * SINIFLANDIRILAMAYAN ürüne bakılıyor — yani adında tişört/şort/hoodie geçmeyen,
 * geriye kalan tek makul okuması ayakkabı olan ürünlere.
 */
export function looksLikeSneaker(name: string): boolean {
  const hays = haystacks(name);
  return SNEAKER_MODELS.some((re) => hays.some((h) => re.test(h)));
}
