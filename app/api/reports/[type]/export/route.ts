import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runReport, ALLOWED_REPORT_TYPES, type ReportType } from '@/lib/reports';

export const dynamic = 'force-dynamic';

const MANAGER_ONLY: ReportType[] = ['pl', 'compliance', 'hmda'];

// Flattens a report's primary row collection into CSV.
function toCsv(type: ReportType, data: Record<string, any>): string {
  let rows: Record<string, unknown>[] = [];
  if (type === 'production') rows = data.byLo ?? [];
  else if (type === 'referral') rows = data.rows ?? [];
  else if (type === 'scorecard') rows = data.rows ?? [];
  else if (type === 'velocity') rows = [data];
  else if (type === 'compliance') rows = data.flags ?? [];
  else if (type === 'pl') rows = data.available ? [data.totals] : [{ note: data.note }];
  else if (type === 'hmda') rows = data.available ? (data.applications ?? []) : [{ note: data.note }];
  if (!rows.length) return 'no data\n';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n') + '\n';
}

export async function GET(req: NextRequest, { params }: { params: { type: string } }): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const type = params.type as ReportType;
  if (!ALLOWED_REPORT_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('id, name').eq('clerk_org_id', orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });
  const { data: profile } = await sb.from('profiles').select('id, role').eq('clerk_user_id', userId).eq('org_id', org.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const isLO = profile.role === 'loan_officer' || profile.role === 'processor';
  if (isLO && type !== 'scorecard') return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  if (MANAGER_ONLY.includes(type) && isLO) return NextResponse.json({ error: 'Manager-only report' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const end = searchParams.get('end') ?? new Date().toISOString().slice(0, 10);
  const loId = isLO ? (profile.id as string) : searchParams.get('lo_id');

  const data = await runReport(sb, type, org.id as string, start, end, loId);
  const header = `${org.name} — ${type.toUpperCase()} Report,${start} to ${end},generated ${new Date().toISOString()}\n`;
  const csv = header + toCsv(type, data as Record<string, any>);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${type}-report-${start}-to-${end}.csv"`,
    },
  });
}
