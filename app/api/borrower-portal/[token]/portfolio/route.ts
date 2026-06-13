// Phase 123 — Real Estate Portfolio (token-gated) for investor/DSCR borrowers.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePortalToken } from '@/lib/portal/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const id = await resolvePortalToken(sb, params.token);
  if (!id) return NextResponse.json({ error: 'Invalid portal link' }, { status: 404 });

  const { data: properties } = await sb
    .from('borrower_properties')
    .select('*')
    .eq('lead_id', id.leadId)
    .eq('org_id', id.orgId)
    .order('is_primary_residence', { ascending: false });

  const list = properties ?? [];
  const totals = list.reduce(
    (acc, p) => ({
      value: acc.value + Number(p.current_value ?? 0),
      balance: acc.balance + Number(p.mortgage_balance ?? 0),
      cash_flow: acc.cash_flow + Number(p.monthly_cash_flow ?? 0),
    }),
    { value: 0, balance: 0, cash_flow: 0 },
  );

  return NextResponse.json({ properties: list, totals: { ...totals, equity: totals.value - totals.balance } });
}
