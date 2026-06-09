import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { PERMISSION_TIER_DEFAULTS, type PermissionTier } from '@/lib/portal/realtorPermissions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TIERS: PermissionTier[] = ['status_only', 'transaction_partner', 'full_partner'];

async function resolveLead(orgId: string, leadId: string) {
  const sb = createAdminClient();
  const { data } = await sb.from('leads').select('id').eq('id', leadId).eq('org_id', orgId).maybeSingle();
  return data;
}

// GET — realtors linked to this loan.
export async function GET(_req: NextRequest, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb
    .from('portal_realtors')
    .select('id, realtor_name, realtor_email, realtor_phone, permission_tier, custom_permissions, added_by, approved_by_lo, revoked, token, created_at')
    .eq('lead_id', params.loanId).eq('org_id', orgId)
    .order('created_at', { ascending: false });
  return NextResponse.json({ realtors: data ?? [] });
}

// POST — LO adds a realtor (immediate, no approval step).
export async function POST(req: NextRequest, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  if (!(await resolveLead(orgId, params.loanId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const name = String(body.realtor_name ?? '').trim();
  const email = String(body.realtor_email ?? '').trim().toLowerCase();
  if (!name || !email) return NextResponse.json({ error: 'Name and email required.' }, { status: 422 });
  const tier: PermissionTier = TIERS.includes(body.permission_tier as PermissionTier) ? (body.permission_tier as PermissionTier) : 'status_only';

  const sb = createAdminClient();
  const { data, error } = await sb.from('portal_realtors').insert({
    lead_id: params.loanId, org_id: orgId, added_by: 'lo',
    realtor_name: name, realtor_email: email, realtor_phone: String(body.realtor_phone ?? '') || null,
    permission_tier: tier, custom_permissions: PERMISSION_TIER_DEFAULTS[tier],
    approved_by_lo: true, approved_at: new Date().toISOString(),
  }).select('id, realtor_name, realtor_email, realtor_phone, permission_tier, custom_permissions, added_by, approved_by_lo, revoked, token, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from('portal_realtor_events').insert({ realtor_id: data.id, lead_id: params.loanId, org_id: orgId, event_type: 'invited' });
  return NextResponse.json({ realtor: data }, { status: 201 });
}

// PATCH — set tier / approve a borrower-added realtor / revoke.
export async function PATCH(req: NextRequest, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  let body: { id?: string; permission_tier?: string; revoke?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 422 });

  const sb = createAdminClient();
  const update: Record<string, unknown> = {};
  let eventType: string | null = null;

  if (body.revoke) {
    update.revoked = true; update.revoked_at = new Date().toISOString();
    eventType = 'revoked';
  } else if (body.permission_tier && TIERS.includes(body.permission_tier as PermissionTier)) {
    const tier = body.permission_tier as PermissionTier;
    update.permission_tier = tier;
    update.custom_permissions = PERMISSION_TIER_DEFAULTS[tier];
    update.approved_by_lo = true;
    update.approved_at = new Date().toISOString();
    eventType = 'approved';
  } else {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 422 });
  }

  const { data, error } = await sb.from('portal_realtors')
    .update(update).eq('id', body.id).eq('lead_id', params.loanId).eq('org_id', orgId)
    .select('id, permission_tier, approved_by_lo, revoked').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (eventType) await sb.from('portal_realtor_events').insert({ realtor_id: body.id, lead_id: params.loanId, org_id: orgId, event_type: eventType });
  return NextResponse.json({ realtor: data });
}
