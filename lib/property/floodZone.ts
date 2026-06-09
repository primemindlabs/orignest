import 'server-only';

/**
 * Phase 29.2a — Flood zone determination.
 * Source priority: ATTOM (gated, via DeedMine) → FEMA NFHL (free) → manual.
 * No API key required for the FEMA path; the Census geocoder is also free.
 */
export interface PropertyAddress {
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}
export interface FloodZoneResult {
  zone: string;
  panel_number: string | null;
  source: 'attom' | 'fema' | 'manual';
  required: boolean;
  determined_at: string;
}

// Special Flood Hazard Areas (SFHAs) — A* and V* zones require flood insurance.
export function isFloodInsuranceRequired(zone: string | null | undefined): boolean {
  if (!zone) return false;
  return /^(A|V)/i.test(zone.trim());
}

function fullAddress(a: PropertyAddress): string {
  return [a.line1, a.city, a.state, a.zip].filter(Boolean).join(', ');
}

async function geocode(a: PropertyAddress): Promise<{ lat: number; lng: number } | null> {
  const addr = fullAddress(a);
  if (!addr) return null;
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(addr)}&benchmark=Public_AR_Current&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    const match = json?.result?.addressMatches?.[0]?.coordinates;
    if (match) return { lat: match.y, lng: match.x };
  } catch {
    /* fall through */
  }
  return null;
}

async function queryFEMA(lat: number, lng: number): Promise<{ zone: string; panel: string | null } | null> {
  try {
    // NFHL flood hazard zones layer (28). Point query in WGS84.
    const url = `https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,FIRM_PAN&returnGeometry=false&f=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    const attrs = json?.features?.[0]?.attributes;
    if (attrs?.FLD_ZONE) return { zone: attrs.FLD_ZONE, panel: attrs.FIRM_PAN ?? null };
  } catch {
    /* fall through */
  }
  return null;
}

// ATTOM property detail (gated). Returns null unless ATTOM_API_KEY is configured.
async function queryAttom(a: PropertyAddress): Promise<{ zone: string; panel: string | null } | null> {
  const key = process.env.ATTOM_API_KEY;
  if (!key || !a.line1) return null;
  try {
    const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail?address1=${encodeURIComponent(a.line1)}&address2=${encodeURIComponent([a.city, a.state, a.zip].filter(Boolean).join(' '))}`;
    const res = await fetch(url, { headers: { apikey: key, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    const zone = json?.property?.[0]?.location?.floodZone ?? json?.property?.[0]?.floodZone;
    if (zone) return { zone, panel: json?.property?.[0]?.floodPanel ?? null };
  } catch {
    /* fall through */
  }
  return null;
}

export async function determineFloodZone(address: PropertyAddress): Promise<FloodZoneResult | null> {
  // Primary: ATTOM (gated)
  const attom = await queryAttom(address);
  if (attom?.zone) {
    return { zone: attom.zone, panel_number: attom.panel, source: 'attom', required: isFloodInsuranceRequired(attom.zone), determined_at: new Date().toISOString() };
  }
  // Fallback: FEMA NFHL (free)
  const coords = await geocode(address);
  if (coords) {
    const fema = await queryFEMA(coords.lat, coords.lng);
    if (fema?.zone) {
      return { zone: fema.zone, panel_number: fema.panel, source: 'fema', required: isFloodInsuranceRequired(fema.zone), determined_at: new Date().toISOString() };
    }
  }
  return null;
}
