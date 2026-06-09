/**
 * Phase 33.8 — dialer session builder (LO-only).
 *   GET  → recent sessions
 *   POST → build a session: TCPA pre-flight every lead, queue only those allowed.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkTcpaCompliance } from '@/lib/dialer/tcpaGuard';
import { requireFeature, FeatureGateError, featureLockedResponse } from '@/lib/billing/featureGate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('dialer_sessions').select('*').eq('org_id', orgId).order('started_at', { ascending: false }).limit(25);
  return NextResponse.json({ sessions: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  // Phase 35 — Power Dialer is a Growth+ feature.
  try {
    await requireFeature(orgId, 'power_dialer');
  } catch (err) {
    if (err instanceof FeatureGateError) return NextResponse.json(featureLockedResponse(err), { status: 403 });
    throw err;
  }

  const body = (await req.json().catch(() => ({}))) as { lead_ids?: string[]; voicemail_template_id?: string };
  const leadIds = Array.isArray(body.lead_ids) ? body.lead_ids.slice(0, 100) : [];
  if (leadIds.length === 0) return NextResponse.json({ error: 'lead_ids required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: leads } = await sb.from('leads').select('id, first_name, last_name, property_state, phone').in('id', leadIds).eq('org_id', orgId);
  const leadById = new Map((leads ?? []).map((l) => [l.id, l]));

  const results = await Promise.all(
    leadIds.map(async (id) => {
      const lead = leadById.get(id);
      if (!lead) return { leadId: id, allowed: false, reason: 'Lead not found' };
      if (!lead.phone) return { leadId: id, allowed: false, reason: 'No phone number on file' };
      const check = await checkTcpaCompliance(sb, orgId, id, lead.property_state);
      return { leadId: id, ...check };
    })
  );
  const allowed = results.filter((r) => r.allowed);
  const blocked = results.filter((r) => !r.allowed);

  if (allowed.length === 0) {
    return NextResponse.json(
      { error: 'No leads in queue are eligible for auto-dial right now.', blocked_reasons: blocked.map((b) => ({ leadId: b.leadId, reason: b.reason })) },
      { status: 400 }
    );
  }

  const { data: session, error } = await sb.from('dialer_sessions').insert({ org_id: orgId, lo_id: userId }).select('id').single();
  if (error || !session) return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });

  await sb.from('dialer_queue_items').insert(
    allowed.map((r, idx) => ({ session_id: session.id, org_id: orgId, lead_id: r.leadId, position: idx + 1 }))
  );

  return NextResponse.json({
    session_id: session.id,
    queued: allowed.length,
    skipped: blocked.length,
    skipped_reasons: blocked.map((b) => ({ leadId: b.leadId, reason: b.reason })),
  });
}
