/**
 * Stage E — Homeowners Insurance (HOI) verification for one loan ([loanId] = lead id).
 *   GET  → HOI records for this loan
 *   POST → create a new HOI record, or update an existing one when `id` is supplied.
 * Coverage adequacy (dwelling coverage >= loan amount) is computed server-side.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLS = 'id, loan_id, carrier_name, policy_number, agent_name, agent_phone, agent_email, dwelling_coverage_amount, liability_coverage_amount, deductible_amount, effective_date, expiration_date, status, coverage_adequate, notes, verified_at, created_at, updated_at';
const STATUSES = ['pending', 'verified', 'expired', 'insufficient_coverage', 'waived'];

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('hoi_verifications').select(COLS).eq('org_id', orgId).eq('loan_id', params.loanId).order('created_at', { ascending: false });
  return NextResponse.json({ verifications: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, any>;
  const status = STATUSES.includes(b.status) ? b.status : 'pending';
  const num = (v: unknown) => (v === '' || v == null ? null : Number(v));
  const dwelling = num(b.dwelling_coverage_amount);

  const sb = createAdminClient();

  // Coverage adequacy: dwelling coverage must cover the loan amount.
  const { data: lead } = await sb.from('leads').select('loan_amount').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  const loanAmount = lead?.loan_amount != null ? Number(lead.loan_amount) : null;
  const coverageAdequate = dwelling != null && loanAmount != null ? dwelling >= loanAmount : null;

  const row: Record<string, any> = {
    loan_id: params.loanId,
    org_id: orgId,
    carrier_name: b.carrier_name ?? null,
    policy_number: b.policy_number ?? null,
    agent_name: b.agent_name ?? null,
    agent_phone: b.agent_phone ?? null,
    agent_email: b.agent_email ?? null,
    dwelling_coverage_amount: dwelling,
    liability_coverage_amount: num(b.liability_coverage_amount),
    deductible_amount: num(b.deductible_amount),
    effective_date: b.effective_date || null,
    expiration_date: b.expiration_date || null,
    status,
    coverage_adequate: coverageAdequate,
    notes: b.notes ?? null,
    verified_at: status === 'verified' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  if (b.id) {
    const { data, error } = await sb.from('hoi_verifications').update(row).eq('id', b.id).eq('org_id', orgId).select(COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ verification: data });
  }
  const { data, error } = await sb.from('hoi_verifications').insert(row).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ verification: data }, { status: 201 });
}
