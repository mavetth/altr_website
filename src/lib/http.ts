// Zaman aşımlı, tarayıcı benzeri fetch. Marka siteleri bot'ları elemesin diye gerçekçi header.
export interface FetchOpts {
  timeoutMs?: number;
  revalidate?: number; // Next Data Cache TTL (Vercel)
  referer?: string;
  accept?: string;
  headers?: Record<string, string>;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export async function fetchWithTimeout(url: string, opts: FetchOpts = {}): Promise<Response> {
  const { timeoutMs = 5000, revalidate, referer, accept, headers } = opts;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Accept: accept ?? "text/html,application/json,*/*",
        "Accept-Language": "tr,en;q=0.8",
        ...(referer ? { Referer: referer, Origin: new URL(referer).origin } : {}),
        ...headers,
      },
      // Vercel'de Next Data Cache; verilmezse dinamik.
      ...(revalidate !== undefined ? { next: { revalidate } } : {}),
    } as RequestInit);
  } finally {
    clearTimeout(t);
  }
}
