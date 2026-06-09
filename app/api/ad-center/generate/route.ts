/**
 * Phase 33.1 — generate 3 compliant ad variants (LO-only, Claude Sonnet).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateAdVariants, type AdType, type AdPlatform } from '@/lib/ai/adCreative';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES: AdType[] = ['purchase', 'refinance', 'fha', 'va', 'heloc', 'coop'];
const PLATFORMS: AdPlatform[] = ['meta', 'google', 'both'];

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { ad_type?: AdType; platform?: AdPlatform; key_message?: string; coop_realtor_id?: string };
  if (!TYPES.includes(body.ad_type as AdType) || !PLATFORMS.includes(body.platform as AdPlatform)) {
    return NextResponse.json({ error: 'Valid ad_type and platform are required' }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('first_name, last_name, nmls_id').eq('clerk_user_id', userId).maybeSingle();
  const { data: org } = await sb.from('organizations').select('name, licensed_states').eq('id', orgId).maybeSingle();

  let coopName: string | undefined;
  if (body.coop_realtor_id) {
    const { data: r } = await sb.from('referral_partners').select('first_name, last_name, company_name').eq('id', body.coop_realtor_id).eq('org_id', orgId).maybeSingle();
    if (r) coopName = `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || r.company_name || undefined;
  }

  const states = org?.licensed_states as string[] | null | undefined;
  try {
    const variants = await generateAdVariants({
      ad_type: body.ad_type as AdType,
      platform: body.platform as AdPlatform,
      lo_name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Your Loan Officer',
      lo_nmls: profile?.nmls_id ?? '',
      company_name: org?.name ?? 'Our Company',
      state: Array.isArray(states) && states.length ? states[0] : 'your state',
      key_message: body.key_message,
      coop_realtor_name: coopName,
    });
    return NextResponse.json({ variants, lo_nmls: profile?.nmls_id ?? null });
  } catch (err) {
    console.error('[ad-center/generate] failed', err);
    return NextResponse.json({ error: 'generation_failed' }, { status: 502 });
  }
}
