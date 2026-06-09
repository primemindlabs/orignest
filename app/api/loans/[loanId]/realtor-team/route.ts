/**
 * Phase 31.4b — add a realtor team member under this loan's realtor (LO-only).
 * The team member inherits the parent realtor's permission tier and cannot exceed it.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROLES = ['lead_agent', 'buyers_agent', 'transaction_coordinator', 'assistant'];

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data: realtors } = await sb.from('portal_realtors').select('id').eq('lead_id', params.loanId).eq('org_id', orgId).eq('revoked', false);
  const ids = (realtors ?? []).map((r) => r.id);
  if (ids.length === 0) return NextResponse.json({ members: [] });
  const { data } = await sb.from('portal_realtor_team_members').select('id, full_name, email, role_on_team, token, approved_by_lo, revoked').in('portal_realtor_id', ids);
  return NextResponse.json({ members: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { portal_realtor_id?: string; full_name?: string; email?: string; role_on_team?: string };
  if (!body.full_name || !body.email || !ROLES.includes(body.role_on_team ?? '')) {
    return NextResponse.json({ error: 'full_name, email, and a valid role_on_team are required' }, { status: 400 });
  }

  const sb = createAdminClient();
  // Resolve the parent realtor (explicit id, else the loan's approved realtor).
  const q = sb.from('portal_realtors').select('id').eq('org_id', orgId).eq('revoked', false);
  const { data: parent } = body.portal_realtor_id
    ? await q.eq('id', body.portal_realtor_id).maybeSingle()
    : await q.eq('lead_id', params.loanId).eq('approved_by_lo', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!parent) return NextResponse.json({ error: 'No approved realtor on this loan to add a team member under.' }, { status: 404 });

  const { data: created, error } = await sb
    .from('portal_realtor_team_members')
    .insert({ portal_realtor_id: parent.id, org_id: orgId, full_name: body.full_name, email: body.email, role_on_team: body.role_on_team, approved_by_lo: true })
    .select('token')
    .single();
  if (error) return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 });
  return NextResponse.json({ portal_url: `/portal/realtor/team/${created.token}` });
}
