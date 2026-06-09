/**
 * Phase 34.5 — campaign detail (steps + enrollment stats) and status changes.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: campaign } = await sb.from('campaigns').select('*').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [{ data: steps }, { count: active }, { count: completed }, { count: sends }] = await Promise.all([
    sb.from('campaign_steps').select('step_number, delay_days, delay_hours, channel, subject, body, ai_personalize').eq('campaign_id', params.id).order('step_number'),
    sb.from('campaign_enrollments').select('id', { count: 'exact', head: true }).eq('campaign_id', params.id).eq('status', 'active'),
    sb.from('campaign_enrollments').select('id', { count: 'exact', head: true }).eq('campaign_id', params.id).eq('status', 'completed'),
    sb.from('campaign_step_sends').select('id', { count: 'exact', head: true }).eq('campaign_id', params.id),
  ]);

  return NextResponse.json({ campaign, steps: steps ?? [], stats: { active: active ?? 0, completed: completed ?? 0, sends: sends ?? 0 } });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const { status } = (await req.json().catch(() => ({}))) as { status?: string };
  if (!['draft', 'active', 'paused', 'archived'].includes(status ?? '')) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

  const sb = createAdminClient();
  const { error } = await sb.from('campaigns').update({ status, updated_at: new Date().toISOString() }).eq('id', params.id).eq('org_id', orgId).eq('is_library_template', false);
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
