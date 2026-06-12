/**
 * Phase 98 — referral source cost entries (per-LO).
 *   GET  → all cost rows for the caller, source_type asc, active_from desc.
 *   POST → create. If an active entry already exists for the same
 *          source_type + source_detail, it is closed (active_to = new active_from
 *          − 1 day) before the new row is inserted, so there's never an overlap.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SOURCE_TYPES = ['realtor', 'zillow', 'meta_ads', 'google_ads', 'referral', 'organic', 'other'];
const PERIODS = ['monthly', 'per_lead', 'one_time'];

async function loId(sb: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const { data } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  return data?.id ?? null;
}

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const me = await loId(sb, userId);
  if (!me) return NextResponse.json({ data: [] });
  const { data } = await sb
    .from('referral_source_costs')
    .select('*')
    .eq('org_id', orgId).eq('lo_id', me)
    .order('source_type', { ascending: true })
    .order('active_from', { ascending: false });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as {
    source_type?: string; source_detail?: string | null; cost_amount?: number;
    cost_period?: string; active_from?: string;
  };
  if (!SOURCE_TYPES.includes(b.source_type ?? '')) return NextResponse.json({ error: 'Invalid source_type' }, { status: 400 });
  if (!PERIODS.includes(b.cost_period ?? '')) return NextResponse.json({ error: 'Invalid cost_period' }, { status: 400 });
  const amount = Number(b.cost_amount);
  if (!isFinite(amount) || amount < 0) return NextResponse.json({ error: 'cost_amount must be ≥ 0' }, { status: 400 });
  const activeFrom = (b.active_from ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(activeFrom)) return NextResponse.json({ error: 'active_from must be a date' }, { status: 400 });

  const sb = createAdminClient();
  const me = await loId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const detail = b.source_detail?.trim() || null;

  // Close any currently-active entry for the same source_type + source_detail.
  let q = sb.from('referral_source_costs').select('id, active_from')
    .eq('org_id', orgId).eq('lo_id', me).eq('source_type', b.source_type).is('active_to', null);
  q = detail === null ? q.is('source_detail', null) : q.eq('source_detail', detail);
  const { data: existing } = await q;
  let closed: string | null = null;
  for (const e of existing ?? []) {
    // active_to must be strictly after active_from (table CHECK). Close at the day
    // before the new entry begins, unless that would precede the old start.
    const dayBefore = new Date(new Date(`${activeFrom}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
    const closeAt = dayBefore > (e.active_from as string) ? dayBefore : activeFrom;
    await sb.from('referral_source_costs').update({ active_to: closeAt }).eq('id', e.id);
    closed = closeAt;
  }

  const { data, error } = await sb.from('referral_source_costs').insert({
    org_id: orgId, lo_id: me,
    source_type: b.source_type, source_detail: detail,
    cost_amount: amount, cost_period: b.cost_period, active_from: activeFrom,
  }).select('*').single();
  if (error) {
    console.error('[referral-costs] insert failed', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  return NextResponse.json({ data, closed_previous_at: closed });
}

/** End an active cost entry (active_to = today). */
export async function PATCH(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: string };
  if (!b.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const sb = createAdminClient();
  const me = await loId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // Guard the CHECK (active_to must be > active_from): end no earlier than the day
  // after it began.
  const { data: row } = await sb.from('referral_source_costs').select('active_from').eq('id', b.id).eq('lo_id', me).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const today = new Date().toISOString().slice(0, 10);
  const endAt = today > (row.active_from as string) ? today : new Date(new Date(`${row.active_from as string}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);

  const { error } = await sb.from('referral_source_costs').update({ active_to: endAt }).eq('id', b.id).eq('org_id', orgId).eq('lo_id', me);
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  return NextResponse.json({ ok: true, active_to: endAt });
}
