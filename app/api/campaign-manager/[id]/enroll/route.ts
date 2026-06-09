/**
 * Phase 34 — enroll leads into a campaign (manual/bulk). One active enrollment
 * per lead per campaign (unique guard). Schedules step 1 by its delay.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const { lead_ids } = (await req.json().catch(() => ({}))) as { lead_ids?: string[] };
  const ids = Array.isArray(lead_ids) ? lead_ids.slice(0, 500) : [];
  if (ids.length === 0) return NextResponse.json({ error: 'lead_ids required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: campaign } = await sb.from('campaigns').select('id').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  // Step 1 delay → first send time.
  const { data: step1 } = await sb.from('campaign_steps').select('delay_days, delay_hours').eq('campaign_id', params.id).eq('step_number', 1).maybeSingle();
  const firstSend = new Date(Date.now() + ((step1?.delay_days ?? 0) * 86_400_000) + ((step1?.delay_hours ?? 0) * 3_600_000)).toISOString();

  const { data: inserted } = await sb
    .from('campaign_enrollments')
    .upsert(
      ids.map((lead_id) => ({ campaign_id: params.id, lead_id, org_id: orgId, enrolled_by: userId, status: 'active', current_step: 1, next_send_at: firstSend })),
      { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true }
    )
    .select('id');

  const enrolled = inserted?.length ?? 0;
  if (enrolled > 0) {
    const { count } = await sb.from('campaign_enrollments').select('id', { count: 'exact', head: true }).eq('campaign_id', params.id).eq('status', 'active');
    await sb.from('campaigns').update({ enrolled_count: count ?? 0 }).eq('id', params.id);
  }

  return NextResponse.json({ enrolled, requested: ids.length });
}
