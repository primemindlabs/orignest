// Phase 142 — Product & Pricing Engine: best-execution + anti-steering for a
// scenario, across the LO's rate sheets and any licensed PPE connection.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { priceScenario } from '@/lib/ppe/engine';
import type { PricingScenario } from '@/lib/ppe/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Partial<PricingScenario> & { leadId?: string };
  const loanType = (b.loanType ?? '').toString().toLowerCase();
  const termYears = Number(b.termYears);
  const fico = Number(b.fico);
  const loanAmount = Number(b.loanAmount) || 0;
  const propertyValue = Number(b.propertyValue) || 0;
  // LTV: use given, else derive from loan amount / value.
  const ltv = Number.isFinite(Number(b.ltv)) && Number(b.ltv) > 0
    ? Number(b.ltv)
    : propertyValue > 0 ? (loanAmount / propertyValue) * 100 : 0;

  if (!loanType || !Number.isFinite(termYears) || !Number.isFinite(fico) || ltv <= 0) {
    return NextResponse.json({ error: 'loanType, termYears, fico, and ltv (or loanAmount+propertyValue) are required' }, { status: 400 });
  }

  const scenario: PricingScenario = {
    loanType,
    termYears,
    loanAmount,
    propertyValue,
    ltv: Math.round(ltv * 100) / 100,
    fico,
    loanPurpose: b.loanPurpose ?? null,
    occupancy: b.occupancy ?? null,
    propertyType: b.propertyType ?? null,
    lockDays: Number(b.lockDays) || 30,
    dti: b.dti != null ? Number(b.dti) : null,
    state: b.state ?? null,
  };

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const result = await priceScenario(sb, orgId, profile.id, scenario, { leadId: b.leadId ?? null });
  return NextResponse.json({ scenario, ...result });
}
