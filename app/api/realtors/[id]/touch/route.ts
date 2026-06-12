/**
 * Phase 40 — log a realtor touch (INSERT-only). A 'referral_received' touch bumps
 * deals_referred_12m + last_referral_at and recomputes the partnership score/tier.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { computePartnershipScore } from '@/lib/realtors/partnershipScore';
import { recalcRealtorHeatScore } from '@/lib/realtors/heatScore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES = ['email', 'sms', 'call', 'in_person', 'co_marketing_send', 'referral_received', 'note'];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { touch_type?: string; subject?: string; body?: string; outcome?: string };
  if (!TYPES.includes(b.touch_type ?? '')) return NextResponse.json({ error: 'Invalid touch_type' }, { status: 400 });

  const sb = createAdminClient();
  const { data: realtor } = await sb.from('realtors').select('*').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!realtor) return NextResponse.json({ error: 'Realtor not found' }, { status: 404 });

  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  await sb.from('realtor_touches').insert({ org_id: orgId, realtor_id: params.id, lo_id: profile?.id ?? null, touch_type: b.touch_type, subject: b.subject ?? null, body: b.body ?? null, outcome: b.outcome ?? null });

  // Update relationship state.
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { last_contact_at: now, updated_at: now };
  let referred = realtor.deals_referred_12m ?? 0;
  if (b.touch_type === 'referral_received') {
    referred += 1;
    patch.deals_referred_12m = referred;
    patch.last_referral_at = now;
  }
  const { score, tier } = computePartnershipScore({ ...realtor, deals_referred_12m: referred, last_contact_at: now, last_referral_at: b.touch_type === 'referral_received' ? now : realtor.last_referral_at });
  patch.partnership_score = score;
  patch.partnership_tier = tier;
  await sb.from('realtors').update(patch).eq('id', params.id);

  // Recompute heat (momentum) immediately so the UI reflects this touch without
  // waiting for the 7 AM cron. Uses the just-written last_contact_at.
  let heat = null;
  try {
    heat = await recalcRealtorHeatScore(sb, { id: params.id as string, org_id: orgId, last_contact_at: now });
  } catch (e) {
    console.error('[realtor-heat] recalc after touch failed', e); // never block the touch
  }

  return NextResponse.json({
    ok: true,
    partnership_score: score,
    partnership_tier: tier,
    heat_score: heat?.score ?? null,
    heat_band: heat?.band ?? null,
  });
}
