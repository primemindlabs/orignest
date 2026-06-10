/**
 * Phase 67 — team seat-billing config (branch_manager / admin only).
 *   GET   → org billing mode + per-LO status + both usage buckets (manual / automated)
 *   PATCH → set seat_billing_mode + usage settings
 * Never exposes Stripe customer/subscription IDs to the client.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MGR = ['admin', 'branch_manager', 'manager'];

export async function GET() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!MGR.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sb = createAdminClient();
  const [{ data: org }, { data: lob }, { data: monthAutomated }, { data: monthManual }] = await Promise.all([
    sb.from('organizations').select('seat_billing_mode, usage_billing_enabled, usage_responsibility, included_sms_per_seat, included_voice_minutes_per_seat, overage_sms_price_cents, overage_voice_price_cents').eq('id', orgId).maybeSingle(),
    sb.from('lo_billing').select('user_id, status, branch_covers_seat, branch_covers_usage, current_period_sms_count, current_period_voice_seconds, profiles:user_id(first_name, last_name)').eq('org_id', orgId),
    sb.from('usage_events').select('quantity', { count: 'exact', head: false }).eq('org_id', orgId).eq('source', 'automated'),
    sb.from('usage_events').select('quantity', { count: 'exact', head: false }).eq('org_id', orgId).eq('source', 'manual'),
  ]);
  const los = (lob ?? []).map((l) => { const p = l.profiles as unknown as { first_name?: string; last_name?: string } | null; return { user_id: l.user_id, name: p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : 'LO', status: l.status, branch_covers_seat: l.branch_covers_seat, branch_covers_usage: l.branch_covers_usage, sms: l.current_period_sms_count, voice_minutes: Math.ceil((l.current_period_voice_seconds ?? 0) / 60) }; });
  return NextResponse.json({ config: org, los, buckets: { automated_events: (monthAutomated ?? []).length, manual_events: (monthManual ?? []).length } });
}

export async function PATCH(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!MGR.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (['branch_pays_all', 'lo_pays_seat', 'branch_pays_seat_lo_pays_usage'].includes(b.seat_billing_mode as string)) patch.seat_billing_mode = b.seat_billing_mode;
  if (typeof b.usage_billing_enabled === 'boolean') patch.usage_billing_enabled = b.usage_billing_enabled;
  if (['branch', 'lo'].includes(b.usage_responsibility as string)) patch.usage_responsibility = b.usage_responsibility;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  const sb = createAdminClient();
  await sb.from('organizations').update(patch).eq('id', orgId);
  return NextResponse.json({ ok: true });
}
