/**
 * Phase 47.4/47.5 — per credit alert:
 *   GET   → generate the warm re-engagement draft (Claude Haiku)
 *   PATCH → record the action taken (sent_rate_update | called_borrower | dismissed)
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateReengagementDraft } from '@/lib/creditAlerts/rateReengagement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIONS = ['sent_rate_update', 'called_borrower', 'dismissed'];

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 501 });

  const sb = createAdminClient();
  const { data: alert } = await sb.from('credit_alerts').select('alert_type, score_delta, lead_id').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!alert) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: lead } = await sb.from('leads').select('first_name, loan_type, loan_amount, loan_purpose').eq('id', alert.lead_id).maybeSingle();

  const loanSummary = lead?.loan_amount ? `${lead.loan_type ?? 'loan'} · $${(Number(lead.loan_amount) / 1000).toFixed(0)}K · ${lead.loan_purpose ?? ''}`.trim() : null;
  const draft = await generateReengagementDraft({ alertType: alert.alert_type, scoreDelta: alert.score_delta ?? 0, firstName: lead?.first_name ?? 'there', loanSummary });
  return NextResponse.json({ draft });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { action_taken?: string };
  if (!ACTIONS.includes(b.action_taken ?? '')) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  await sb.from('credit_alerts').update({ action_taken: b.action_taken, actioned_at: new Date().toISOString(), actioned_by: profile?.id ?? null }).eq('id', params.id).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}
