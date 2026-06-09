/**
 * Phase 51.3 — AE Book of Business: broker accounts.
 *   GET  ?mine=1 → brokers assigned to me (else all org brokers). Health derived
 *                  live from last_submission_at.
 *   POST          → add a broker account (assigned to me by default)
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APPROVAL = ['pending', 'approved', 'suspended', 'terminated', 'do_not_approve'];

function health(lastSubmission: string | null): string {
  if (!lastSubmission) return 'new';
  const days = Math.floor((Date.now() - new Date(lastSubmission).getTime()) / 86_400_000);
  if (days <= 14) return 'active';
  if (days <= 45) return 'at_risk';
  return 'dormant';
}

async function myId(sb: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  return data?.id ?? null;
}

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  let q = sb.from('broker_accounts').select('*').eq('org_id', orgId).order('last_submission_at', { ascending: false, nullsFirst: false }).limit(500);
  if (new URL(req.url).searchParams.get('mine') === '1') {
    const pid = await myId(sb, userId);
    q = q.eq('assigned_ae_id', pid ?? '00000000-0000-0000-0000-000000000000');
  }
  const { data } = await q;
  const brokers = (data ?? []).map((b) => ({ ...b, relationship_health: health(b.last_submission_at) }));
  return NextResponse.json({ brokers });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.company_name) return NextResponse.json({ error: 'company_name required' }, { status: 400 });
  const sb = createAdminClient();
  const pid = await myId(sb, userId);
  const { data, error } = await sb.from('broker_accounts').insert({
    org_id: orgId, assigned_ae_id: b.assigned_ae_id ? String(b.assigned_ae_id) : pid,
    company_name: String(b.company_name), nmls_company_id: b.nmls_company_id ? String(b.nmls_company_id) : null,
    address_state: b.address_state ? String(b.address_state).toUpperCase().slice(0, 2) : null,
    approval_status: APPROVAL.includes(String(b.approval_status)) ? String(b.approval_status) : 'pending',
    top_loan_types: Array.isArray(b.top_loan_types) ? (b.top_loan_types as string[]) : null,
    relationship_notes: b.relationship_notes ? String(b.relationship_notes) : null,
    competitive_notes: b.competitive_notes ? String(b.competitive_notes) : null,
    relationship_health: 'new',
  }).select('*').single();
  if (error) { console.error('[broker-accounts]', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }
  return NextResponse.json({ broker: data });
}
