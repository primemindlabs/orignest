/**
 * Phase 56.2 — Encompass (ICE Partner Connect) webhook. HMAC-SHA256 verified.
 * INERT until ENCOMPASS_WEBHOOK_SECRET is set + a tenant has an encompass
 * los_connection. Mirrors the Phase 41 LendingPad/Arive webhook pattern.
 * Bi-directional sync is additive — Ashley IQ never deletes Encompass data.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createHmac, timingSafeEqual } from 'crypto';
import { mapEncompassMilestone } from '@/lib/integrations/los/encompassFieldMap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.ENCOMPASS_WEBHOOK_SECRET;
  const raw = await req.text();
  if (!secret) return NextResponse.json({ received: false, gated: 'ENCOMPASS_WEBHOOK_SECRET not set' }, { status: 200 });

  const sig = req.headers.get('x-em-signature') ?? '';
  const expected = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  let event: { type?: string; loanId?: string; instanceId?: string; milestoneCurrentName?: string };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Bad payload' }, { status: 400 }); }

  const sb = createAdminClient();
  // Resolve the tenant by Encompass instance (only acts if a connection exists).
  const { data: conn } = await sb.from('los_connections').select('org_id').eq('los_type', 'encompass').eq('is_active', true).eq('encompass_instance_id', event.instanceId ?? '').maybeSingle();
  if (!conn) return NextResponse.json({ received: true, ignored: 'no matching connection' }, { status: 200 });

  if (event.type === 'Loan.Milestone.Changed' && event.loanId) {
    const stage = mapEncompassMilestone(event.milestoneCurrentName);
    // Additive: update the mapped lead's stage if we already track this loan (never insert/delete here).
    // Real columns: leads.los_type (not los_provider) + los_last_synced_at.
    await sb.from('leads').update({ stage, los_last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('org_id', conn.org_id).eq('los_loan_id', event.loanId).eq('los_type', 'encompass');
    // Real los_sync_events columns: los_loan_id (not external_id) + direction + result.
    await sb.from('los_sync_events').insert({ org_id: conn.org_id, los_type: 'encompass', los_loan_id: event.loanId, event_type: 'status_changed', direction: 'inbound', payload: { milestone: event.milestoneCurrentName, stage }, result: 'success' }).then(() => undefined, () => undefined);
  }
  return NextResponse.json({ received: true });
}
