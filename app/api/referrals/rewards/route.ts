/**
 * Phase 61.1 (deferred completion) — referral rewards.
 *   GET   → reward queue (pending/approved/issued) + referred-borrower names
 *   POST  → create a reward for a referred loan (RESPA: only after the referred
 *           loan has CLOSED; de-minimis / not tied to settlement-service referrals)
 *   PATCH → approve / issue / cancel
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('referral_rewards').select('id, reward_type, reward_amount, status, created_at, referred_loan_id, leads:referred_loan_id(first_name, last_name)').eq('org_id', orgId).order('created_at', { ascending: false }).limit(100);
  const rewards = (data ?? []).map((r) => { const l = r.leads as unknown as { first_name?: string; last_name?: string } | null; return { id: r.id, reward_type: r.reward_type, reward_amount: r.reward_amount, status: r.status, created_at: r.created_at, referred_name: l ? `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() : null }; });
  return NextResponse.json({ rewards });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { referred_loan_id?: string; reward_type?: string; reward_amount?: number; referral_event_id?: string; notes?: string };
  if (!b.referred_loan_id || !b.reward_type || !b.reward_amount) return NextResponse.json({ error: 'referred_loan_id, reward_type, reward_amount required' }, { status: 400 });

  const sb = createAdminClient();
  // RESPA guard: the referred loan must have CLOSED before a reward can be created.
  const { data: lead } = await sb.from('leads').select('stage, assigned_to').eq('id', b.referred_loan_id).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  if (lead.stage !== 'closed') return NextResponse.json({ error: 'Reward can only be created after the referred loan closes (RESPA).' }, { status: 400 });

  const { error } = await sb.from('referral_rewards').insert({ org_id: orgId, referral_event_id: b.referral_event_id ?? null, referred_loan_id: b.referred_loan_id, lo_id: lead.assigned_to ?? null, reward_type: b.reward_type, reward_amount: b.reward_amount, notes: b.notes ?? null });
  if (error) { console.error('[rewards]', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!b.id || !['approved', 'issued', 'cancelled'].includes(b.status ?? '')) return NextResponse.json({ error: 'id + valid status required' }, { status: 400 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const patch: Record<string, unknown> = { status: b.status };
  if (b.status === 'approved') { patch.approved_by = profile?.id ?? null; patch.approved_at = new Date().toISOString(); }
  if (b.status === 'issued') patch.issued_at = new Date().toISOString();
  await sb.from('referral_rewards').update(patch).eq('id', b.id).eq('org_id', orgId);
  // Mirror to the INSERT-only event log.
  if (b.status === 'issued') await sb.from('referral_events').insert({ org_id: orgId, referral_code: 'reward', event_type: 'reward_issued', notes: b.id }).then(() => undefined, () => undefined);
  return NextResponse.json({ ok: true });
}
