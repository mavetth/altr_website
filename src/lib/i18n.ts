/**
 * DİL KATMANI — TR (varsayılan) / EN.
 *
 * Sözlük TÜRKÇE METNİN KENDİSİYLE anahtarlanır, ayrı bir anahtar uzayı yok:
 *
 *     t("VİTRİNİM")  ->  tr: "VİTRİNİM"   en: "MY RAIL"
 *
 * Sebebi bilinçli. Uygulamanın metni 30'dan fazla bileşene yayılmış durumda ve hepsini
 * `t("nav.vitrin")` gibi soyut anahtarlara çevirmek iki şeyi birden bozardı: Türkçe
 * kaynak kodda okunmaz hâle gelir (kim hangi ekranı yazdığını göremez) ve bir anahtar
 * atlandığında ekranda BOŞLUK ya da "nav.vitrin" çıkardı. Bu düzende atlanan bir metin
 * en kötü ihtimalle TÜRKÇE kalır — yani hiçbir zaman bozuk görünmez.
 *
 * KURAL: sözlükteki anahtar, koddaki dizeyle KARAKTERİ KARAKTERİNE aynı olmalı
 * (büyük/küçük harf, noktalama, üç nokta "…" dahil). Eşleşmezse Türkçe düşer.
 *
 * Kategori/tarz/renk gibi SORGU DEĞERLERİ çevrilmez — yalnız ekrandaki etiketleri
 * çevrilir. Yani `?kategori=TİŞÖRT` her iki dilde de aynı adres, çeviri yalnız
 * görüntü katmanında.
 */

export type Lang = "tr" | "en";

/** Cihazdaki tercih (istemci). */
export const LANG_KEY = "altr-lang";
/** Aynı tercihin sunucudan okunabilen hâli — ilk boyama doğru dilde çizilsin diye. */
export const LANG_COOKIE = "altr_dil";
/** Karşılama modalı bu cihazda gösterildi mi. */
export const INTRO_KEY = "altr-giris";

export const DEFAULT_LANG: Lang = "tr";

export function isLang(v: unknown): v is Lang {
  return v === "tr" || v === "en";
}

export function asLang(v: unknown): Lang {
  return isLang(v) ? v : DEFAULT_LANG;
}

/**
 * Sayı biçimi dile bağlı: 73.214 (tr) ↔ 73,214 (en). Kod içinde `toLocaleString("tr-TR")`
 * doğrudan çağrılmamalı — her ikisi de buradan geçsin.
 */
export function formatCount(n: number, lang: Lang): string {
  return n.toLocaleString(lang === "en" ? "en-US" : "tr-TR");
}

/**
 * Kalıplı çeviriler — sözlüğe tek tek yazılamayacak, içinde sayı/ad geçen metinler.
 * Sırayla denenir, ilk eşleşen kazanır.
 */
const PATTERNS: ReadonlyArray<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^(\d+) MARKA$/, (m) => `${m[1]} BRANDS`],
  [/^(\d+) BEDEN$/, (m) => `${m[1]} SIZES`],
  [/^(\d+) SEÇİLİ$/, (m) => `${m[1]} SELECTED`],
  [/^(\d+) PARÇA$/, (m) => `${m[1]} PIECES`],
  [/^(\d+) ÜRÜN$/, (m) => `${m[1]} PRODUCTS`],
  [/^(.+) listesine eklendi\.$/, (m) => `Added to ${m[1]}.`],
  [/^Liste dolu \((\d+) ürün\)\.$/, (m) => `List is full (${m[1]} items).`],
  [/^LİSTE (\d+)$/, (m) => `LIST ${m[1]}`],
  [/^Kod (\d+) karakter\.$/, (m) => `Code is ${m[1]} characters.`],
];

/**
 * TÜRKÇE → İNGİLİZCE. Anahtar = koddaki dizenin birebir kendisi.
 *
 * Ton: sitenin Türkçesi kısa, sert ve küçük harfli açıklamalar + BÜYÜK HARF düğmeler
 * kullanıyor; İngilizce karşılıkları da aynı ritimde tutuldu (uzun, kibar cümleler
 * tasarımı bozuyor — düğme metinleri kutulara sığmalı).
 */
export const EN: Record<string, string> = {
  /* ------------------------------------------ karşılama (misyon) modalı -- */
  "TÜRKİYE'NİN ALTERNATİF GİYİM VİTRİNİ": "TURKEY'S ALTERNATIVE CLOTHING RAIL",
  "CANLI": "LIVE",
  "SİTEYE DEVAM ET": "CONTINUE TO THE SITE",
  "altr — alternatif giyim vitrini": "altr — alternative clothing rail",
  "TEK VİTRİN": "ONE RAIL",
  "Bağımsız markalar akışın içinde kayboluyor. altr hepsini tek ekrana getirir; ürünler markanın kendi sitesinden gelir, arada kimse yok.":
    "Independent brands get lost in the feed. altr puts them all on one screen; the products come from each brand's own site, with nobody in between.",
  "SIRA SATILMAZ": "PLACEMENT ISN'T FOR SALE",
  "Vitrindeki yer satın alınamaz. Sıralamayı marka puanı ve ürün kalitesi kurar; en büyük katalog bile ekranı ele geçiremez.":
    "A spot on the rail can't be bought. The order comes from brand score and product quality; not even the largest catalogue can take over the screen.",
  "SENİN LİSTEN": "YOUR LIST",
  "Beğendiklerini listeye at, linkiyle paylaş. Hesap açmadan, hiçbir yere kaydolmadan.":
    "Drop what you like into a list and share the link. No account, no sign-up anywhere.",
  "misyonumuz · dil": "our mission · language",

  /* ------------------------------------------------------------- gezinme -- */
  "MENÜ": "MENU",
  "MARKALAR": "BRANDS",
  "VİTRİNİM": "MY RAIL",
  "MİSYON": "MISSION",
  "FİLTRE": "FILTER",
  "YÖNETİM": "ADMIN",
  "TÜM ÜRÜNLER": "ALL PRODUCTS",
  "hepsi bir arada": "all in one place",
  "alıcı gözüyle": "a buyer's eye",
  "marka": "brands",
  "parça": "pieces",
  "ÜRÜN": "PRODUCTS",
  "MARKA": "BRANDS",
  "TEK ÇATI ALTINDA": "UNDER ONE ROOF",
  "Sol menüyü katla": "Collapse the menu",
  "Sol menüyü aç": "Expand the menu",
  "Menüyü katla": "Collapse menu",
  "Menüyü aç": "Expand menu",
  "Vitrinim": "My rail",
  "GECE": "NIGHT",
  "GÜNDÜZ": "DAY",
  "Tema değiştir": "Switch theme",

  /* ------------------------------------------------------------ kategori -- */
  "TİŞÖRT": "T-SHIRT",
  "UZUN KOLLU": "LONG SLEEVE",
  "SWEATSHIRT": "SWEATSHIRT",
  "HOODIE": "HOODIE",
  "GÖMLEK": "SHIRT",
  "POLO": "POLO",
  "FORMA": "JERSEY",
  "ATLET / KOLSUZ": "TANK / SLEEVELESS",
  "BLUZ": "BLOUSE",
  "KORSE / BODY": "CORSET / BODYSUIT",
  "TRİKO / KAZAK": "KNITWEAR",
  "HIRKA": "CARDIGAN",
  "ÜST": "TOP",
  "PANTOLON": "TROUSERS",
  "JEAN": "JEANS",
  "EŞOFMAN ALTI": "SWEATPANTS",
  "ŞORT": "SHORTS",
  "TAYT": "LEGGINGS",
  "İÇ GİYİM": "UNDERWEAR",
  "CEKET": "JACKET",
  "MONT": "COAT",
  "YELEK": "VEST",
  "ELBİSE": "DRESS",
  "ETEK": "SKIRT",
  "TAKIM": "SET",
  "ÇANTA": "BAG",
  "ŞAPKA": "HAT",
  "ÇORAP": "SOCKS",
  "TAKI": "JEWELRY",
  "KEMER": "BELT",
  "GÖZLÜK": "EYEWEAR",
  "SAAT": "WATCH",
  "CÜZDAN": "WALLET",
  "ATKI / ELDİVEN": "SCARF / GLOVES",
  "AYAKKABI": "SHOES",
  "AKSESUAR": "ACCESSORIES",
  "DİĞER": "OTHER",

  /* çatı kategoriler (sol menü başlıkları) */
  "ÜST GİYİM": "TOPS",
  "ALT GİYİM": "BOTTOMS",
  "DIŞ GİYİM": "OUTERWEAR",
  "ELBİSE & TAKIM": "DRESSES & SETS",
  "SINIFLANDIRILMAMIŞ": "UNCLASSIFIED",

  /* ----------------------------------------------------------------- tarz -- */
  "MİNİMALİST": "MINIMALIST",
  "SPOR": "SPORT",
  "sokak, grafik, oversize": "street, graphic, oversize",
  "sade, günlük, temel parça": "plain, everyday, essentials",
  "teknik kumaş, işlevsel, karanlık": "technical fabric, functional, dark",
  "gece, kulüp, deneysel": "night, club, experimental",
  "aktif, performans, eşofman": "active, performance, sweats",
  "sakin lüks, gömlek, triko": "quiet luxury, shirts, knitwear",
  "sade kesim, düz renk, sakin palet": "clean cut, solid colour, calm palette",
  "2000'ler, baggy, parlak, rhinestone": "2000s, baggy, shiny, rhinestone",

  /* ----------------------------------------------------------------- renk -- */
  "SİYAH": "BLACK",
  "BEYAZ": "WHITE",
  "GRİ": "GREY",
  "BEJ / KREM": "BEIGE / CREAM",
  "KAHVE": "BROWN",
  "KIRMIZI": "RED",
  "BORDO": "BURGUNDY",
  "PEMBE": "PINK",
  "TURUNCU": "ORANGE",
  "SARI": "YELLOW",
  "YEŞİL": "GREEN",
  "MAVİ": "BLUE",
  "LACİVERT": "NAVY",
  "MOR": "PURPLE",
  "ÇOK RENKLİ": "MULTICOLOUR",

  /* -------------------------------------------------------------- cinsiyet -- */
  "KADIN": "WOMEN",
  "ERKEK": "MEN",
  "UNISEX": "UNISEX",
  "KARIŞIK": "EVERYONE",

  /* --------------------------------------------------------------- filtre -- */
  "Filtre": "Filter",
  "KAPAT ✕": "CLOSE ✕",
  "KAPAT": "CLOSE",
  "SEÇİLİ": "SELECTED",
  "kaldır": "remove",
  "KATEGORİ": "CATEGORY",
  "TARZ": "STYLE",
  "KİM İÇİN": "WHO FOR",
  "RENK": "COLOUR",
  "BEDEN": "SIZE",
  "FİYAT ARALIĞI": "PRICE RANGE",
  "SIRALAMA": "SORT",
  "STOK": "STOCK",
  "NUMARA": "NUMERIC",
  "JEAN (BEL)": "JEANS (WAIST)",
  "HEPSİ": "ALL",
  "tarz ürüne yazılıdır · yanındaki sayı o tarzdaki ürün adedi":
    "style is stored on the product · the number is how many products carry it",
  "ikisi birlikte seçilebilir · unisex ürünler her seçimde görünür":
    "both can be picked at once · unisex products show up either way",
  "birden fazla seçersen İKİSİNİ BİRDEN içeren ürünler gelir":
    "pick more than one and you get products carrying BOTH",
  "birden fazla seçersen herhangi birini üreten ürünler gelir":
    "pick more than one and you get products made in any of them",
  "bel ölçüsüne göre · boy (L) seçimini markanın sayfasında yaparsın":
    "by waist · pick the length (L) on the brand's own page",
  "▾ tek tek gizle": "▾ hide one by one",
  "▸ tek tek seç": "▸ pick one by one",
  "marka ara…": "search brands…",
  "eşleşen marka yok": "no matching brand",
  /* KEŞFET = vitrinin kendi akış sıralaması. İngilizcede "DISCOVER" değil "FEED":
     "discover" bir eylem gibi okunuyordu (bir yere götüren düğme), oysa bu bir
     SIRALAMA seçeneğinin adı — İngilizce uygulamalarda karşılığı "feed".
     Not: "VİTRİNİ KEŞFET →" bundan ayrı, orada keşfet gerçekten fiil (explore). */
  "KEŞFET": "FEED",
  "FİYAT": "PRICE",
  "TARİH": "DATE",
  "ARTAN": "LOW FIRST",
  "AZALAN": "HIGH FIRST",
  "ÖNCE YENİ": "NEWEST FIRST",
  "ÖNCE ESKİ": "OLDEST FIRST",
  "Yalnız stoktakiler": "In stock only",
  "TÜKENMİŞLER DE": "SOLD OUT TOO",
  "bu filtrelerle hiç ürün yok.": "no products match these filters.",
  "FİLTRESİNİ KALDIR": "FILTER — REMOVE",
  "↺ SIFIRLA": "↺ RESET",
  "{n} ÜRÜNÜ GÖSTER": "SHOW {n} PRODUCTS",
  "puana göre sıralı": "sorted by score",
  "kayıt": "records",
  "tekrar bas": "press again",
  "keşfet": "feed",

  /* ---------------------------------------------------------------- ızgara -- */
  "ARŞİVDEKİ MARKALAR": "BRANDS IN THE ARCHIVE",
  "Marka seçimini temizle": "Clear brand selection",
  "Tarz seçimini temizle": "Clear style selection",
  "− DAHA AZ": "− SHOW LESS",
  "DAHA": "MORE",
  "canlı": "live",
  "GÖRÜNÜM": "VIEW",
  "SIRALA": "SORT",
  "SIK": "DENSE",
  "IZGARA": "GRID",
  "İRİ": "LARGE",
  "LİSTE": "LIST",
  "sık ızgara — 6 sütun, küçük kart": "dense grid — 6 columns, small cards",
  "ızgara — 4 sütun (varsayılan)": "grid — 4 columns (default)",
  "iri görsel — 2 sütun": "large image — 2 columns",
  "liste — tek sütun, yatay satır": "list — one column, horizontal rows",
  "STOKTAKİLER": "IN STOCK",
  "TÜMÜ": "EVERYTHING",
  "yalnız stoktaki ürünler": "only products in stock",
  "tükenmişler dahil hepsi": "everything, sold out included",
  "altr'ın kendi keşfet sıralaması": "altr's own feed ordering",
  "keşfeti yenile — vitrini baştan karıştırır, filtreler korunur":
    "refresh the feed — reshuffles the rail, keeps your filters",
  "Keşfeti yenile": "Refresh feed",
  "KEŞFETİ YENİLE": "REFRESH FEED",
  "SIRALA & GÖRÜNÜM": "SORT & VIEW",
  "yükleniyor…": "loading…",
  "SONUÇ YOK": "NOTHING FOUND",
  "bu seçimde ürün yok — filtreyi gevşet": "nothing in this selection — loosen the filter",
  "✕ ARAMAYI BIRAK": "✕ DROP THE SEARCH",
  "↺ HEPSİNİ SIFIRLA": "↺ RESET EVERYTHING",
  "için sonuç yok": "returned nothing",
  "belki filtreler daraltıyor": "maybe the filters are narrowing it",

  /* ------------------------------------------------------------- ürün kartı -- */
  "Vitrinden çıkar": "Remove from my rail",
  "Vitrinime ekle": "Add to my rail",
  "ürüne tıkla": "tap the product",
  "STOKTA YOK": "SOLD OUT",
  "LİSTEYE EKLE": "ADD TO A LIST",
  "+ YENİ LİSTE": "+ NEW LIST",
  "ÜRÜNÜ SATIN AL →": "BUY THIS PRODUCT →",
  "yine de mağazaya git ↗": "go to the store anyway ↗",
  "[ GÖRSEL ]": "[ IMAGE ]",

  /* --------------------------------------------------------------- vitrin -- */
  "PARÇA": "PIECES",
  "LİSTELERİM": "MY LISTS",
  "HERKESE AÇIK": "PUBLIC",
  "burası senin köşen.": "this is your corner.",
  "alıcı gözüyle bakıyoruz": "we look with a buyer's eye",
  "— beğendiğin parçaları kategorilere göre büyük büyük, sakince süzmek için buraya ayırdın. beden yok, gürültü yok; sadece parça, fiyat ve renk. birden çok liste tutabilir, herhangi birini linkle paylaşabilir ya da herkese açabilirsin.":
    "— the pieces you liked, kept here by category, big and calm. no sizes, no noise; just the piece, the price and the colour. keep several lists, share any of them with a link, or make one public.",
  "vitrin boş": "the rail is empty",
  "ürün görselinin sağ üst köşesindeki askı düğmesine bas — beğendiklerin burada birikir.":
    "tap the hanger button in the top right of a product image — everything you like collects here.",

  /* ------------------------------------------------------------ liste şeridi -- */
  "KAYDET": "SAVE",
  "✎ ADI DEĞİŞTİR": "✎ RENAME",
  "⇗ LİSTEYİ PAYLAŞ": "⇗ SHARE THE LIST",
  "⊞ KOMBİN YAP": "⊞ BUILD AN OUTFIT",
  "YAYINDAN KALDIR? ✕": "UNPUBLISH? ✕",
  "🌐 YAYINDA": "🌐 PUBLISHED",
  "🌐 HERKESE AÇ": "🌐 MAKE PUBLIC",
  "EMİN MİSİN? ✕": "ARE YOU SURE? ✕",
  "✕ LİSTEYİ SİL": "✕ DELETE THE LIST",
  "liste adı": "list name",
  "YAYINLA": "PUBLISH",
  "VAZGEÇ": "CANCEL",
  "nick": "nickname",
  "nick (harf, rakam, . _ -)": "nickname (letters, digits, . _ -)",
  "link listenin kendisini taşır — karşı tarafın hesabı olması gerekmez. sonradan eklediğin ürünler bu linke YANSIMAZ, yeniden paylaş.":
    "the link carries the list itself — the other side needs no account. products you add later DO NOT appear in this link, share it again.",
  "hesap gerekmiyor — nick yalnız listenin altına yazılır. yayınlanan liste HERKESE AÇIK sekmesinde görünür; istediğin an kaldırabilirsin. listeyi düzenlersen yayın da güncellenir.":
    "no account needed — the nickname is only printed under the list. a published list shows up in the PUBLIC tab; you can pull it back any time. edit the list and the publication follows.",

  /* ------------------------------------------------------ ürün / mağaza -- */
  "[ ÜRÜN GÖRSELİ ]": "[ PRODUCT IMAGE ]",
  "renk": "colour",
  "ARA": "SEARCH",
  "aramayı temizle": "clear the search",
  "TEMİZLE ✕": "CLEAR ✕",
  "VİTRİN": "RAIL",
  "GİRİŞ": "SIGN IN",
  "Hesabım": "My account",
  "Giriş yap veya hesap aç": "Sign in or create an account",
  "yıldız": "stars",
  "BİZE ULAŞIN": "CONTACT US",
  "öneri, geri bildirim, marka önerisi veya kaldırma talebi":
    "a suggestion, feedback, a brand tip or a removal request",
  "İSTEDİN": "REQUESTED",
  "STOĞA GELSİN": "RESTOCK THIS",
  "Bu ürünü stoğa istedin — geri almak için tekrar bas":
    "You asked for this to be restocked — press again to undo",
  "Stoğa gelmesini iste; talep markaya iletilir":
    "Ask for a restock; the request goes to the brand",
  "Talebin kaydedildi.": "Your request was recorded.",
  "Talebin geri alındı.": "Your request was withdrawn.",
  "Talep gönderilemedi.": "The request couldn't be sent.",
  "MAĞAZAYA GİT ↗": "GO TO THE STORE ↗",
  "bu sayfada ürün yok.": "no products on this page.",

  /* --------------------------------------------------- çıkış (GoModal) -- */
  "BAĞLANTI KURULUYOR…": "CONNECTING…",
  "HARİCİ ÜRÜN SAYFASI": "EXTERNAL PRODUCT PAGE",
  "HARİCİ MAĞAZA": "EXTERNAL STORE",
  "MAĞAZA BAĞLI DEĞİL": "NO STORE LINKED",
  "ürün sayfasına gidiliyor": "product page — going there now",
  "mağazasına gidiliyor": "store — going there now",
  /* çıkış ekranı (ExitScreen) */
  "seni şuraya götürüyoruz": "now taking you to",
  "uzun mu sürüyor? hemen aç": "taking too long? open it now",
  "altr.com seni ürünün markadaki kendi sayfasına yönlendiriyor":
    "altr.com is sending you to the product's own page at the brand",
  "altr.com seni bu markanın kendi mağazasına yönlendiriyor":
    "altr.com is sending you to this brand's own store",
  "bu marka için henüz canlı kaynak tanımlı değil":
    "no live source is defined for this brand yet",
  "yeni sekmede açılır — altr açık kalır": "opens in a new tab — altr stays open",
  "markanın altr sayfası →": "the brand's altr page →",
  "KAYDIR": "SLIDE",
  "ÜRÜNE GİT": "GO TO PRODUCT",
  "MAĞAZAYA GİT": "GO TO STORE",
  "Bu markanın bağlı mağazası yok.": "This brand has no linked store.",

  /* ------------------------------------------------------ marka sayfası -- */
  "Markalar": "Brands",
  "vitrindeki": "all",
  "markanın tamamı, alfabetik. toplam": "brands on the rail, alphabetical. that's",
  "parça. bir markaya bas, kendi sayfasına git.":
    "pieces in total. tap a brand to open its own page.",
  /* "PARÇA" yukarıda, vitrin bölümünde tanımlı */
  "STOKTA": "IN STOCK",
  "MEDYAN FİYAT": "MEDIAN PRICE",
  "ARALIK": "RANGE",
  "VİTRİNDE FİLTRELE →": "FILTER ON THE RAIL →",
  "MAĞAZANIN SUNDUKLARI": "WHAT THE STORE OFFERS",
  "markanın kendi sitesindeki duyurudan alındı; koşulları mağazada geçerli olan belirler.":
    "taken from the brand's own announcement; the store's own terms are what count.",
  "KARGO": "SHIPPING",
  "HIZLI GÖNDERİM": "FAST DISPATCH",
  "TAKSİT": "INSTALMENTS",
  "KAPIDA ÖDEME": "CASH ON DELIVERY",
  "İADE": "RETURNS",
  "İNDİRİM": "DISCOUNT",
  "marka listesi alınamadı.": "couldn't load the brand list.",
  "bu marka vitrinde bulunamadı.": "this brand isn't on the rail.",
  "altr — alternatif giyim vitrini. ürünler markaların kendi sitelerinde satılır; satın alma markanın sayfasında tamamlanır.":
    "altr — alternative clothing rail. products are sold on the brands' own sites; the purchase is completed on the brand's page.",

  /* -------------------------------------------------- paylaşılan liste -- */
  "PAYLAŞILAN KOMBİN": "SHARED OUTFIT",
  "PAYLAŞILAN LİSTE": "SHARED LIST",
  "biri sana bu kombini gönderdi — her kategoriden bir parça, üstten alta bir kıyafet. hesap gerekmiyor; beğendiğin parçayı tek tek alabilir ya da kombinin tamamını kendi listelerine kopyalayabilirsin.":
    "someone sent you this outfit — one piece per category, head to toe. no account needed; take single pieces you like, or copy the whole outfit into your own lists.",
  "biri sana bu listeyi gönderdi. hesap gerekmiyor — istersen olduğu gibi kendi listelerine kopyala, istersen tek tek beğendiklerini askı düğmesiyle al.":
    "someone sent you this list. no account needed — copy it wholesale into your own lists, or pick out single pieces with the hanger button.",
  "ürün artık katalogda yok, listeden düştü.":
    "products are no longer in the catalogue and dropped out of the list.",
  "KOMBİNİ KENDİME KOPYALA": "COPY THE OUTFIT TO MY LISTS",
  "LİSTEYİ KENDİME KOPYALA": "COPY THE LIST TO MY LISTS",
  "VİTRİNİ KEŞFET →": "EXPLORE THE RAIL →",
  "kombin boş": "the outfit is empty",
  "liste boş": "the list is empty",
  "linkteki ürünler katalogda bulunamadı — kaldırılmış olabilirler.":
    "the products in this link aren't in the catalogue — they may have been removed.",
  "ürün artık satışta değil": "products are no longer for sale",
  "Kendi listeme ekle": "Add to my own list",
  "bu listedeki ürünler artık satışta değil":
    "the products in this list are no longer for sale",

  /* ----------------------------------------------------------- kombin -- */
  "KOMBİN KUR": "BUILD AN OUTFIT",
  "VAZGEÇ ✕": "CANCEL ✕",
  "her kategoriden bir parça seç — üstten alta bir kıyafet çıksın. seçmediğin kategori kombine girmez. link karşı tarafa kombini olduğu gibi taşır, hesap gerekmez.":
    "pick one piece per category — head to toe. categories you skip stay out. the link carries the whole outfit; the other side needs no account.",
  "listende parça yok — önce birkaç ürün ekle.":
    "nothing in your list yet — add a few products first.",
  "toplam": "total",
  "bazı parçaların fiyatı yok — toplam verilmedi":
    "some pieces have no price — no total shown",
  "kombin adı": "outfit name",
  "⇗ KOMBİNİ PAYLAŞ": "⇗ SHARE THE OUTFIT",
  "Önce en az bir parça seç.": "Pick at least one piece first.",
  "Kombin linki kopyalandı.": "Outfit link copied.",

  /* --------------------------------------------- herkese açık listeler -- */
  "GÖRSEL YOK": "NO IMAGE",
  "bakış": "views",
  "SENİN": "YOURS",
  "YENİ": "NEW",
  "POPÜLER": "POPULAR",
  "henüz kimse yayınlamadı": "nobody has published yet",
  "kendi listeni kur, LİSTELERİM sekmesinden “herkese aç” de — ilk sen ol.":
    "build your own list, then hit “make public” in MY LISTS — be the first.",

  /* --------------------------------------------------------- yorumlar -- */
  "YORUMLAR": "REVIEWS",
  "yorum": "reviews",
  "henüz yorum yok — ilk sen yaz": "no reviews yet — be the first",
  "YORUMUNU DÜZENLE": "EDIT YOUR REVIEW",
  "YORUM YAZ": "WRITE A REVIEW",
  "PUANIN": "YOUR RATING",
  "nick (3-20 karakter)": "nickname (3-20 characters)",
  "kalıbı nasıl? kumaş? kargo? — yazmasan da olur, puan yeter":
    "how's the fit? the fabric? shipping? — text is optional, the rating is enough",
  "SİL": "DELETE",
  "GÜNCELLE": "UPDATE",
  "GÖNDER": "SEND",
  "sen": "you",
  "Yorumun güncellendi.": "Your review was updated.",
  "Yorumun eklendi.": "Your review was added.",
  "Yorum silinemedi.": "The review couldn't be deleted.",
  "Yorumun silindi.": "Your review was deleted.",
  "Önce bir puan seç (1–5 yıldız).": "Pick a rating first (1–5 stars).",
  "Bu üründe yorum kotası dolu.": "The review quota for this product is full.",
  "Ürün bulunamadı.": "Product not found.",
  "Tarayıcı kimliği alınamadı.": "Couldn't get a browser identity.",
  "Yorum gönderilemedi.": "The review couldn't be sent.",

  /* ------------------------------------------------------------ hesap -- */
  "HESABIM": "MY ACCOUNT",
  "SON ADIM": "LAST STEP",
  "ÜYE": "MEMBER",
  "İŞLETME": "BUSINESS",
  "BİREYSEL": "PERSONAL",
  "listelerin ve görünüm tercihlerin bu hesapta duruyor — başka bir cihazdan girdiğinde seni bekliyor olacaklar. çıkış yaparsan bu cihazdaki kopya silinmez.":
    "your lists and display preferences live on this account — sign in from another device and they'll be waiting. signing out does not delete the copy on this device.",
  "ÇIKIŞ YAP": "SIGN OUT",
  "adresini yaz,": "type your address and we'll send you a",
  "6 haneli bir kod": "6-digit code",
  "gönderelim. parola yok. hesabın yoksa kodla birlikte açılır.":
    "— no password. if you have no account, the code creates one.",
  "HESAP TÜRÜ": "ACCOUNT TYPE",
  "E-POSTA": "E-MAIL",
  "Beni hatırla": "Remember me",
  "GÖNDERİLİYOR…": "SENDING…",
  "KOD GÖNDER": "SEND THE CODE",
  "VEYA": "OR",
  "GOOGLE İLE DEVAM ET": "CONTINUE WITH GOOGLE",
  "adresine 6 haneli bir kod gönderildi. 10 dakika geçerli.":
    "— a 6-digit code has been sent there. valid for 10 minutes.",
  "e-posta sağlayıcısı bağlı değil — kod:": "no e-mail provider connected — code:",
  "KOD": "CODE",
  "KONTROL EDİLİYOR…": "CHECKING…",
  "GİRİŞ YAP": "SIGN IN",
  "← ADRESİ DEĞİŞTİR": "← CHANGE ADDRESS",
  "YENİ KOD": "NEW CODE",
  "parola ile giriş": "sign in with a password",
  "PAROLA": "PASSWORD",
  "← GERİ": "← BACK",
  "kendine bir": "pick yourself a",
  "seç. hesabın için gereken tek şey bu — başka bilgi istemiyoruz.":
    "— that's all your account needs, we don't ask for anything else.",
  "NİCK": "NICKNAME",
  "ör. kuytu": "e.g. kuytu",
  "2–24 karakter · harf, rakam, . _ -": "2–24 characters · letters, digits, . _ -",
  "KAYDEDİLİYOR…": "SAVING…",
  "BİTİR": "FINISH",
  "Hoş geldin.": "Welcome.",
  "Çıkış yapıldı.": "Signed out.",
  "Bir şeyler ters gitti.": "Something went wrong.",
  "İşlem başarısız.": "That didn't work.",

  /* --------------------------------------------------------- iletişim -- */
  "ALDIK": "GOT IT",
  "Bize Ulaşın": "Contact Us",
  "mesajın bize ulaştı.": "your message reached us.",
  "gerekirse bu adresten dönüş yaparız.": "we'll reply to that address if needed.",
  "adres bırakmadın, dönüş yapamayız ama okuyacağız.":
    "you left no address, so we can't reply — but we will read it.",
  "kaldırma taleplerine öncelik veriyoruz.": "we prioritise removal requests.",
  "her mesaj tek tek okunuyor.": "every message is read one by one.",
  "BİR ŞEY DAHA YAZ": "WRITE SOMETHING ELSE",
  "MARKA ÖNER": "SUGGEST A BRAND",
  "GERİ BİLDİRİM": "FEEDBACK",
  "MARKA KALDIRMA": "BRAND REMOVAL",
  "bildiğin harika bir alternatif giyim işletmesi mi var? bize öner, listemize eklemek için değerlendirelim. küçük, yeni, az bilinen markalar tam olarak aradığımız şey.":
    "know a great alternative clothing label? tell us and we'll consider adding it. small, new, little-known brands are exactly what we're after.",
  "tam olarak neyin daha iyi olabileceğini açıkça belirt: hangi ekrandaydın, ne yaptın, ne bekliyordun, ne oldu. “güzel olmuş” değil, tek bir somut şey — en çok işimize yarayan şey o.":
    "be specific about what could be better: which screen you were on, what you did, what you expected, what happened. not “looks nice” — one concrete thing is what helps most.",
  "bir işletmenin sahibi veya yetkilisiysen ve ürünlerinin burada gözükmesini istemiyorsan buradan iletişim kurabilirsin. talebi doğrulayıp markayı vitrinden çıkarıyoruz.":
    "if you own or represent a business and don't want your products shown here, get in touch. we verify the request and take the brand off the rail.",
  "yukarıdakilerden hiçbiri değilse buradan yaz — iş birliği, hata, hukuki konu, ne olursa.":
    "if it's none of the above, write here — a partnership, a bug, a legal matter, whatever it is.",
  "MARKA ADI": "BRAND NAME",
  "NE OLDU / NE OLMALI": "WHAT HAPPENED / WHAT SHOULD",
  "TALEBİN": "YOUR REQUEST",
  "MESAJIN": "YOUR MESSAGE",
  "ör. filtrede beden seçince sayfa başa dönüyor, seçtiğim yer kayboluyor":
    "e.g. picking a size in the filter jumps the page back to the top and I lose my place",
  "markayla ilişkin ve talebin — doğrulayabilmemiz için":
    "your relationship to the brand and your request — so we can verify it",
  "yaz": "write",
  "opsiyonel": "optional",
  "EKLER": "ATTACHMENTS",
  "+ FOTOĞRAF · VİDEO · PDF EKLE": "+ ADD A PHOTO · VIDEO · PDF",
  "en fazla": "at most",
  "dosya": "files",
  "çok büyük (en fazla": "is too big (max",
  "desteklenmiyor (fotoğraf, video veya PDF)": "isn't supported (photo, video or PDF)",
  "işletmenin adı": "the name of the business",
  "ör. kuytu atölye": "e.g. kuytu atölye",
  "SİTE / INSTAGRAM": "SITE / INSTAGRAM",
  "instagram.com/… veya site adresi": "instagram.com/… or a website",
  "E-POSTA (kurumsal adres tercih edilir)": "E-MAIL (a company address is preferred)",
  "dönüş yapabilmemiz için": "so we can get back to you",
  "hesap gerekmez · adres bırakmazsan da okuruz, sadece dönüş yapamayız":
    "no account needed · we'll read it even without an address, we just can't reply",
  "Aldık, teşekkürler.": "Got it, thanks.",
  "Gönderilemedi.": "Couldn't send.",

  /* ------------------------------------------------------------ bildirimler -- */
  "Keşfet yenilendi.": "Feed refreshed.",
  "Liste kopyalandı.": "List copied.",
  "Boş liste yayınlanamaz.": "An empty list can't be published.",
  "Boş liste paylaşılmaz.": "An empty list can't be shared.",
  "Link kopyalandı.": "Link copied.",
  "Linki elle kopyala.": "Copy the link by hand.",
  "Nick 3-20 karakter olmalı (harf, rakam, . _ -).":
    "Nickname must be 3-20 characters (letters, digits, . _ -).",
  "Yayın kotası dolu, sonra dene.": "Publishing quota is full, try later.",
  "Bu liste başka bir cihazdan yayınlanmış.": "This list was published from another device.",
  "Yayın bulunamadı.": "Publication not found.",
  "Bağlantı kurulamadı.": "Couldn't connect.",
  "Yayınlanamadı.": "Couldn't publish.",
  "Liste herkese açık.": "The list is public.",
  "Yayından kaldırıldı.": "Pulled from publication.",
  "Kaldırılamadı.": "Couldn't pull it back.",
  "Liste bulunamadı.": "List not found.",
  "Giriş yapıldı.": "Signed in.",
  "Son adım: kendine bir nick seç.": "Last step: pick yourself a nickname.",
  "Google girişi iptal edildi.": "Google sign-in cancelled.",
  "Google girişi doğrulanamadı.": "Google sign-in couldn't be verified.",
  "Google hesabının e-postası doğrulanmamış.": "Your Google account's e-mail isn't verified.",
  "Google ile giriş bu kurulumda açık değil.": "Google sign-in isn't enabled in this setup.",
  "Giriş tamamlanamadı.": "Sign-in couldn't be completed.",
};

/** Kalıp + sözlük. Bulunamayan metin OLDUĞU GİBİ döner (Türkçe kalır). */
export function translate(lang: Lang, text: string): string {
  if (lang !== "en") return text;
  const hit = EN[text];
  if (hit !== undefined) return hit;
  for (const [re, fn] of PATTERNS) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return text;
}
