import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ROLES = new Set(['admin', 'branch_manager']);

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/commissions/export?form=1099|w2&year=YYYY
 * Per-LO annual compensation summary CSV (net of clawbacks), for 1099/W2
 * preparation. Admin/manager only.
 */
export async function GET(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  if (!ADMIN_ROLES.has(role)) {
    return NextResponse.json({ error: 'Only admins can export tax summaries' }, { status: 403 });
  }

  const url = new URL(req.url);
  const form = url.searchParams.get('form') === 'w2' ? 'W2' : '1099';
  const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const sb = createAdminClient();

  const [{ data: paid }, { data: profiles }, { data: clawbacks }] = await Promise.all([
    sb
      .from('commissions')
      .select('lo_id, compensation_amount, loan_amount, status, payment_date, close_date')
      .eq('org_id', orgId)
      .eq('status', 'paid')
      .gte('close_date', start)
      .lte('close_date', end),
    sb.from('profiles').select('id, first_name, last_name, nmls_id').eq('org_id', orgId),
    sb
      .from('clawback_events')
      .select('lo_id, clawback_amount, event_at')
      .eq('org_id', orgId)
      .gte('event_at', start)
      .lte('event_at', `${end}T23:59:59.999Z`),
  ]);

  type Row = { name: string; nmls: string; loans: number; volume: number; gross: number; clawed: number };
  const byLo = new Map<string, Row>();
  const nameOf = (id: string) => {
    const p = (profiles ?? []).find((x) => x.id === id);
    return p ? { name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '(unnamed)', nmls: (p.nmls_id as string) ?? '' } : { name: '(unknown)', nmls: '' };
  };

  for (const c of paid ?? []) {
    const id = c.lo_id as string;
    const row = byLo.get(id) ?? { ...nameOf(id), loans: 0, volume: 0, gross: 0, clawed: 0 };
    row.loans += 1;
    row.volume += Number(c.loan_amount) || 0;
    row.gross += Number(c.compensation_amount) || 0;
    byLo.set(id, row);
  }
  for (const cb of clawbacks ?? []) {
    const id = cb.lo_id as string;
    const row = byLo.get(id) ?? { ...nameOf(id), loans: 0, volume: 0, gross: 0, clawed: 0 };
    row.clawed += Number(cb.clawback_amount) || 0;
    byLo.set(id, row);
  }

  const header = ['Form', 'Tax Year', 'Loan Officer', 'NMLS ID', 'Loans Closed', 'Total Volume', 'Gross Compensation', 'Clawbacks', 'Net Compensation'];
  const lines = [header.map(csvCell).join(',')];
  for (const row of byLo.values()) {
    const net = Math.round((row.gross - row.clawed) * 100) / 100;
    lines.push(
      [form, year, row.name, row.nmls, row.loans, row.volume.toFixed(2), row.gross.toFixed(2), row.clawed.toFixed(2), net.toFixed(2)]
        .map(csvCell)
        .join(','),
    );
  }

  const csv = lines.join('\n');
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="commissions-${form}-${year}.csv"`,
    },
  });
}
