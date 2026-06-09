/**
 * Phase 52.6 — lock desk requests (audit, no DELETE). GET ?lead_id=, POST request,
 * PATCH manager decision (approve/decline).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES = ['new_lock', 'extension', 'renegotiation', 'float_to_lock', 'lock_cancellation'];

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const leadId = new URL(req.url).searchParams.get('lead_id');
  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
  const sb = createAdminClient();
  const { data } = await sb.from('rate_lock_requests').select('*').eq('org_id', orgId).eq('lead_id', leadId).order('created_at', { ascending: false });
  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.lead_id || !TYPES.includes(String(b.request_type))) return NextResponse.json({ error: 'lead_id + valid request_type required' }, { status: 400 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const { data, error } = await sb.from('rate_lock_requests').insert({
    org_id: orgId, lead_id: String(b.lead_id), requested_by: profile?.id ?? null, request_type: String(b.request_type),
    requested_rate: b.requested_rate ? Number(b.requested_rate) : null, requested_lock_days: b.requested_lock_days ? Number(b.requested_lock_days) : null,
    extension_days: b.extension_days ? Number(b.extension_days) : null, extension_cost_bps: b.extension_cost_bps ? Number(b.extension_cost_bps) : null,
    notes: b.notes ? String(b.notes) : null,
  }).select('*').single();
  if (error) { console.error('[rate-lock-requests]', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }
  return NextResponse.json({ request: data });
}

export async function PATCH(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; status?: string; review_notes?: string };
  if (!b.id || !['approved', 'declined', 'cancelled'].includes(b.status ?? '')) return NextResponse.json({ error: 'id + valid status required' }, { status: 400 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  await sb.from('rate_lock_requests').update({ status: b.status, reviewed_by: profile?.id ?? null, reviewed_at: new Date().toISOString(), review_notes: b.review_notes ?? null }).eq('id', b.id).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}
