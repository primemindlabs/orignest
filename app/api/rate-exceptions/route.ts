/**
 * Phase 51.5 — rate exception requests (audit trail, no DELETE).
 *   GET   ?broker_account_id= | all org pending
 *   POST  → AE requests an exception on a broker's behalf
 *   PATCH → reviewer decision (approved/denied + approved_rate/notes)
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXC = ['rate_buydown', 'fee_waiver', 'overlay_exception', 'ltv_exception', 'fico_exception', 'dti_exception'];
const DECISIONS = ['approved', 'approved_modified', 'denied', 'expired'];

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const brokerId = new URL(req.url).searchParams.get('broker_account_id');
  const sb = createAdminClient();
  let q = sb.from('rate_exception_requests').select('*').eq('org_id', orgId).order('requested_at', { ascending: false }).limit(200);
  if (brokerId) q = q.eq('broker_account_id', brokerId);
  const { data } = await q;
  return NextResponse.json({ exceptions: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.loan_type || !b.loan_amount || !EXC.includes(String(b.exception_type)) || !b.justification) {
    return NextResponse.json({ error: 'loan_type, loan_amount, exception_type and justification are required' }, { status: 400 });
  }
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const { data, error } = await sb.from('rate_exception_requests').insert({
    org_id: orgId, broker_account_id: b.broker_account_id ? String(b.broker_account_id) : null, requested_by_ae_id: profile?.id ?? null,
    loan_type: String(b.loan_type), loan_amount: Number(b.loan_amount), fico_score: b.fico_score ? Number(b.fico_score) : null, ltv: b.ltv ? Number(b.ltv) : null,
    exception_type: String(b.exception_type), standard_rate: b.standard_rate ? Number(b.standard_rate) : null, requested_rate: b.requested_rate ? Number(b.requested_rate) : null,
    requested_fee_waiver: b.requested_fee_waiver ? Number(b.requested_fee_waiver) : null, justification: String(b.justification),
  }).select('*').single();
  if (error) { console.error('[rate-exceptions]', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }
  return NextResponse.json({ exception: data });
}

export async function PATCH(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.id || !DECISIONS.includes(String(b.status))) return NextResponse.json({ error: 'id + valid status required' }, { status: 400 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  await sb.from('rate_exception_requests').update({
    status: String(b.status), reviewed_by_id: profile?.id ?? null, reviewed_at: new Date().toISOString(),
    approved_rate: b.approved_rate ? Number(b.approved_rate) : null, reviewer_notes: b.reviewer_notes ? String(b.reviewer_notes) : null,
  }).eq('id', String(b.id)).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}
