import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PROPERTY_TYPES = ['SFR', 'Condo', 'Townhouse', 'Multi-Family', 'Land', 'Commercial'];

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('realtor_listings')
    .select('id, address_line1, address_city, address_state, list_price, bedrooms, bathrooms, sqft, property_type, primary_photo_url, listing_status, source')
    .eq('org_id', orgId).order('created_at', { ascending: false });
  return NextResponse.json({ listings: data ?? [] });
}

// POST — create a listing (manual or from imported Zillow data).
export async function POST(req: NextRequest) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

  if (!str(body.address_line1) || !str(body.address_city) || !str(body.address_state) || num(body.list_price) == null) {
    return NextResponse.json({ error: 'Address and list price are required.' }, { status: 422 });
  }
  const photos = Array.isArray(body.photo_urls) ? (body.photo_urls as unknown[]).map(String).filter(Boolean).slice(0, 10) : [];

  const sb = createAdminClient();
  const { data, error } = await sb.from('realtor_listings').insert({
    org_id: orgId,
    address_line1: str(body.address_line1), address_city: str(body.address_city),
    address_state: str(body.address_state).toUpperCase().slice(0, 2), address_zip: str(body.address_zip),
    list_price: num(body.list_price), bedrooms: num(body.bedrooms), bathrooms: num(body.bathrooms),
    sqft: num(body.sqft), year_built: num(body.year_built),
    property_type: PROPERTY_TYPES.includes(str(body.property_type)) ? str(body.property_type) : null,
    description: str(body.description) || null, mls_number: str(body.mls_number) || null,
    photo_urls: photos, primary_photo_url: str(body.primary_photo_url) || photos[0] || null,
    source: body.source === 'zillow_url' ? 'zillow_url' : 'manual',
    zillow_url: str(body.zillow_url) || null, zillow_zpid: str(body.zillow_zpid) || null,
    zillow_last_sync: body.source === 'zillow_url' ? new Date().toISOString() : null,
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ listing: data }, { status: 201 });
}
