/**
 * Phase 42.4 — Demo Mode: seed a sample pipeline so a new tenant sees the product
 * full. All rows flagged is_demo (bulk-removable, excluded from billing/usage).
 * Stages use the REAL leads.stage values.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEMO = [
  { first_name: 'James', last_name: 'Carter', email: 'demo+james@ashleyiq.com', phone: '+14045550101', loan_purpose: 'purchase', loan_amount: 385000, stage: 'processing', loan_type: 'conventional', notes: 'W-2 borrower, 740 FICO, closing in 18 days', closing_in: 18 },
  { first_name: 'Maria', last_name: 'Gonzalez', email: 'demo+maria@ashleyiq.com', phone: '+14045550102', loan_purpose: 'refinance', loan_amount: 290000, stage: 'underwriting', loan_type: 'fha', notes: 'Refi to lower rate. Needs W2 still.' },
  { first_name: 'Tyler', last_name: 'Brooks', email: 'demo+tyler@ashleyiq.com', phone: '+14045550103', loan_purpose: 'purchase', loan_amount: 620000, stage: 'conditional_approval', loan_type: 'jumbo', notes: 'CTC target next week. 3 conditions outstanding.' },
  { first_name: 'Dana', last_name: 'Kim', email: 'demo+dana@ashleyiq.com', phone: '+14045550104', loan_purpose: 'investment', loan_amount: 410000, stage: 'application', loan_type: 'dscr', notes: 'DSCR 0.92. Needs scenario match.' },
  { first_name: 'Robert', last_name: 'Wells', email: 'demo+robert@ashleyiq.com', phone: '+14045550105', loan_purpose: 'purchase', loan_amount: 275000, stage: 'clear_to_close', loan_type: 'va', notes: 'Closing in 3 days. Celebrating soon!', closing_in: 3 },
  { first_name: 'Sarah', last_name: 'Mitchell', email: 'demo+sarah@ashleyiq.com', phone: '+14045550106', loan_purpose: 'purchase', loan_amount: 340000, stage: 'new_inquiry', loan_type: 'conventional', notes: 'First-time buyer. Just starting.' },
];

export async function POST() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

  // Idempotent: clear any prior demo rows for this org first.
  await sb.from('leads').delete().eq('org_id', orgId).eq('is_demo', true);

  const rows = DEMO.map((d) => ({
    org_id: orgId,
    assigned_to: profile?.id ?? null,
    first_name: d.first_name, last_name: d.last_name, email: d.email, phone: d.phone,
    loan_purpose: d.loan_purpose, loan_amount: d.loan_amount, loan_type: d.loan_type,
    stage: d.stage, lead_source: 'demo', data_ownership: 'company_generated',
    is_demo: true,
    closing_date: d.closing_in ? new Date(Date.now() + d.closing_in * 86_400_000).toISOString().slice(0, 10) : null,
  }));
  const { data, error } = await sb.from('leads').insert(rows).select('id');
  if (error) {
    console.error('[demo seed] failed', error);
    return NextResponse.json({ error: 'seed_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, created: data?.length ?? 0 });
}
