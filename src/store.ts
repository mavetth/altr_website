"use client";
import { create } from "zustand";
import { CAT_GROUPS, type Product, type NavCat } from "@/lib/types";
import {
  DEFAULT_QUERY,
  defaultVariantIndex,
  stringifyQuery,
  toggleIn,
  type GenderKey,
  type QueryParams,
  type QueryResult,
} from "@/lib/query";
import { manualSeed } from "@/lib/discovery";
import type { StyleKey } from "@/lib/brand-styles";
import type { PublicUser } from "@/lib/account";
import {
  fetchPublicList,
  fetchPublicLists,
  publishList,
  readPublished,
  unpublishList,
  type PublicListView,
} from "@/lib/public-lists-client";
import {
  DEFAULT_LIST_NAME,
  MAX_LIST_ITEMS,
  emptyList,
  loadLists,
  saveLists,
  type ListsState,
  type ShareMode,
  type UserList,
} from "@/lib/lists";

export type Theme = "dark" | "light";
/**
 * "paylasilan": linkle gelen, başkasının listesi — salt okunur.
 * ADMİN panelleri artık burada DEĞİL: yönetim konsolu ayrı bir yol (/yonetim) ve
 *   kendi arayüzü var (bkz. components/admin/AdminConsole.tsx). Vitrin store'u yalnız
 *   adminde anlam taşıyan durumu taşımamalı.
 * "markalar" / "marka": marka rehberi ve tek marka sayfası. Bunlar ARTIK ayrı sayfa
 *   değil, vitrinin içindeki birer SEKME — kategori değiştirmek gibi. `/markalar` ve
 *   `/<slug>` yolları hâlâ duruyor (SEO, paylaşılan link, dışarıdan gelen ziyaretçi),
 *   ama uygulama içinden tıklandığında sayfa yeniden yüklenmez.
 */
export type View =
  | "grid"
  | "vitrin"
  | "paylasilan"
  | "markalar"
  | "marka";

/**
 * Izgaranın gösterim biçimi. Görsel boyutu ve satır düzeni buna bağlı; ürünün kendisi
 * (ProductCard) hepsinde aynı bileşen.
 *   izgara → 4 sütun, kare kart (varsayılan)
 *   buyuk  → 2 sütun, iri dikey görsel — vitrine bakar gibi
 *   sik    → 6 sütun, küçük kart — çok ürünü tek ekranda tara
 *   liste  → tek sütun, yatay satır: solda görsel, sağda bilgi
 */
export type Layout = "izgara" | "buyuk" | "sik" | "liste";
export const LAYOUTS: Array<{ k: Layout; label: string; title: string }> = [
  { k: "sik", label: "SIK", title: "sık ızgara — 6 sütun, küçük kart" },
  { k: "izgara", label: "IZGARA", title: "ızgara — 4 sütun (varsayılan)" },
  { k: "buyuk", label: "İRİ", title: "iri görsel — 2 sütun" },
  { k: "liste", label: "LİSTE", title: "liste — tek sütun, yatay satır" },
];

/** Linkle açılan liste (SSR'de çözülür, store'a olduğu gibi konur). */
export interface SharedList {
  name: string;
  items: Product[];
  /** Linkte istenen ama katalogda bulunamayan ürün sayısı (kaldırılmış/güncellenmiş). */
  missing: number;
  /** "liste" = ızgara ("şunlara bak"), "kombin" = tek kıyafet ("şöyle giyin"). */
  mode: ShareMode;
}

interface DetailCtx {
  items: Product[];
  pos: number;
  /** Modalda açık olan renk varyantının indeksi — karttan seçilen renkle açılır. */
  variant: number;
}

interface State {
  query: QueryParams;
  result: QueryResult | null;
  loading: boolean;
  view: View;

  filterOpen: boolean;
  modalBrand: string | null;
  modalTarget: string | null;
  /** Marka modalını açan ürün (varsa) — çıkış olayını zenginleştirmek için taşınır. */
  modalProduct: Product | null;
  going: boolean;
  detail: DetailCtx | null;

  /** Aktif listenin ürünleri — `lists`ten türetilir, bileşenler bunu okur. */
  showcase: Product[];
  lists: UserList[];
  activeListId: string;
  /** id → ürün. Listeler yalnız id tutar; kart çizmek için gövde burada durur. */
  listCache: Record<string, Product>;
  shared: SharedList | null;
  /**
   * VİTRİNİM içindeki sekme: kendi listelerim mi, herkese açık akış mı.
   * `View` seviyesine çıkarılmadı — ikisi de vitrinin içinde, sol menüdeki
   * VİTRİNİM girişi ikisini de kapsıyor.
   */
  vitrinTab: "listelerim" | "acik";
  /** Herkese açık akış (sunucudan gelir; boş dizi = daha yüklenmedi/boş). */
  publicLists: PublicListView[];
  publicSort: "yeni" | "populer";
  publicLoading: boolean;
  /** Açılan herkese açık liste — salt okunur görünüm. */
  openPublic: { list: PublicListView; items: Product[] } | null;
  /** VİTRİNİM'deki kategori blokları — varsayılan AÇIK (`!== false` ile okunur). */
  openCats: Record<string, boolean>;
  /**
   * Sol menüdeki çatı kategoriler (ÜST GİYİM / ALT GİYİM / …) — varsayılan KAPALI.
   * Anahtar yoksa CategoryNav "seçili kategoriyi içeren çatı açık" kuralını uygular,
   * bu yüzden burada `boolean | undefined` ayrımı anlamlı: undefined = "kullanıcı
   * dokunmadı", true/false = kullanıcının kararı.
   */
  openGroups: Record<string, boolean>;
  /** Sol bar açık mı — masaüstünde katlanabilir, tercih cihazda saklanır. */
  sidebarOpen: boolean;
  /** Izgaranın gösterim biçimi — tercih cihazda saklanır. */
  layout: Layout;
  /** "marka" sekmesinde açık olan markanın slug'ı. */
  markaSlug: string | null;
  toast: string | null;
  toastToken: string | null;
  /**
   * Oturumdaki kullanıcı. `null` = giriş yapılmamış, `undefined` yerine null çünkü
   * "henüz sorulmadı" durumu ayrıca `meLoaded` ile tutulmuyor — /api/auth/me ilk
   * boyamadan hemen sonra bir kez çağrılıyor ve gelene kadar düğme "GİRİŞ" gösteriyor.
   * Hesap ŞU AN hiçbir özelliğe bağlı değil (bkz. lib/auth.ts).
   */
  me: PublicUser | null;
  /** Google ile giriş yapılandırılmış mı — düğme buna göre çizilir. */
  googleAuth: boolean;
  authOpen: boolean;
  /** "Bize Ulaşın" modali — sağ alttaki sabit düğmeden açılır. */
  contactOpen: boolean;
  /**
   * Karşılama (misyon + dil) modali. Cihaz başına BİR KEZ kendiliğinden açılır
   * (bkz. IntroModal, localStorage `altr-giris`), sonra yalnız sol menüdeki MİSYON
   * girişinden çağrılır.
   */
  introOpen: boolean;
  /** Sol menüden mi açıldı — ilk karşılamada kapatma rozeti YOK, tek çıkış oktur. */
  introManual: boolean;
  showAllBrands: boolean;
  /** Marka çipleri bölümü (mobilde varsayılan kapalı, masaüstünde CSS her zaman açık gösterir). */
  brandsSectionOpen: boolean;
  /** Tarz çipleri bölümü — marka bölümüyle AYNI kural (bkz. brandsSectionOpen). */
  stylesSectionOpen: boolean;
  /** Görünüm/stok/sıralama kontrolleri — marka ve tarz şeritleriyle AYNI kural. */
  sortSectionOpen: boolean;
  theme: Theme;

  // actions
  init: (initial: QueryResult, theme: Theme, query: QueryParams, shared?: SharedList | null) => void;
  setQuery: (patch: Partial<QueryParams>, resetPage?: boolean) => void;
  /** Markayı seçime ekler/çıkarır (çoklu marka filtresi). */
  toggleBrand: (name: string) => void;
  /** Kadın/erkek seçimine ekler/çıkarır — ikisi aynı anda seçili olabilir. */
  toggleGender: (g: GenderKey) => void;
  /** Tarzı seçime ekler/çıkarır (çoklu; birden çoğu "veya" ile birleşir). */
  toggleStyle: (s: StyleKey) => void;
  setPage: (n: number) => void;
  refetch: () => Promise<void>;
  /** Keşfet akışını yeni bir tohumla baştan kurar — filtrelere dokunmaz. */
  reshuffleFeed: () => void;
  resetAll: () => void;

  setView: (v: View) => void;
  /** Marka rehberi sekmesi. */
  openMarkalar: () => void;
  /** Tek marka sekmesi — slug ile. */
  openMarka: (slug: string) => void;
  setLayout: (l: Layout) => void;
  openFilter: () => void;
  closeFilter: () => void;

  openBrandModal: (name: string, target?: string | null, product?: Product | null) => void;
  closeBrandModal: () => void;
  setGoing: (v: boolean) => void;

  openDetail: (items: Product[], pos: number, variant?: number) => void;
  closeDetail: () => void;
  detailNav: (d: number) => void;
  setDetailVariant: (i: number) => void;
  /** Ürün görüntülenme olayını yollar (admin istatistikleri için). */
  trackView: (p: Product | undefined) => void;

  /** Ürünü AKTİF listeye ekler/çıkarır. */
  toggleShowcase: (p: Product) => void;
  removeShowcase: (id: string) => void;
  /** Ürünü belirli bir listeye ekler/çıkarır (ürün modalindeki liste seçici). */
  toggleInList: (listId: string, p: Product) => void;
  createList: (name?: string) => string;
  renameList: (id: string, name: string) => void;
  deleteList: (id: string) => void;
  setActiveList: (id: string) => void;
  /** Linkle gelen listeyi kendi listelerime kopyalar. */
  importShared: () => void;
  /** Liste yazmalarının tek kapısı — state, localStorage ve `showcase` birlikte güncellenir. */
  commitLists: (lists: UserList[], activeId: string, cache: Record<string, Product>) => void;
  /** Oturum açıksa güncel listeleri/tercihleri hesaba yazar (geciktirilmiş). */
  pushSync: () => void;
  /** Sunucudan gelen listeleri cihazdakiyle birleştirip yerleştirir (çakışma sonrası). */
  adoptRemote: (remoteLists: UserList[], products: Product[]) => Promise<void>;
  /** Giriş anında bir kez: cihaz ↔ hesap birleştirmesi. */
  syncOnLogin: () => Promise<void>;
  setVitrinTab: (t: "listelerim" | "acik") => void;
  loadPublicLists: (sort?: "yeni" | "populer") => Promise<void>;
  publishActiveList: (nick: string) => Promise<void>;
  unpublishActiveList: () => Promise<void>;
  openPublicList: (id: string) => Promise<void>;
  closePublicList: () => void;
  toggleGroup: (cat: string) => void;
  /** Sol menüdeki çatı kategoriyi açar/kapatır. */
  toggleCatGroup: (key: string) => void;
  /** Sol barı katlar/açar (masaüstü). */
  toggleSidebar: () => void;

  /** /api/auth/me'yi çağırır — App açılışında bir kez. */
  loadMe: () => Promise<void>;
  setMe: (u: PublicUser | null) => void;
  openAuth: () => void;
  closeAuth: () => void;
  openContact: () => void;
  closeContact: () => void;
  /** `manual` = kullanıcı sol menüden çağırdı (ilk karşılama değil). */
  openIntro: (manual?: boolean) => void;
  closeIntro: () => void;

  showToast: (t: string) => void;
  toggleBrands: () => void;
  toggleBrandsSection: () => void;
  toggleStylesSection: () => void;
  toggleSortSection: () => void;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const THEME_KEY = "altr-theme";
const SIDEBAR_KEY = "altr-sidebar";
const LAYOUT_KEY = "altr-layout";
/** Sol menüde AÇIK bırakılan çatı kategoriler (ÜST GİYİM / ALT GİYİM / …). */
const CATGROUPS_KEY = "altr-cat-groups";

const isLayout = (v: unknown): v is Layout => LAYOUTS.some((l) => l.k === v);

/**
 * Cihazda saklanan açık çatılar. Barın katlanma tercihi, tema ve ızgara düzeni zaten
 * hatırlanıyordu; çatılar hatırlanmayınca ALT GİYİM'de gezinen kişi her sayfa
 * yenilemesinde aynı tıkları tekrarlıyordu.
 *
 * Okunan değer DOĞRULANIR: yalnız bilinen çatı anahtarları ve yalnız boolean değerler
 * geçer. Elle kurcalanmış ya da taksonomi değişince artık var olmayan bir anahtar
 * (örn. eski "ic" düzeni) sessizce düşer — bozuk bir kayıt menüyü kilitleyemez.
 */
function loadOpenGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CATGROUPS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, boolean> = {};
    for (const g of CAT_GROUPS) {
      const v = (parsed as Record<string, unknown>)[g.key];
      if (typeof v === "boolean") out[g.key] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Aktif listenin ürün gövdeleri — önbellekte olmayan id sessizce atlanır. */
function itemsOf(state: ListsState, cache: Record<string, Product>): Product[] {
  const list = state.lists.find((l) => l.id === state.activeId);
  if (!list) return [];
  const out: Product[] = [];
  for (const id of list.ids) {
    const p = cache[id];
    if (p) out.push(p);
  }
  return out;
}

/** Store'daki query değişikliğini URL'e yaz. Arama kutusu gibi sık tetiklenen (debounce'lu
 * da olsa) değişiklikler için push=false (replaceState) — her tuş vuruşu geçmişe girmesin.
 * Kategori/filtre/sayfa gibi bilinçli tıklamalar için push=true — geri tuşu bir önceki
 * filtre durumuna dönebilsin. */
function syncUrl(query: QueryParams, push: boolean) {
  if (typeof window === "undefined") return;
  // tohum bilerek yazılmaz: adres çubuğunda kullanıcıya bir şey ifade etmiyor ve
  // paylaşılan link, açan kişinin kendi keşfet penceresiyle gelsin.
  const qs = stringifyQuery(query);
  // Filtresiz durumda sorgu dizesi BOŞ: yalnız `?` bırakmak (eski hâl) adresi kirletiyor
  // ve "bir şey seçili" izlenimi veriyordu. Çıplak `/` doğru adres.
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  if (push) window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

let reqId = 0;

export const useStore = create<State>((set, get) => ({
  query: { ...DEFAULT_QUERY },
  result: null,
  loading: false,
  view: "grid",
  filterOpen: false,
  modalBrand: null,
  modalTarget: null,
  modalProduct: null,
  going: false,
  detail: null,
  showcase: [],
  lists: [],
  activeListId: "",
  listCache: {},
  shared: null,
  vitrinTab: "listelerim",
  publicLists: [],
  publicSort: "yeni",
  publicLoading: false,
  openPublic: null,
  openCats: {},
  openGroups: {},
  // SSR ile ilk boyama uyuşsun diye sabit true; cihazdaki tercih init()'te okunur.
  sidebarOpen: true,
  // Aynı sebeple sabit varsayılan: cihazdaki tercih init()'te okunur.
  layout: "izgara",
  markaSlug: null,
  toast: null,
  toastToken: null,
  me: null,
  googleAuth: false,
  authOpen: false,
  contactOpen: false,
  introOpen: false,
  introManual: false,
  showAllBrands: false,
  brandsSectionOpen: false,
  stylesSectionOpen: false,
  sortSectionOpen: false,
  theme: "dark",

  init: (initial, theme, query, shared = null) => {
    const { state, cache } = loadLists();
    // Sol barın katlanma tercihi: SSR'de okunamaz (localStorage yok), o yüzden ilk
    // boyamadan sonra burada alınır — açılışta bir kare "açık" görünüp katlanır.
    let sidebarOpen = true;
    let layout: Layout = "izgara";
    // Açık çatılar da aynı sebeple burada okunur (SSR'de localStorage yok).
    const openGroups = loadOpenGroups();
    try {
      sidebarOpen = localStorage.getItem(SIDEBAR_KEY) !== "0";
      const l = localStorage.getItem(LAYOUT_KEY);
      if (isLayout(l)) layout = l;
    } catch {
      /* yoksay */
    }
    set({
      sidebarOpen,
      layout,
      openGroups,
      result: initial,
      theme,
      // Sunucunun kullandığı tohumu benimse: oturum boyunca aynı keşfet akışı gelsin,
      // sayfa 2'ye geçince vitrin baştan karışmasın.
      query: { ...query, seed: query.seed || initial.seed },
      lists: state.lists,
      activeListId: state.activeId,
      listCache: cache,
      showcase: itemsOf(state, cache),
      shared,
      view: shared ? "paylasilan" : "grid",
    });
  },

  setQuery: (patch, resetPage = true) => {
    const query = { ...get().query, ...patch, ...(resetPage ? { page: 1 } : {}) };
    set({ query });
    // "q" (arama kutusu) hariç her değişiklik geçmişe bir adım eklesin — geri tuşu
    // bir önceki filtre/kategori durumuna dönebilsin.
    syncUrl(query, !("q" in patch));
    void get().refetch();
  },

  toggleBrand: (name) => get().setQuery({ brands: toggleIn(get().query.brands, name) }),
  toggleGender: (g) => get().setQuery({ genders: toggleIn(get().query.genders, g) }),
  toggleStyle: (s) => get().setQuery({ styles: toggleIn(get().query.styles, s) }),

  setPage: (n) => {
    const query = { ...get().query, page: n };
    set({ query });
    syncUrl(query, true);
    void get().refetch();
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
  },

  refetch: async () => {
    const my = ++reqId;
    set({ loading: true });
    try {
      const res = await fetch(`/api/products?${stringifyQuery(get().query, true)}`);
      const data = (await res.json()) as QueryResult;
      if (my === reqId) set({ result: data, loading: false });
    } catch {
      if (my === reqId) set({ loading: false });
    }
  },

  /**
   * KEŞFETİ YENİLE — tohumu değiştirir, başka hiçbir şeye dokunmaz.
   *
   * Tohum pencereye bağlı olduğu için (3 saat) sayfayı yenilemek vitrini
   * DEĞİŞTİRMİYORDU: aynı pencerede aynı akış geliyor, kullanıcı "site donmuş" sanıyor.
   * Bu düğme o pencereyi elle döndürür. Filtre/kategori/arama korunur — kullanıcı
   * "başka bir şey göster" diyor, "aramamı sil" demiyor.
   *
   * `resetAll`in tam tersi: o filtreleri siler tohumu korur, bu tohumu döndürür
   * filtreleri korur.
   *
   * Geçmişe adım EKLENMEZ (replaceState): geri tuşuyla dönülebilecek bir "önceki
   * karışım" yok, tohum URL'de taşınmıyor — geri basan kullanıcı hiç değişmemiş
   * görünen bir adrese dönüp şaşırırdı.
   */
  reshuffleFeed: () => {
    const query = { ...get().query, seed: manualSeed(), page: 1 };
    set({ query });
    syncUrl(query, false);
    void get().refetch();
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
    get().showToast("Keşfet yenilendi.");
  },

  resetAll: () => {
    // tohum korunur: "sıfırla" filtreleri temizler, vitrini baştan karıştırmaz
    const query = { ...DEFAULT_QUERY, seed: get().query.seed };
    set({ query, filterOpen: false, view: "grid" });
    syncUrl(query, true);
    void get().refetch();
  },

  setView: (v) => set({ view: v }),

  openMarkalar: () => {
    set({ view: "markalar", markaSlug: null });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
  },

  openMarka: (slug) => {
    set({ view: "marka", markaSlug: slug });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
  },

  setLayout: (l) => {
    set({ layout: l });
    try {
      localStorage.setItem(LAYOUT_KEY, l);
    } catch {
      /* yoksay */
    }
    get().pushSync();
  },

  openFilter: () => set({ filterOpen: true }),
  closeFilter: () => set({ filterOpen: false }),

  openBrandModal: (name, target = null, product = null) =>
    set({ modalBrand: name, modalTarget: target, modalProduct: product, going: false }),
  closeBrandModal: () => set({ modalBrand: null, modalTarget: null, modalProduct: null, going: false }),
  setGoing: (v) => set({ going: v }),

  openDetail: (items, pos, variant = 0) => {
    set({ detail: { items, pos, variant } });
    get().trackView(items[pos]);
  },
  closeDetail: () => set({ detail: null }),
  detailNav: (d) => {
    const det = get().detail;
    if (!det) return;
    const pos = Math.max(0, Math.min(det.items.length - 1, det.pos + d));
    if (pos === det.pos) return; // uçta: kayıt da yok, durum da değişmiyor
    // başka ürüne geçildi: renk seçimi o ürüne ait değil, o ürünün ilk STOKTAKİ rengine dön
    set({ detail: { ...det, pos, variant: defaultVariantIndex(det.items[pos]) } });
    get().trackView(det.items[pos]);
  },

  /**
   * Ürün görüntülenmesini sunucuya bildirir. Ölçüm store'da toplanıyor çünkü modal
   * dört ayrı yerden açılabiliyor (ızgara, vitrin, paylaşılan liste, marka sayfası)
   * ve bileşenlerin her birine ayrı ayrı takmak birini unutmak demekti.
   * İçe aktarma tembel: ölçüm kodu ilk boyamanın paketine girmesin.
   */
  trackView: (p) => {
    if (!p) return;
    const { cat, q } = get().query;
    void import("@/lib/track").then((m) => m.trackProductView(p, { cat, q })).catch(() => {});
  },
  setDetailVariant: (i) => {
    const det = get().detail;
    if (det) set({ detail: { ...det, variant: i } });
  },

  toggleShowcase: (p) => {
    const { activeListId } = get();
    const had = get().showcase.some((x) => x.id === p.id);
    get().toggleInList(activeListId, p);
    // Masaüstünde "Ürün Vitrinde." toast'ı gösterilir; mobilde (≤820px, sidebar üst
    // şeride dönüştüğünde) gösterilmez — orada VİTRİNİM uçuşu + yüzen reminder zaten
    // yeterli geri bildirim veriyor, toast fazlalık oluyordu.
    if (!had) {
      const isMobile =
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 820px)").matches;
      if (!isMobile) {
        const list = get().lists.find((l) => l.id === activeListId);
        get().showToast(`${list?.name ?? DEFAULT_LIST_NAME} listesine eklendi.`);
      }
    }
  },

  removeShowcase: (id) => {
    const p = get().listCache[id];
    if (p) get().toggleInList(get().activeListId, p);
  },

  toggleInList: (listId, p) => {
    const { lists, listCache } = get();
    let full = false;
    const next = lists.map((l) => {
      if (l.id !== listId) return l;
      const has = l.ids.includes(p.id);
      if (!has && l.ids.length >= MAX_LIST_ITEMS) {
        full = true;
        return l;
      }
      return {
        ...l,
        ids: has ? l.ids.filter((x) => x !== p.id) : [...l.ids, p.id],
        updatedAt: Date.now(),
      };
    });
    if (full) {
      get().showToast(`Liste dolu (${MAX_LIST_ITEMS} ürün).`);
      return;
    }
    const cache = { ...listCache, [p.id]: p };
    get().commitLists(next, get().activeListId, cache);
  },

  createList: (name) => {
    const list = emptyList(name?.trim() || `LİSTE ${get().lists.length + 1}`);
    get().commitLists([...get().lists, list], list.id, get().listCache);
    return list.id;
  },

  renameList: (id, name) => {
    const clean = name.trim().slice(0, 40);
    if (!clean) return;
    const next = get().lists.map((l) => (l.id === id ? { ...l, name: clean, updatedAt: Date.now() } : l));
    get().commitLists(next, get().activeListId, get().listCache);
  },

  deleteList: (id) => {
    const rest = get().lists.filter((l) => l.id !== id);
    // Son liste silinemez: uygulamanın her yerinde "aktif liste" var sayılıyor;
    // silmek yerine boşaltmak doğru davranış.
    const next = rest.length ? rest : [emptyList()];
    const active = next.some((l) => l.id === get().activeListId) ? get().activeListId : next[0].id;
    get().commitLists(next, active, get().listCache);
  },

  setActiveList: (id) => {
    if (!get().lists.some((l) => l.id === id)) return;
    get().commitLists(get().lists, id, get().listCache);
  },

  importShared: () => {
    const shared = get().shared;
    if (!shared) return;
    const list = emptyList(shared.name || DEFAULT_LIST_NAME);
    list.ids = shared.items.slice(0, MAX_LIST_ITEMS).map((p) => p.id);
    const cache = { ...get().listCache };
    for (const p of shared.items) cache[p.id] = p;
    get().commitLists([...get().lists, list], list.id, cache);
    set({ view: "vitrin" });
    // Liste artık kullanıcının kendisinde: adresteki `?liste=` düşsün, yoksa sayfa
    // yenilendiğinde yine başkasının salt okunur listesi açılıyordu.
    syncUrl(get().query, false);
    get().showToast("Liste kopyalandı.");
  },

  /**
   * Tek yazma noktası: state + localStorage + türetilmiş `showcase` birlikte güncellenir.
   * Oturum açıksa hesaba da yazılır (geciktirilmiş — bkz. lib/sync.ts).
   */
  commitLists: (lists, activeId, cache) => {
    const state: ListsState = { lists, activeId };
    saveLists(state, cache);
    set({ lists, activeListId: activeId, listCache: cache, showcase: itemsOf(state, cache) });
    get().pushSync();
  },

  /**
   * Hesap açıksa güncel hâli sunucuya yollar. Tek çıkış kapısı burası: liste yazmaları
   * `commitLists`ten, tercihler kendi setter'larından buraya uğrar.
   */
  pushSync: () => {
    if (!get().me || get().me?.needsNick) return;
    void import("@/lib/sync").then(({ schedulePush }) => {
      const s = get();
      schedulePush(
        {
          lists: s.lists,
          activeId: s.activeListId,
          published: readPublished(),
          prefs: { theme: s.theme, layout: s.layout, sidebar: s.sidebarOpen },
        },
        // Çakışma: başka bir cihaz/sekme araya girdi. Gelen hâli birleştirip yerleştir.
        (c) => void get().adoptRemote(c.data.lists as UserList[], c.products),
      );
    });
  },

  /** Sunucudan gelen listeleri cihazdakiyle birleştirip yerleştirir. */
  adoptRemote: async (remoteLists, products) => {
    const { mergeLists } = await import("@/lib/sync");
    const { lists } = mergeLists(remoteLists, get().lists);
    const cache = { ...get().listCache };
    for (const p of products) cache[p.id] = p;
    const activeId = lists.some((l) => l.id === get().activeListId)
      ? get().activeListId
      : (lists[0]?.id ?? "");
    const state: ListsState = { lists, activeId };
    saveLists(state, cache);
    set({ lists, activeListId: activeId, listCache: cache, showcase: itemsOf(state, cache) });
  },

  /**
   * Giriş anında bir kez: cihazdaki listeler hesaptakiyle BİRLEŞİR (hiçbir şey silinmez),
   * sonuç iki tarafa da yazılır. Tercihler de aynı turda taşınır.
   */
  syncOnLogin: async () => {
    const me = get().me;
    if (!me || me.needsNick) return;
    try {
      const { mergeOnLogin } = await import("@/lib/sync");
      const r = await mergeOnLogin(
        me.id,
        { lists: get().lists, activeId: get().activeListId },
        { theme: get().theme, layout: get().layout, sidebar: get().sidebarOpen },
        Date.now(),
      );
      if (!r) return;

      const cache = { ...get().listCache };
      for (const p of r.products) cache[p.id] = p;
      saveLists(r.state, cache);
      set({
        lists: r.state.lists,
        activeListId: r.state.activeId,
        listCache: cache,
        showcase: itemsOf(r.state, cache),
      });
      if (r.prefs.theme && r.prefs.theme !== get().theme) get().setTheme(r.prefs.theme);
      if (r.prefs.layout && r.prefs.layout !== get().layout) get().setLayout(r.prefs.layout);
      if (typeof r.prefs.sidebar === "boolean" && r.prefs.sidebar !== get().sidebarOpen) {
        get().toggleSidebar();
      }
    } catch {
      /* senkron başarısızsa vitrin cihazdaki veriyle çalışmaya devam eder */
    }
  },

  /* ------------------------------------------------ herkese açık listeler --- */

  setVitrinTab: (t) => {
    set({ vitrinTab: t });
    // Akış sekmesine ilk geçişte yüklensin; her geçişte ağa çıkmaya gerek yok.
    if (t === "acik" && !get().publicLists.length) void get().loadPublicLists();
  },

  loadPublicLists: async (sort) => {
    const s = sort ?? get().publicSort;
    set({ publicLoading: true, publicSort: s });
    const items = await fetchPublicLists(s);
    set({ publicLists: items, publicLoading: false });
  },

  /**
   * Aktif listeyi yayınlar (ya da yayındaysa günceller).
   *
   * Ürün gövdeleri sunucuya GİTMEZ — yalnız id'ler ve dört kapak görseli. Liste açan
   * kişi ürünleri kendi katalogundan çözer; böylece yayın, katalog güncellendikçe
   * kendiliğinden tazelenir.
   */
  publishActiveList: async (nick) => {
    const { lists, activeListId, showcase, showToast } = get();
    const list = lists.find((l) => l.id === activeListId);
    if (!list) return;
    if (!list.ids.length) {
      showToast("Boş liste yayınlanamaz.");
      return;
    }
    const r = await publishList(list, nick, showcase);
    if (!r.ok) {
      const msg: Record<string, string> = {
        nick: "Nick 3-20 karakter olmalı (harf, rakam, . _ -).",
        bos: "Boş liste yayınlanamaz.",
        dolu: "Yayın kotası dolu, sonra dene.",
        sahip: "Bu liste başka bir cihazdan yayınlanmış.",
        yok: "Yayın bulunamadı.",
        ag: "Bağlantı kurulamadı.",
      };
      showToast(msg[r.error] ?? "Yayınlanamadı.");
      return;
    }
    showToast("Liste herkese açık.");
    // Akış açıksa hemen görünsün.
    if (get().vitrinTab === "acik") void get().loadPublicLists();
  },

  unpublishActiveList: async () => {
    const { activeListId, showToast } = get();
    const ok = await unpublishList(activeListId);
    showToast(ok ? "Yayından kaldırıldı." : "Kaldırılamadı.");
    if (ok && get().vitrinTab === "acik") void get().loadPublicLists();
  },

  openPublicList: async (id) => {
    // Ürün gövdelerini sunucu çözüyor (istemcide katalog yok, listede yalnız id var).
    const r = await fetchPublicList(id);
    if (!r) {
      get().showToast("Liste bulunamadı.");
      return;
    }
    set({ openPublic: { list: r.list, items: r.items } });
  },

  closePublicList: () => set({ openPublic: null }),

  toggleGroup: (cat) => {
    const openCats = get().openCats;
    const isOpen = openCats[cat] !== false;
    set({ openCats: { ...openCats, [cat]: !isOpen } });
  },

  toggleCatGroup: (key) => {
    const openGroups = get().openGroups;
    // undefined = "kullanıcı dokunmadı" -> kapalı sayılır (bkz. state tanımı)
    const next = { ...openGroups, [key]: !openGroups[key] };
    set({ openGroups: next });
    // Cihazda saklanır (hesaba senkron edilmez: tercih ekrana/oturuma değil, o
    // taraycıdaki gezinme alışkanlığına ait — bkz. loadOpenGroups)
    try {
      localStorage.setItem(CATGROUPS_KEY, JSON.stringify(next));
    } catch {
      /* yoksay */
    }
  },

  toggleSidebar: () => {
    const next = !get().sidebarOpen;
    set({ sidebarOpen: next });
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
    } catch {
      /* yoksay */
    }
    get().pushSync();
  },

  loadMe: async () => {
    try {
      const { fetchMe } = await import("@/lib/account");
      const data = await fetchMe();
      set({ me: data.user, googleAuth: data.google });
      // Google dönüşünde nick henüz yoksa modalı doğrudan son adımda aç.
      if (data.user?.needsNick) set({ authOpen: true });
      // Oturum zaten açıkmış (çerez duruyor): cihazdaki veriyi hesapla eşitle.
      else if (data.user) void get().syncOnLogin();
    } catch {
      /* hesap katmanı vitrini bloklamaz */
    }
  },
  /**
   * Oturum değişimi. null→kullanıcı geçişinde senkron başlar; çıkışta senkron durur
   * ama CİHAZDAKİ VERİ SİLİNMEZ — çıkış yapmak listeyi kaybetmek değildir.
   */
  setMe: (u) => {
    const before = get().me;
    set({ me: u });
    if (u && !u.needsNick && before?.id !== u.id) void get().syncOnLogin();
    if (!u) void import("@/lib/sync").then(({ resetSync }) => resetSync());
  },
  openAuth: () => set({ authOpen: true }),
  closeAuth: () => set({ authOpen: false }),
  openContact: () => set({ contactOpen: true }),
  closeContact: () => set({ contactOpen: false }),
  openIntro: (manual = true) => set({ introOpen: true, introManual: manual }),
  closeIntro: () => set({ introOpen: false }),

  showToast: (t) => {
    // benzersiz işaret: aynı metin arka arkaya gelse de doğru toast'ı kapat
    const token = `${t} ${Date.now()}`;
    set({ toast: t, toastToken: token });
    setTimeout(() => {
      if (get().toastToken === token) set({ toast: null, toastToken: null });
    }, 1500);
  },

  toggleBrands: () => set({ showAllBrands: !get().showAllBrands }),
  toggleBrandsSection: () => set({ brandsSectionOpen: !get().brandsSectionOpen }),
  toggleStylesSection: () => set({ stylesSectionOpen: !get().stylesSectionOpen }),
  toggleSortSection: () => set({ sortSectionOpen: !get().sortSectionOpen }),

  setTheme: (t) => {
    set({ theme: t });
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", t);
      // sekmedeki favicon da temayla birlikte değişsin (bkz. layout.tsx #theme-favicon)
      const link = document.getElementById("theme-favicon");
      if (link) link.setAttribute("href", `/favicon-${t}.png`);
    }
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* yoksay */
    }
    get().pushSync();
  },
  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));

export type { QueryParams, QueryResult, NavCat };
