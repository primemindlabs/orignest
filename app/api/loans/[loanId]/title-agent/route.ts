/**
 * Phase 31.3 — create/list a title agent for a loan (LO-only).
 *   GET  → title agents on this loan (+ portal link)
 *   POST → create + approve a title agent, returns the portal link
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
  const { data } = await sb
    .from('portal_title_agents')
    .select('id, full_name, company_name, email, token, token_expires_at, approved_by_lo, revoked, created_at')
    .eq('lead_id', params.loanId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  return NextResponse.json({ title_agents: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { full_name?: string; company_name?: string; email?: string; phone?: string };
  if (!body.full_name || !body.company_name || !body.email) {
    return NextResponse.json({ error: 'full_name, company_name, and email are required' }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const { data: created, error } = await sb
    .from('portal_title_agents')
    .insert({
      lead_id: params.loanId,
      org_id: orgId,
      full_name: body.full_name,
      company_name: body.company_name,
      email: body.email,
      phone: body.phone ?? null,
      approved_by_lo: true,
      approved_at: new Date().toISOString(),
    })
    .select('id, token')
    .single();
  if (error) return NextResponse.json({ error: 'Failed to create title agent' }, { status: 500 });

  // Add the title agent to the loan chat thread.
  const { data: thread } = await sb.from('loan_chat_threads').select('id').eq('lead_id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (thread) {
    await sb.from('loan_chat_threads').update({ title_agent_in_thread: true, title_agent_portal_id: created.id }).eq('id', thread.id);
  }

  return NextResponse.json({ id: created.id, portal_url: `/portal/title/${created.token}` });
}
