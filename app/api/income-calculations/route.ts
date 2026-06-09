/**
 * Phase 53 — income calculations (INSERT-only audit).
 *   GET  ?lead_id= → saved calcs for a loan
 *   POST           → compute (server-side, authoritative) + store a new record
 * Recalculate = a new POST (never an update).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateIncome } from '@/lib/income/calculators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES = ['w2_salary', 'w2_hourly', 'self_employed_sole_prop', 'self_employed_scorp', 'self_employed_partnership', 'rental_schedule_e', 'social_security', 'pension', 'bonus_commission', 'other_employment'];

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const leadId = new URL(req.url).searchParams.get('lead_id');
  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
  const sb = createAdminClient();
  const { data } = await sb.from('income_calculations').select('*').eq('org_id', orgId).eq('lead_id', leadId).order('created_at', { ascending: false }).limit(100);
  return NextResponse.json({ calculations: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { lead_id?: string; borrower_type?: string; income_type?: string; agency?: string; input_data?: Record<string, unknown> };
  if (!b.lead_id || !TYPES.includes(b.income_type ?? '') || !['primary', 'co_borrower'].includes(b.borrower_type ?? '')) {
    return NextResponse.json({ error: 'lead_id, valid borrower_type and income_type are required' }, { status: 400 });
  }
  // Server-side authoritative calculation (never trust client math).
  const result = calculateIncome(b.income_type!, b.input_data ?? {});
  if (!result) return NextResponse.json({ error: 'Unsupported income_type' }, { status: 400 });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const { data, error } = await sb.from('income_calculations').insert({
    org_id: orgId, lead_id: b.lead_id, borrower_type: b.borrower_type, income_type: b.income_type,
    agency: ['fannie', 'freddie', 'both', 'fha', 'va'].includes(b.agency ?? '') ? b.agency : 'both',
    input_data: b.input_data ?? {}, calculated_income: Math.round(result.calculated_income * 100) / 100,
    fannie_income: Math.round(result.fannie_income * 100) / 100, freddie_income: Math.round(result.freddie_income * 100) / 100,
    calculation_notes: result.calculation_notes, calculated_by: profile?.id ?? null,
  }).select('*').single();
  if (error) { console.error('[income-calculations]', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }
  return NextResponse.json({ calculation: data });
}
