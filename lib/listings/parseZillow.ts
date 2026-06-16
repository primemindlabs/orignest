/**
 * Zillow listing parser. Zillow has no public API and aggressively bot-blocks
 * scrapers, so we extract from the listing HTML using two strategies in order:
 *
 *   1. JSON-LD (schema.org) — Zillow embeds <script type="application/ld+json">
 *      blocks for SEO. This is machine-readable by design and far more stable
 *      than internal app state, so we try it first.
 *   2. __NEXT_DATA__ gdpClientCache — Zillow's internal Next.js payload. Richer
 *      (full photo gallery, MLS #) but its shape changes without notice.
 *
 * Fields are merged across strategies: JSON-LD usually has address/beds/baths,
 * __NEXT_DATA__ usually has the full photo array — take the best of each.
 */

export interface ParsedListing {
  address_line1: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  list_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  year_built: number | null;
  description: string;
  mls_number: string;
  photo_urls: string[];
  primary_photo_url: string | null;
  zillow_url: string;
  zillow_zpid: string | null;
  source: 'zillow_url';
}

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

function emptyListing(url: string): ParsedListing {
  return {
    address_line1: '', address_city: '', address_state: '', address_zip: '',
    list_price: null, bedrooms: null, bathrooms: null, sqft: null, year_built: null,
    description: '', mls_number: '', photo_urls: [], primary_photo_url: null,
    zillow_url: url, zillow_zpid: null, source: 'zillow_url',
  };
}

/** True when the listing has enough to be useful (at minimum a street address). */
export function isUsableListing(l: ParsedListing): boolean {
  return !!l.address_line1 || l.photo_urls.length > 0;
}

// ── Strategy 1: JSON-LD ──────────────────────────────────────────────────────
function fromJsonLd(html: string, out: ParsedListing): void {
  const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    let node: any;
    try { node = JSON.parse(b[1].trim()); } catch { continue; }
    const candidates: any[] = Array.isArray(node) ? node : node?.['@graph'] ? node['@graph'] : [node];
    for (const c of candidates) {
      if (!c || typeof c !== 'object') continue;
      const addr = c.address;
      if (addr && typeof addr === 'object') {
        out.address_line1 ||= addr.streetAddress ?? '';
        out.address_city ||= addr.addressLocality ?? '';
        out.address_state ||= addr.addressRegion ?? '';
        out.address_zip ||= addr.postalCode ?? '';
      }
      out.list_price ??= num(c.offers?.price ?? c.price);
      out.bedrooms ??= num(c.numberOfRooms ?? c.numberOfBedrooms);
      out.bathrooms ??= num(c.numberOfBathroomsTotal ?? c.numberOfBathrooms);
      out.sqft ??= num(c.floorSize?.value);
      out.year_built ??= num(c.yearBuilt);
      if (!out.description && typeof c.description === 'string') out.description = c.description;
      const img = c.image;
      const imgs = Array.isArray(img) ? img : typeof img === 'string' ? [img] : [];
      for (const u of imgs) if (typeof u === 'string' && !out.photo_urls.includes(u)) out.photo_urls.push(u);
    }
  }
}

// ── Strategy 2: __NEXT_DATA__ gdpClientCache ─────────────────────────────────
function fromNextData(html: string, out: ParsedListing): void {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return;
  let nextData: any;
  try { nextData = JSON.parse(match[1]); } catch { return; }
  const cache = nextData?.props?.pageProps?.componentProps?.gdpClientCache;
  let parsedCache: any;
  try { parsedCache = typeof cache === 'string' ? JSON.parse(cache) : cache; } catch { return; }
  if (!parsedCache) return;
  const firstKey = Object.keys(parsedCache)[0] ?? null;
  const property = firstKey ? (parsedCache[firstKey]?.property ?? parsedCache[firstKey]) : null;
  if (!property || typeof property !== 'object') return;

  out.zillow_zpid ||= firstKey;
  out.address_line1 ||= property.streetAddress ?? '';
  out.address_city ||= property.city ?? '';
  out.address_state ||= property.state ?? '';
  out.address_zip ||= property.zipcode ?? '';
  out.list_price ??= num(property.price);
  out.bedrooms ??= num(property.bedrooms);
  out.bathrooms ??= num(property.bathrooms);
  out.sqft ??= num(property.livingArea);
  out.year_built ??= num(property.yearBuilt);
  if (!out.description && typeof property.description === 'string') out.description = property.description;
  out.mls_number ||= property.mlsId ?? '';

  // __NEXT_DATA__ carries the full gallery — prefer it over a single JSON-LD hero.
  const photos = Array.isArray(property.photos)
    ? property.photos.map((p: any) => p?.mixedSources?.jpeg?.[0]?.url).filter((u: unknown): u is string => typeof u === 'string')
    : [];
  if (photos.length) out.photo_urls = [...new Set([...photos, ...out.photo_urls])];
}

export function parseZillowHtml(html: string, url: string): ParsedListing {
  const out = emptyListing(url);
  // JSON-LD first (stable), then enrich with __NEXT_DATA__ (rich but volatile).
  try { fromJsonLd(html, out); } catch { /* keep going */ }
  try { fromNextData(html, out); } catch { /* keep going */ }
  out.primary_photo_url = out.photo_urls[0] ?? null;
  return out;
}

/** Browser-like headers — an obvious bot UA gets a 403 / captcha from Zillow. */
export const ZILLOW_FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Referer: 'https://www.google.com/',
};
