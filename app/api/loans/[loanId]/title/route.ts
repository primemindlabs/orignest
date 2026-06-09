/**
 * Phase 64.1 — LO-side title management.
 *   GET   → active portal token + documents + wire status
 *   POST  → invite a title company (creates a 30-day token; returns the portal URL)
 *   PATCH → verify wire instructions by phone (required before use) / revoke token
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const [{ data: token }, { data: docs }, { data: wires }] = await Promise.all([
    sb.from('title_portal_tokens').select('id, token, title_company_name, title_agent_name, title_agent_email, sent_at, expires_at, is_revoked').eq('org_id', orgId).eq('loan_id', params.loanId).eq('is_revoked', false).order('sent_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('title_documents').select('id, doc_type, doc_name, uploaded_by_name, uploaded_at, storage_path').eq('org_id', orgId).eq('loan_id', params.loanId).order('uploaded_at', { ascending: false }),
    sb.from('wire_instructions').select('id, account_last4, received_at, verified_at, verification_method, change_flag, change_flag_reason').eq('org_id', orgId).eq('loan_id', params.loanId).order('received_at', { ascending: false }),
  ]);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return NextResponse.json({ token: token ? { ...token, url: `${base}/title-portal/${token.token}` } : null, documents: docs ?? [], wires: wires ?? [] });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { title_company_name?: string; title_agent_name?: string; title_agent_email?: string };
  if (!b.title_company_name) return NextResponse.json({ error: 'title_company_name required' }, { status: 400 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const { data, error } = await sb.from('title_portal_tokens').insert({ org_id: orgId, loan_id: params.loanId, title_company_name: b.title_company_name, title_agent_name: b.title_agent_name ?? null, title_agent_email: b.title_agent_email ?? null, created_by: profile?.id ?? null }).select('token').single();
  if (error || !data) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return NextResponse.json({ url: `${base}/title-portal/${data.token}` });
}

export async function PATCH(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { wire_id?: string; verification_method?: string; verification_notes?: string; revoke_token_id?: string };
  const sb = createAdminClient();
  if (b.revoke_token_id) { await sb.from('title_portal_tokens').update({ is_revoked: true }).eq('id', b.revoke_token_id).eq('org_id', orgId); return NextResponse.json({ ok: true }); }
  if (!b.wire_id) return NextResponse.json({ error: 'wire_id required' }, { status: 400 });
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  await sb.from('wire_instructions').update({ verified_by: profile?.id ?? null, verified_at: new Date().toISOString(), verification_method: b.verification_method ?? 'phone_callback', verification_notes: b.verification_notes ?? null, change_flag: false }).eq('id', b.wire_id).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}
