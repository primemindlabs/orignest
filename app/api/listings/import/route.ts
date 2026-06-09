import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/listings/import — parse a Zillow listing URL server-side (no CORS).
 * Zillow embeds listing data in __NEXT_DATA__. If the structure changes or the
 * request is blocked, we degrade gracefully to manual entry — never throw to the
 * user (Phase 28.5).
 */
export async function POST(req: NextRequest) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  let body: { zillow_url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ fallback: true, reason: 'Invalid request.' }); }
  const url = (body.zillow_url ?? '').trim();
  if (!/^https?:\/\/(www\.)?zillow\.com\//i.test(url)) {
    return NextResponse.json({ fallback: true, reason: 'Enter a valid Zillow listing URL.' });
  }

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AshleyIQ/1.0)' } });
    if (!res.ok) return NextResponse.json({ fallback: true, reason: 'Auto-import unavailable — please enter listing details manually.' });
    const html = await res.text();
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) return NextResponse.json({ fallback: true, reason: 'Auto-import unavailable — please enter listing details manually.' });

    const nextData = JSON.parse(match[1]);
    const cache = nextData?.props?.pageProps?.componentProps?.gdpClientCache;
    const parsedCache = typeof cache === 'string' ? JSON.parse(cache) : cache;
    const firstKey = parsedCache ? Object.keys(parsedCache)[0] : null;
    const property = firstKey ? (parsedCache[firstKey]?.property ?? parsedCache[firstKey]) : null;
    if (!property) return NextResponse.json({ fallback: true, reason: 'Auto-import unavailable — please enter listing details manually.' });

    const photos = Array.isArray(property.photos)
      ? property.photos.map((p: any) => p?.mixedSources?.jpeg?.[0]?.url).filter(Boolean)
      : [];

    return NextResponse.json({
      fallback: false,
      listing: {
        address_line1: property.streetAddress ?? '', address_city: property.city ?? '',
        address_state: property.state ?? '', address_zip: property.zipcode ?? '',
        list_price: property.price ?? null, bedrooms: property.bedrooms ?? null,
        bathrooms: property.bathrooms ?? null, sqft: property.livingArea ?? null,
        year_built: property.yearBuilt ?? null, description: property.description ?? '',
        mls_number: property.mlsId ?? '', photo_urls: photos, primary_photo_url: photos[0] ?? null,
        zillow_url: url, zillow_zpid: firstKey, source: 'zillow_url',
      },
    });
  } catch {
    return NextResponse.json({ fallback: true, reason: 'Auto-import unavailable — please enter listing details manually.' });
  }
}
