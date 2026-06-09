import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ASSET_TYPES = ['flyer_just_listed', 'flyer_open_house', 'flyer_just_sold', 'social_square', 'social_story', 'social_landscape', 'email_banner'];

// POST — record a generated co-marketing asset + an INSERT-only view event.
export async function POST(req: NextRequest) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const listingId = String(body.listing_id ?? '');
  const assetType = ASSET_TYPES.includes(String(body.asset_type)) ? String(body.asset_type) : 'flyer_just_listed';
  const storageUrl = String(body.storage_url ?? '');
  if (!listingId || !storageUrl) return NextResponse.json({ error: 'listing_id and storage_url required' }, { status: 422 });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const { data, error } = await sb.from('comarketing_assets').insert({
    org_id: orgId, listing_id: listingId, lo_id: profile?.id ?? null,
    asset_type: assetType, qr_target_url: String(body.qr_target_url ?? '') || null, storage_url: storageUrl,
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from('comarketing_asset_views').insert({ asset_id: data.id, org_id: orgId, viewed_by: 'lo', action: 'downloaded' });
  return NextResponse.json({ asset: data }, { status: 201 });
}
