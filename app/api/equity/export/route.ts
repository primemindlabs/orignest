import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildPositions } from '@/lib/equity/calc';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET /api/equity/export — annual equity & cash-out report CSV for the book. */
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();
  const { data: leads } = await sb
    .from('leads')
    .select('id, first_name, last_name, estimated_value, original_loan_amount, loan_amount, property_city, property_state')
    .eq('org_id', orgId)
    .eq('stage', 'closed');

  const rows = (leads ?? [])
    .map((l) => ({
      id: l.id as string,
      name: `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || '(unnamed)',
      location: [l.property_city, l.property_state].filter(Boolean).join(', '),
      estimatedValue: Number(l.estimated_value) || 0,
      loanBalance: Number(l.original_loan_amount) || Number(l.loan_amount) || 0,
    }))
    .filter((r) => r.estimatedValue > 0 && r.loanBalance > 0);

  const locById: Record<string, string> = {};
  for (const r of rows) locById[r.id] = r.location;
  const { positions } = buildPositions(rows);

  const headers = ['Borrower', 'Location', 'Home Value', 'Loan Balance', 'Equity', 'LTV %', 'Available Cash-Out (80%)', 'Opportunity Tier', 'Score'];
  const lines = [headers.map(csvCell).join(',')];
  for (const p of positions) {
    lines.push([
      p.name, locById[p.id] ?? '', p.estimatedValue, p.loanBalance, p.equity, p.ltv, p.cashOut, p.tier, p.score,
    ].map(csvCell).join(','));
  }

  const csv = lines.join('\n') + '\n';
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="equity-report-${new Date().getFullYear()}.csv"`,
    },
  });
}
