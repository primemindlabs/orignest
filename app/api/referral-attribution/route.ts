import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const CONTACTED = ['pre_qualified', 'application_started', 'application_complete', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close', 'closed'];
const PRE_QUALIFIED = CONTACTED;
const APPLIED = ['application_started', 'application_complete', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close', 'closed'];

interface SourceMetrics {
  source: string;
  total_leads: number;
  contacted: number;
  pre_qualified: number;
  applied: number;
  closed: number;
  total_volume: number;
  conversion_rate: number;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const daysParam = searchParams.get('days') ?? '365';
  const allTime = daysParam === 'all';
  const daysBack = parseInt(daysParam, 10) || 365;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  let leadsQuery = sb
    .from('leads')
    .select('id, lead_source, referral_partner_id, stage, estimated_value, first_contacted_at, created_at')
    .eq('org_id', org.id);
  if (!allTime) leadsQuery = leadsQuery.gte('created_at', since);

  const [{ data: leads }, { data: partners }] = await Promise.all([
    leadsQuery,
    sb.from('referral_partners').select('id, first_name, last_name, company_name, email').eq('org_id', org.id),
  ]);

  if (!leads) return NextResponse.json({ sources: [], top_partners: [] });

  const sourceMap: Record<string, SourceMetrics> = {};

  for (const lead of leads) {
    const src = (lead.lead_source as string) || 'unknown';
    if (!sourceMap[src]) {
      sourceMap[src] = { source: src, total_leads: 0, contacted: 0, pre_qualified: 0, applied: 0, closed: 0, total_volume: 0, conversion_rate: 0 };
    }
    const m = sourceMap[src];
    const stage = lead.stage as string;
    m.total_leads++;
    if (lead.first_contacted_at || CONTACTED.includes(stage)) m.contacted++;
    if (PRE_QUALIFIED.includes(stage)) m.pre_qualified++;
    if (APPLIED.includes(stage)) m.applied++;
    if (stage === 'closed') {
      m.closed++;
      m.total_volume += Number(lead.estimated_value) || 0;
    }
  }

  const sources = Object.values(sourceMap)
    .map((s) => ({ ...s, conversion_rate: s.total_leads > 0 ? Math.round((s.closed / s.total_leads) * 100) : 0 }))
    .sort((a, b) => b.closed - a.closed || b.total_leads - a.total_leads);

  // Partner-level breakdown
  const partnerMap: Record<string, {
    partner_id: string; partner_name: string; partner_email: string | null;
    total_leads: number; closed: number; total_volume: number; conversion_rate: number;
  }> = {};

  for (const lead of leads.filter((l) => l.referral_partner_id)) {
    const pid = lead.referral_partner_id as string;
    if (!partnerMap[pid]) {
      const p = partners?.find((x) => x.id === pid);
      const name = p ? (`${p.first_name as string} ${p.last_name as string}`.trim() || (p.company_name as string)) : 'Unknown';
      partnerMap[pid] = { partner_id: pid, partner_name: name, partner_email: (p?.email as string) ?? null, total_leads: 0, closed: 0, total_volume: 0, conversion_rate: 0 };
    }
    partnerMap[pid].total_leads++;
    if (lead.stage === 'closed') {
      partnerMap[pid].closed++;
      partnerMap[pid].total_volume += Number(lead.estimated_value) || 0;
    }
  }

  const top_partners = Object.values(partnerMap)
    .map((p) => ({ ...p, conversion_rate: p.total_leads > 0 ? Math.round((p.closed / p.total_leads) * 100) : 0 }))
    .sort((a, b) => b.total_volume - a.total_volume);

  return NextResponse.json({ sources, top_partners });
}
