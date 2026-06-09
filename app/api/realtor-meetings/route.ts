/**
 * Phase 48.10 — realtor meeting/event log + co-marketing cadence.
 *   GET  ?realtor_id= → meetings for a realtor
 *   POST                → log a meeting
 *   PATCH               → set comarketing_cadence on a realtor (+ next due date)
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVENTS = ['coffee', 'open_house', 'industry_event', 'lunch', 'virtual', 'cold_intro', 'referral_intro', 'other'];
const CADENCE: Record<string, number> = { weekly: 7, biweekly: 14, monthly: 30, quarterly: 90 };

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const realtorId = new URL(req.url).searchParams.get('realtor_id');
  if (!realtorId) return NextResponse.json({ error: 'realtor_id required' }, { status: 400 });
  const sb = createAdminClient();
  const { data } = await sb.from('realtor_meetings').select('*').eq('org_id', orgId).eq('realtor_id', realtorId).order('event_date', { ascending: false }).limit(50);
  return NextResponse.json({ meetings: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.realtor_id || !EVENTS.includes(String(b.event_type)) || !b.event_date) {
    return NextResponse.json({ error: 'realtor_id, event_type and event_date are required' }, { status: 400 });
  }
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const { data, error } = await sb.from('realtor_meetings').insert({
    realtor_id: String(b.realtor_id), org_id: orgId, logged_by: profile?.id ?? null,
    event_type: String(b.event_type), event_date: String(b.event_date),
    event_name: b.event_name ? String(b.event_name) : null, notes: b.notes ? String(b.notes) : null, next_step: b.next_step ? String(b.next_step) : null,
  }).select('*').single();
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  // A logged meeting counts as contact — bump last_contact_at.
  await sb.from('realtors').update({ last_contact_at: new Date().toISOString() }).eq('id', String(b.realtor_id)).eq('org_id', orgId);
  return NextResponse.json({ meeting: data });
}

export async function PATCH(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { realtor_id?: string; comarketing_cadence?: string };
  if (!b.realtor_id || !b.comarketing_cadence) return NextResponse.json({ error: 'realtor_id and comarketing_cadence required' }, { status: 400 });
  const days = CADENCE[b.comarketing_cadence];
  const next = days ? new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10) : null;
  const sb = createAdminClient();
  await sb.from('realtors').update({ comarketing_cadence: b.comarketing_cadence, next_comarketing_due_at: next }).eq('id', b.realtor_id).eq('org_id', orgId);
  return NextResponse.json({ ok: true, next_comarketing_due_at: next });
}
