import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';
import { buildPositions } from '@/lib/equity/calc';
import EquityClient from './EquityClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Equity Tracker' };

export default async function EquityPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();

  // Closed loans with enough data to estimate equity. loanBalance uses the
  // original funded amount as a conservative proxy (amortization isn't tracked
  // yet); estimatedValue is the value on file.
  const { data: leads } = await sb
    .from('leads')
    .select('id, first_name, last_name, estimated_value, original_loan_amount, loan_amount, property_city, property_state')
    .eq('org_id', orgId)
    .eq('stage', 'closed');

  const rows = (leads ?? [])
    .map((l) => {
      const value = Number(l.estimated_value) || 0;
      const balance = Number(l.original_loan_amount) || Number(l.loan_amount) || 0;
      return {
        id: l.id as string,
        name: `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || '(unnamed)',
        location: [l.property_city, l.property_state].filter(Boolean).join(', '),
        estimatedValue: value,
        loanBalance: balance,
      };
    })
    .filter((r) => r.estimatedValue > 0 && r.loanBalance > 0);

  const locationById: Record<string, string> = {};
  for (const r of rows) locationById[r.id] = r.location;

  const { positions, totals } = buildPositions(rows);

  return (
    <EquityClient
      positions={positions.map((p) => ({ ...p, location: locationById[p.id] ?? '' }))}
      totals={totals}
    />
  );
}
