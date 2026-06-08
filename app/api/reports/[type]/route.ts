import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runReport, ALLOWED_REPORT_TYPES, type ReportType } from '@/lib/reports';

export const dynamic = 'force-dynamic';

const MANAGER_ONLY: ReportType[] = ['pl', 'compliance', 'hmda'];

export async function GET(req: NextRequest, { params }: { params: { type: string } }): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const type = params.type as ReportType;
  if (!ALLOWED_REPORT_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });
  const { data: profile } = await sb.from('profiles').select('id, role').eq('clerk_user_id', userId).eq('org_id', org.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const isLO = profile.role === 'loan_officer' || profile.role === 'processor';

  // LOs may only view their own scorecard.
  if (isLO && type !== 'scorecard') return NextResponse.json({ error: 'Not authorized for this report' }, { status: 403 });
  if (MANAGER_ONLY.includes(type) && isLO) return NextResponse.json({ error: 'Manager-only report' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const end = searchParams.get('end') ?? new Date().toISOString().slice(0, 10);
  const loId = isLO ? (profile.id as string) : searchParams.get('lo_id');

  const data = await runReport(sb, type, org.id as string, start, end, loId);
  return NextResponse.json({ report: type, start, end, data });
}
