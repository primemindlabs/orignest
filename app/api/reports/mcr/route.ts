/**
 * Phase 149 — GET /api/reports/mcr?year=YYYY&quarter=1..4[&format=csv]
 * NMLS Mortgage Call Report (RMLA) worksheet. Admin/branch-manager only.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeMcr, mcrToCsv } from '@/lib/reports/mcr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN = new Set(['admin', 'branch_manager']);

export async function GET(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!ADMIN.has(role)) return NextResponse.json({ error: 'Only admins can run the MCR' }, { status: 403 });

  const url = new URL(req.url);
  const now = new Date();
  const year = Number(url.searchParams.get('year')) || now.getFullYear();
  const quarter = Math.min(4, Math.max(1, Number(url.searchParams.get('quarter')) || (Math.floor(now.getUTCMonth() / 3) + 1)));

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('name').eq('id', orgId).maybeSingle();
  const report = await computeMcr(sb, orgId, year, quarter);

  if (url.searchParams.get('format') === 'csv') {
    const csv = mcrToCsv(report, (org as { name?: string } | null)?.name ?? 'Institution');
    return new NextResponse(csv, {
      status: 200,
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="mcr-${year}-Q${quarter}.csv"` },
    });
  }
  return NextResponse.json({ report });
}
