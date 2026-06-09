/**
 * Phase 33.1 — ad creatives: GET list, POST save a chosen variant.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AdType, AdPlatform } from '@/lib/ai/adCreative';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('ad_creatives').select('*').eq('org_id', orgId).eq('is_archived', false).order('created_at', { ascending: false }).limit(50);
  return NextResponse.json({ creatives: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    ad_type?: AdType; platform?: AdPlatform; headline?: string; primary_text?: string; description?: string;
    cta_type?: string; nmls_number?: string; apr_disclosure?: string; coop_realtor_id?: string;
  };
  if (!body.ad_type || !body.platform || !body.headline) {
    return NextResponse.json({ error: 'ad_type, platform, and headline are required' }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('nmls_id').eq('clerk_user_id', userId).maybeSingle();

  const { data, error } = await sb
    .from('ad_creatives')
    .insert({
      org_id: orgId,
      created_by: userId,
      ad_type: body.ad_type,
      platform: body.platform,
      headline: body.headline,
      primary_text: body.primary_text ?? null,
      description: body.description ?? null,
      cta_type: body.cta_type ?? null,
      nmls_number: body.nmls_number ?? profile?.nmls_id ?? null,
      apr_disclosure: body.apr_disclosure ?? null,
      coop_realtor_id: body.coop_realtor_id ?? null,
    })
    .select('*')
    .single();
  if (error) {
    console.error('[ad-center] create failed', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  return NextResponse.json({ creative: data });
}
