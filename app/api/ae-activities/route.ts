/**
 * Phase 51.4 — AE conversation log (INSERT-only). GET ?broker_account_id=,
 * POST log an activity (bumps broker last_contact_at; a 'submission_expected'
 * outcome bumps last_submission_at).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES = ['call_outbound', 'call_inbound', 'email_sent', 'email_received', 'in_person_visit', 'training_session', 'rate_discussion', 'product_update', 'pricing_exception', 'escalation_assist', 'broker_onboarding', 'text_message'];

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const brokerId = new URL(req.url).searchParams.get('broker_account_id');
  if (!brokerId) return NextResponse.json({ error: 'broker_account_id required' }, { status: 400 });
  const sb = createAdminClient();
  const { data } = await sb.from('ae_activities').select('*').eq('org_id', orgId).eq('broker_account_id', brokerId).order('activity_date', { ascending: false }).limit(100);
  return NextResponse.json({ activities: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.broker_account_id || !TYPES.includes(String(b.activity_type)) || !b.notes) {
    return NextResponse.json({ error: 'broker_account_id, activity_type and notes are required' }, { status: 400 });
  }
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const { data, error } = await sb.from('ae_activities').insert({
    broker_account_id: String(b.broker_account_id), org_id: orgId, ae_id: profile?.id ?? null,
    activity_type: String(b.activity_type), outcome: b.outcome ? String(b.outcome) : null,
    duration_minutes: b.duration_minutes ? Number(b.duration_minutes) : null,
    notes: String(b.notes), follow_up_date: b.follow_up_date ? String(b.follow_up_date) : null, follow_up_notes: b.follow_up_notes ? String(b.follow_up_notes) : null,
    competitor_mentioned: b.competitor_mentioned ? String(b.competitor_mentioned) : null,
  }).select('*').single();
  if (error) { console.error('[ae-activities]', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { last_contact_at: now, updated_at: now };
  if (b.outcome === 'submission_expected') patch.last_submission_at = now;
  await sb.from('broker_accounts').update(patch).eq('id', String(b.broker_account_id)).eq('org_id', orgId);
  return NextResponse.json({ activity: data });
}
