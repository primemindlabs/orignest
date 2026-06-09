/**
 * Phase 56.1 — live rate quote from the tenant's PPE (Optimal Blue). GATED:
 * returns { gated:true } until a real OB connection exists, so Scenario AI can
 * degrade gracefully to manual entry. Rate data is internal-only.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { fetchOBRates } from '@/lib/integrations/ppe/optimalBlue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { lead_id?: string; loan_amount?: number; property_value?: number; credit_score?: number; loan_type?: string; state?: string };
  if (!b.lead_id || !b.loan_amount || !b.property_value || !b.credit_score) return NextResponse.json({ error: 'lead_id, loan_amount, property_value, credit_score required' }, { status: 400 });

  const result = await fetchOBRates(orgId, { lead_id: b.lead_id, loan_amount: b.loan_amount, property_value: b.property_value, credit_score: b.credit_score, loan_type: b.loan_type, state: b.state });
  if (result.gated) return NextResponse.json({ gated: true, reason: result.reason }, { status: 200 });
  return NextResponse.json({ gated: false, quote: result.quote });
}
