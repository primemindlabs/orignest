/**
 * Phase 61.1 — the current LO's shareable referral code + lifetime stats.
 *   GET  → { code, url, stats }
 *   POST → ensure/regenerate
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureReferralCode } from '@/lib/referrals/referralCodes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id, last_name').eq('clerk_user_id', userId).maybeSingle();
  const code = await ensureReferralCode(orgId, profile?.id ?? null, profile?.last_name);

  // Lifetime stats from the existing buyer_referrals + referral_events.
  const [{ count: referred }, { count: converted }] = await Promise.all([
    sb.from('referral_events').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('referral_code', code).eq('event_type', 'lead_created'),
    sb.from('referral_events').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('referral_code', code).eq('event_type', 'loan_closed'),
  ]);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return NextResponse.json({ code, url: `${base}/apply?ref=${code}`, stats: { leads_created: referred ?? 0, closed: converted ?? 0 } });
}

export async function POST() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id, last_name').eq('clerk_user_id', userId).maybeSingle();
  const code = await ensureReferralCode(orgId, profile?.id ?? null, profile?.last_name);
  return NextResponse.json({ code });
}
