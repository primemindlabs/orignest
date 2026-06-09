/**
 * Phase 40 — single realtor: GET (realtor + score factor breakdown + touch
 * timeline) and PATCH (edit relationship notes; rescores if production fields
 * are edited).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { computePartnershipScore } from '@/lib/realtors/partnershipScore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: realtor } = await sb.from('realtors').select('*').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!realtor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: touches } = await sb.from('realtor_touches').select('id, touch_type, subject, body, outcome, created_at').eq('realtor_id', params.id).order('created_at', { ascending: false }).limit(100);
  const { factors } = computePartnershipScore(realtor);

  return NextResponse.json({ realtor, touches: touches ?? [], factors });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sb = createAdminClient();
  const { data: realtor } = await sb.from('realtors').select('*').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!realtor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.relationship_notes === 'string') patch.relationship_notes = b.relationship_notes;
  for (const f of ['transactions_12m', 'volume_12m', 'buyer_side_pct', 'deals_referred_12m'] as const) {
    if (b[f] != null && b[f] !== '') patch[f] = Number(b[f]);
  }
  // Rescore if any production field changed.
  if (['transactions_12m', 'volume_12m', 'buyer_side_pct', 'deals_referred_12m'].some((f) => f in patch)) {
    const { score, tier } = computePartnershipScore({ ...realtor, ...patch });
    patch.partnership_score = score;
    patch.partnership_tier = tier;
    if ('buyer_side_pct' in patch) patch.seller_side_pct = patch.buyer_side_pct != null ? 100 - Number(patch.buyer_side_pct) : null;
  }
  await sb.from('realtors').update(patch).eq('id', params.id);
  return NextResponse.json({ ok: true, partnership_score: patch.partnership_score ?? realtor.partnership_score, partnership_tier: patch.partnership_tier ?? realtor.partnership_tier });
}
