// Phase 123 — Home Wealth Dashboard (token-gated). Latest snapshot + trend series.
// ATTOM is gated: when not configured we seed/serve a manual snapshot from loan data.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePortalToken } from '@/lib/portal/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const id = await resolvePortalToken(sb, params.token);
  if (!id) return NextResponse.json({ error: 'Invalid portal link' }, { status: 404 });

  const { data: series } = await sb
    .from('home_wealth_snapshots')
    .select('home_value, mortgage_balance, equity, monthly_appreciation, net_worth_growth_ytd, data_source, snapshot_date')
    .eq('lead_id', id.leadId)
    .order('snapshot_date', { ascending: true });

  let snapshots = series ?? [];

  // Seed a manual snapshot from loan data if none exists yet (no ATTOM dependency).
  if (snapshots.length === 0) {
    const { data: lead } = await sb.from('leads').select('estimated_value, loan_amount').eq('id', id.leadId).eq('org_id', id.orgId).maybeSingle();
    const homeValue = lead?.estimated_value != null ? Number(lead.estimated_value) : null;
    const balance = lead?.loan_amount != null ? Number(lead.loan_amount) : null;
    if (homeValue != null && balance != null) {
      const { data: seeded } = await sb
        .from('home_wealth_snapshots')
        .insert({ lead_id: id.leadId, org_id: id.orgId, home_value: homeValue, mortgage_balance: balance, data_source: 'manual' })
        .select('home_value, mortgage_balance, equity, monthly_appreciation, net_worth_growth_ytd, data_source, snapshot_date')
        .single();
      if (seeded) snapshots = [seeded];
    }
  }

  const latest = snapshots[snapshots.length - 1] ?? null;
  return NextResponse.json({ latest, series: snapshots });
}
