/**
 * Phase 34.5 — Campaign Manager data: library templates + the org's own
 * campaigns + headline stats.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const [{ data: library }, { data: mine }, { count: enrolledActive }, { count: sendsMonth }] = await Promise.all([
    sb.from('campaigns').select('id, name, type, category, description, total_steps').eq('is_library_template', true).order('category'),
    sb.from('campaigns').select('id, name, type, category, status, total_steps, enrolled_count, created_at').eq('org_id', orgId).eq('is_library_template', false).order('created_at', { ascending: false }),
    sb.from('campaign_enrollments').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active'),
    sb.from('campaign_step_sends').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('sent_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
  ]);

  const activeCampaigns = (mine ?? []).filter((c) => c.status === 'active').length;

  return NextResponse.json({
    library: library ?? [],
    mine: mine ?? [],
    stats: {
      active_campaigns: activeCampaigns,
      enrolled_leads: enrolledActive ?? 0,
      sends_30d: sendsMonth ?? 0,
    },
  });
}
