import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const VALID_STATUS = ['pending', 'sent', 'responded', 'not_interested', 'converted'];

// GET — list opportunities (with borrower names) + summary stats.
export async function GET(): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { data, error } = await sb
    .from('refi_opportunities')
    .select('*, leads(first_name, last_name)')
    .eq('org_id', org.id)
    .order('monthly_savings', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const opps = data ?? [];
  const totalMonthly = opps.reduce((sum, o) => sum + (Number(o.monthly_savings) || 0), 0);
  const sent = opps.filter((o) => o.outreach_status !== 'pending').length;
  const avgSpread = opps.length ? opps.reduce((s, o) => s + (Number(o.rate_spread) || 0), 0) / opps.length : 0;

  return NextResponse.json({
    opportunities: opps,
    stats: {
      total: opps.length,
      totalMonthlySavings: totalMonthly,
      avgSpread: Math.round(avgSpread * 1000) / 1000,
      sent,
    },
  });
}

// POST — update an opportunity's outreach status.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { opportunity_id, status } = (await req.json()) as { opportunity_id: string; status: string };
  if (!opportunity_id || !VALID_STATUS.includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { error } = await sb
    .from('refi_opportunities')
    .update({ outreach_status: status })
    .eq('id', opportunity_id)
    .eq('org_id', org.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
