import { ImageResponse } from 'next/og';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SIZES: Record<string, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  landscape: { w: 1200, h: 628 },
};
const LABELS: Record<string, string> = {
  flyer_just_listed: 'JUST LISTED',
  flyer_open_house: 'OPEN HOUSE',
  flyer_just_sold: 'JUST SOLD',
  rate_spotlight: 'RATE SPOTLIGHT',
};

const NAVY = '#0F1D2E';
const GOLD = '#C9A95C';

// GET /api/comarketing/flyer?listing=<id>&type=<asset_type>&size=<square|story|landscape>
// Composites a co-branded flyer via Satori (Phase 28.6) — Vercel-native, no canvas.
export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId || !orgId) return new Response('Unauthorized', { status: 401 });

  const url = new URL(req.url);
  const listingId = url.searchParams.get('listing') ?? '';
  const type = url.searchParams.get('type') ?? 'flyer_just_listed';
  const size = SIZES[url.searchParams.get('size') ?? 'square'] ?? SIZES.square;
  const label = LABELS[type] ?? 'FEATURED';

  const sb = createAdminClient();
  const [{ data: listing }, { data: lo }] = await Promise.all([
    sb.from('realtor_listings').select('address_line1, address_city, address_state, list_price, bedrooms, bathrooms, sqft, primary_photo_url').eq('id', listingId).eq('org_id', orgId).maybeSingle(),
    sb.from('profiles').select('first_name, last_name, nmls_id, avatar_url').eq('clerk_user_id', userId).maybeSingle(),
  ]);

  if (!listing) return new Response('Listing not found', { status: 404 });

  const price = listing.list_price ? `$${Number(listing.list_price).toLocaleString()}` : '';
  const specs = [listing.bedrooms ? `${listing.bedrooms} bd` : '', listing.bathrooms ? `${listing.bathrooms} ba` : '', listing.sqft ? `${Number(listing.sqft).toLocaleString()} sqft` : ''].filter(Boolean).join('  ·  ');
  const loName = lo ? `${lo.first_name ?? ''} ${lo.last_name ?? ''}`.trim() : '';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', backgroundColor: NAVY }}>
        {/* Background photo */}
        {listing.primary_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.primary_photo_url} alt="" width={size.w} height={size.h} style={{ position: 'absolute', top: 0, left: 0, width: size.w, height: size.h, objectFit: 'cover' }} />
        ) : null}
        {/* Gradient overlay */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: size.w, height: size.h, display: 'flex', background: `linear-gradient(to bottom, rgba(15,29,46,0.1) 50%, rgba(15,29,46,0.94) 100%)` }} />
        {/* Gold top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: size.w, height: 8, backgroundColor: GOLD, display: 'flex' }} />
        {/* Label */}
        <div style={{ position: 'absolute', top: 40, left: 40, display: 'flex', fontSize: size.w * 0.038, fontWeight: 700, color: GOLD, letterSpacing: 2 }}>{label}</div>

        {/* Bottom content */}
        <div style={{ position: 'absolute', bottom: 40, left: 40, right: 40, display: 'flex', flexDirection: 'column' }}>
          {price ? <div style={{ display: 'flex', fontSize: size.w * 0.072, fontWeight: 800, color: '#FFFFFF', lineHeight: 1 }}>{price}</div> : null}
          <div style={{ display: 'flex', fontSize: size.w * 0.034, color: '#FFFFFF', marginTop: 8 }}>{listing.address_line1}</div>
          <div style={{ display: 'flex', fontSize: size.w * 0.026, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{listing.address_city}, {listing.address_state}</div>
          {specs ? <div style={{ display: 'flex', fontSize: size.w * 0.024, color: GOLD, marginTop: 10 }}>{specs}</div> : null}

          {/* LO row */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 24 }}>
            {lo?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lo.avatar_url} alt="" width={size.w * 0.09} height={size.w * 0.09} style={{ width: size.w * 0.09, height: size.w * 0.09, borderRadius: 999, objectFit: 'cover', border: `3px solid ${GOLD}` }} />
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', marginLeft: lo?.avatar_url ? 16 : 0 }}>
              <div style={{ display: 'flex', fontSize: size.w * 0.026, fontWeight: 600, color: '#FFFFFF' }}>{loName}</div>
              {lo?.nmls_id ? <div style={{ display: 'flex', fontSize: size.w * 0.02, color: GOLD }}>NMLS# {lo.nmls_id}</div> : null}
            </div>
          </div>
        </div>
      </div>
    ),
    { width: size.w, height: size.h }
  );
}
