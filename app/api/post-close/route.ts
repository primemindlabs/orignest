// Phase 103 — GET the post-close monitors + their pending review queue (org-scoped).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ monitors: [] });

  const sb = createAdminClient();

  const { data: rels } = await sb
    .from('borrower_relationships')
    .select(
      'id, full_name, phone, lead_ids, last_close_date, original_rate, current_market_rate, rate_delta, last_known_avm, current_loan_balance, estimated_equity, refi_alert_threshold, monitoring_status'
    )
    .eq('org_id', orgId)
    .neq('monitoring_status', 'opted_out')
    .order('last_close_date', { ascending: false, nullsFirst: false })
    .limit(300);

  const relIds = (rels ?? []).map((r) => r.id as string);
  const queuedByRel = new Map<string, any[]>();
  if (relIds.length) {
    const { data: queued } = await sb
      .from('post_close_outreach')
      .select(
        'id, relationship_id, lead_id, trigger_type, trigger_details, outreach_message, channel, requires_review, status, sent_at, created_at'
      )
      .eq('org_id', orgId)
      .eq('status', 'queued')
      .in('relationship_id', relIds)
      .order('created_at', { ascending: true });
    for (const t of queued ?? []) {
      const arr = queuedByRel.get(t.relationship_id as string) ?? [];
      arr.push(t);
      queuedByRel.set(t.relationship_id as string, arr);
    }
  }

  const monitors = (rels ?? []).map((r) => {
    const leadIds = Array.isArray(r.lead_ids) ? (r.lead_ids as string[]) : [];
    return {
      id: r.id,
      full_name: r.full_name,
      phone: r.phone,
      last_close_date: r.last_close_date,
      original_rate: r.original_rate != null ? Number(r.original_rate) : null,
      current_market_rate: r.current_market_rate != null ? Number(r.current_market_rate) : null,
      rate_delta: r.rate_delta != null ? Number(r.rate_delta) : null,
      last_known_avm: r.last_known_avm != null ? Number(r.last_known_avm) : null,
      current_loan_balance: r.current_loan_balance != null ? Number(r.current_loan_balance) : null,
      estimated_equity: r.estimated_equity != null ? Number(r.estimated_equity) : null,
      refi_alert_threshold: r.refi_alert_threshold != null ? Number(r.refi_alert_threshold) : 0.75,
      monitoring_status: r.monitoring_status,
      lead_id: leadIds[0] ?? null,
      pending_triggers: queuedByRel.get(r.id as string) ?? [],
    };
  });

  return NextResponse.json({ monitors });
}
