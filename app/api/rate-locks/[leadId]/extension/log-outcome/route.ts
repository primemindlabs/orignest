// Phase 104 — Step 4 Save: the ONLY step that writes an extension log row. Inserts the
// immutable audit row, stamps the lock's extension_status, and posts a notification.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications/notify';

type Ctx = { params: Promise<{ leadId: string }> };

const OUTCOME_LABEL: Record<string, string> = {
  approved: 'Extension approved',
  denied: 'Extension denied',
  pending: 'Extension pending AE response',
  cancelled: 'Extension request cancelled',
};

export async function POST(request: Request, { params }: Ctx) {
  const { leadId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const {
    ae_connection_id,
    lock_expiry_date,
    extension_days_requested,
    bps_per_day,
    loan_balance,
    ae_message_text,
    ae_message_sent_at,
    outcome,
    outcome_notes,
  } = body;

  // Server-side validation (authority — client also guards).
  if (!bps_per_day || Number(bps_per_day) <= 0) {
    return NextResponse.json({ error: 'bps_per_day must be greater than 0' }, { status: 422 });
  }
  if (!extension_days_requested || Number(extension_days_requested) < 1) {
    return NextResponse.json({ error: 'extension_days_requested must be at least 1' }, { status: 422 });
  }
  if (!loan_balance || Number(loan_balance) <= 0) {
    return NextResponse.json({ error: 'loan_balance must be greater than 0' }, { status: 422 });
  }
  if (!lock_expiry_date) {
    return NextResponse.json({ error: 'lock_expiry_date required' }, { status: 422 });
  }

  const days = Number(extension_days_requested);
  const bps = Number(bps_per_day);
  const balance = Number(loan_balance);
  const totalCostEst = Math.round(((bps * days) / 10000) * balance);
  const resolvedOutcome = outcome ?? 'pending';

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const loId = profile?.id as string | undefined;
  if (!loId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: logEntry, error: logErr } = await sb
    .from('rate_lock_extension_log')
    .insert({
      org_id: orgId,
      user_id: loId,
      lead_id: leadId,
      ae_connection_id: ae_connection_id ?? null,
      lock_expiry_date,
      extension_days_requested: days,
      bps_per_day: bps,
      loan_balance: balance,
      total_cost_est: totalCostEst,
      ae_message_text: ae_message_text ?? null,
      ae_message_sent_at: ae_message_sent_at ?? null,
      outcome: resolvedOutcome,
      outcome_notes: outcome_notes ?? null,
    })
    .select()
    .single();

  if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 });

  // Stamp the lock with the extension result.
  await sb
    .from('rate_lock_requests')
    .update({
      extension_status: resolvedOutcome,
      extension_days: days,
      extension_cost_bps: bps,
      extension_cost_est: totalCostEst,
    })
    .eq('lead_id', leadId)
    .eq('org_id', orgId)
    .not('status', 'in', '(cancelled,declined)');

  // Notification summary (existing notifications store; 'rate_lock' is a valid type).
  await notify(sb, {
    orgId,
    userId: loId,
    type: 'rate_lock',
    title: OUTCOME_LABEL[resolvedOutcome] ?? 'Rate lock extension logged',
    body: `${days}-day extension · Est. cost $${totalCostEst.toLocaleString()}`,
    link: `/leads/${leadId}`,
  });

  return NextResponse.json({ log_entry: logEntry });
}
