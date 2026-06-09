/**
 * Phase 62.3 — ARM Reset Watch.
 *   GET   → the LO's watches with live projections + book summary
 *   POST  → add a watch (computes worst-case at creation)
 *   PATCH → update alert_status; status='refi_started' creates a pre-populated lead
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { projectArmReset, daysToReset, resetUrgency, DEFAULT_INDEX_RATE } from '@/lib/arm-watch/calculations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('arm_watches').select('*').eq('org_id', orgId).not('alert_status', 'in', '("refi_closed","removed","not_interested")').order('first_reset_date').limit(500);
  const idx = DEFAULT_INDEX_RATE;
  const watches = (data ?? []).map((w) => {
    const proj = projectArmReset({ loan_balance: Number(w.loan_balance ?? 0), current_rate: Number(w.current_rate), arm_margin: Number(w.arm_margin), arm_initial_cap: Number(w.arm_initial_cap), arm_lifetime_cap: Number(w.arm_lifetime_cap), index_rate: idx });
    const days = daysToReset(w.first_reset_date);
    return { ...w, days_to_reset: days, urgency: resetUrgency(days), ...proj };
  }).sort((a, b) => a.days_to_reset - b.days_to_reset);

  const thisQuarter = watches.filter((w) => w.days_to_reset >= 0 && w.days_to_reset <= 90).length;
  const summary = { total: watches.length, resets_this_quarter: thisQuarter, est_revenue_opportunity: thisQuarter * 6800 };
  return NextResponse.json({ watches, summary, index_rate: idx, index_gated: true });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.borrower_name || !b.current_rate || !b.first_reset_date) return NextResponse.json({ error: 'borrower_name, current_rate, first_reset_date required' }, { status: 400 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const proj = projectArmReset({ loan_balance: Number(b.loan_balance ?? 0), current_rate: Number(b.current_rate), arm_margin: Number(b.arm_margin ?? 0), arm_initial_cap: Number(b.arm_initial_cap ?? 2), arm_lifetime_cap: Number(b.arm_lifetime_cap ?? 5), index_rate: DEFAULT_INDEX_RATE });
  const { error } = await sb.from('arm_watches').insert({ org_id: orgId, lo_id: profile?.id ?? null, contact_id: b.contact_id ?? null, loan_id: b.loan_id ?? null, borrower_name: String(b.borrower_name), lender_name: b.lender_name ?? null, loan_balance: b.loan_balance ?? null, current_rate: Number(b.current_rate), arm_index: b.arm_index ?? 'sofr', arm_margin: Number(b.arm_margin ?? 0), arm_initial_cap: Number(b.arm_initial_cap ?? 2), arm_lifetime_cap: Number(b.arm_lifetime_cap ?? 5), first_reset_date: b.first_reset_date, worst_case_rate: proj.worst_case_rate, worst_case_payment: proj.projected_payment });
  if (error) { console.error('[arm-watches]', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; alert_status?: string };
  if (!b.id || !b.alert_status) return NextResponse.json({ error: 'id + alert_status required' }, { status: 400 });
  const sb = createAdminClient();
  const { data: w } = await sb.from('arm_watches').select('borrower_name, lender_name, lo_id').eq('id', b.id).eq('org_id', orgId).maybeSingle();
  await sb.from('arm_watches').update({ alert_status: b.alert_status, last_outreach_at: new Date().toISOString() }).eq('id', b.id).eq('org_id', orgId);

  let leadId: string | null = null;
  if (b.alert_status === 'refi_started' && w) {
    const [first, ...rest] = (w.borrower_name ?? 'ARM Borrower').split(' ');
    const { data: lead } = await sb.from('leads').insert({ org_id: orgId, assigned_to: w.lo_id ?? null, first_name: first, last_name: rest.join(' ') || '', loan_purpose: 'refinance', source: 'arm_reset_watch', stage: 'new_inquiry' }).select('id').single();
    leadId = lead?.id ?? null;
  }
  return NextResponse.json({ ok: true, lead_id: leadId });
}
