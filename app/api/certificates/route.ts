/**
 * Phase 52.1 — pre-approval certificates.
 *   GET  ?lead_id= → certs for a lead (LO view)
 *   POST           → generate (returns the shareable /certificate/<rawToken> URL once)
 *   PATCH          → revoke (body.id)
 * Token: random 32 bytes; only SHA-256(token) stored. White-label LO snapshot. No SSN/DOB.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomBytes, createHash } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const leadId = new URL(req.url).searchParams.get('lead_id');
  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });
  const sb = createAdminClient();
  const { data } = await sb.from('pre_approval_certificates').select('id, approved_amount, loan_type, expiration_date, is_revoked, view_count, created_at').eq('org_id', orgId).eq('lead_id', leadId).order('created_at', { ascending: false });
  return NextResponse.json({ certificates: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { lead_id?: string; approved_amount?: number; loan_type?: string; property_type?: string; expiration_date?: string };
  if (!b.lead_id || !b.approved_amount || !b.loan_type || !b.expiration_date) {
    return NextResponse.json({ error: 'lead_id, approved_amount, loan_type and expiration_date are required' }, { status: 400 });
  }
  const sb = createAdminClient();
  const [{ data: lead }, { data: profile }, { data: org }] = await Promise.all([
    sb.from('leads').select('id').eq('id', b.lead_id).eq('org_id', orgId).maybeSingle(),
    sb.from('profiles').select('id, first_name, last_name, nmls_id, phone, email, avatar_url').eq('clerk_user_id', userId).maybeSingle(),
    sb.from('organizations').select('name, nmls_company_id').eq('id', orgId).maybeSingle(),
  ]);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const token = randomBytes(32).toString('hex');
  const { error } = await sb.from('pre_approval_certificates').insert({
    org_id: orgId, lead_id: b.lead_id, token_hash: sha256(token),
    approved_amount: b.approved_amount, loan_type: b.loan_type, property_type: b.property_type ?? null, expiration_date: b.expiration_date,
    lo_name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Your Loan Officer',
    lo_nmls: profile?.nmls_id ?? null, company_name: org?.name ?? 'Your Company', company_nmls: org?.nmls_company_id ?? null,
    lo_phone: profile?.phone ?? null, lo_email: profile?.email ?? null, lo_headshot_url: profile?.avatar_url ?? null,
    created_by: profile?.id ?? null,
  });
  if (error) { console.error('[certificates]', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }

  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/certificate/${token}`;
  return NextResponse.json({ url });
}

export async function PATCH(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; revoked_reason?: string };
  if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const sb = createAdminClient();
  await sb.from('pre_approval_certificates').update({ is_revoked: true, revoked_at: new Date().toISOString(), revoked_reason: b.revoked_reason ?? null }).eq('id', b.id).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}
