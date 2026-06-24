/**
 * Phase 143 — wholesale rate lock for one loan ([loanId] = lead id).
 *   GET  → this loan's lock history
 *   POST → request a lock / extension / float-down / cancel at a lender connection
 * Gated-safe: no live lock endpoint records the request and returns { gated: true }.
 *
 * This is the OUTBOUND lock at the wholesale lender — distinct from the internal
 * rate_lock_requests approval queue (P52/P104).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { requestLockWithLender } from '@/lib/lenders/submission/lock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ACTIONS = ['lock', 'extend', 'relock', 'float_down', 'cancel'];
const LIST_COLS = 'id, lender_name, action, product_name, requested_rate, requested_price, lock_period_days, locked_rate, locked_price, lock_number, lock_expiration, status, external_status, error_message, created_at, confirmed_at';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data } = await sb.from('loan_locks').select(LIST_COLS).eq('org_id', orgId).eq('lead_id', params.loanId).order('created_at', { ascending: false });
  return NextResponse.json({ locks: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, any>;
  if (!b.connection_id) return NextResponse.json({ error: 'connection_id is required' }, { status: 400 });
  const action = String(b.action ?? 'lock');
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) && v !== '' && v != null ? n : null; };
  const sb = createAdminClient();
  const { data: prof } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

  const outcome = await requestLockWithLender(orgId, params.loanId, String(b.connection_id), prof?.id ?? null, {
    action: action as 'lock' | 'extend' | 'relock' | 'float_down' | 'cancel',
    productName: b.product_name ? String(b.product_name) : null,
    requestedRate: num(b.requested_rate),
    requestedPrice: num(b.requested_price),
    lockPeriodDays: num(b.lock_period_days),
  });
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json({ ok: true, gated: outcome.gated, lock: outcome.lock });
}
