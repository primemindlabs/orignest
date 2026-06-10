import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CATEGORIES = ['income', 'credit', 'assets', 'property', 'title', 'insurance', 'other'];
const PRIORITIES = ['standard', 'prior_to_docs', 'prior_to_funding', 'prior_to_closing'];
const STATUSES = ['issued', 'submitted', 'received', 'under_review', 'cleared', 'suspended'];

async function resolveLead(orgId: string, leadId: string) {
  const sb = createAdminClient();
  const { data } = await sb.from('leads').select('id').eq('id', leadId).eq('org_id', orgId).maybeSingle();
  return data;
}

export async function GET(_req: NextRequest, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb
    .from('loan_conditions')
    .select('id, condition_text, category, priority, status, due_date, created_at, is_agent_visible')
    .eq('lead_id', params.loanId).eq('org_id', orgId)
    .order('created_at', { ascending: true });
  return NextResponse.json({ conditions: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  if (!(await resolveLead(orgId, params.loanId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const text = typeof body.condition_text === 'string' ? body.condition_text.trim() : '';
  if (!text) return NextResponse.json({ error: 'condition_text required' }, { status: 422 });
  const category = CATEGORIES.includes(body.category as string) ? body.category : 'other';
  const priority = PRIORITIES.includes(body.priority as string) ? body.priority : 'standard';

  const sb = createAdminClient();
  const { data, error } = await sb.from('loan_conditions').insert({
    org_id: orgId, lead_id: params.loanId, condition_text: text, category, priority, status: 'issued',
  }).select('id, condition_text, category, priority, status, due_date, created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ condition: data }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  let body: { id?: string; status?: string; agent_visible?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 422 });

  const sb = createAdminClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.agent_visible === 'boolean') {
    // A4 — agent/borrower-portal visibility toggle.
    update.is_agent_visible = body.agent_visible;
  } else if (STATUSES.includes(body.status ?? '')) {
    update.status = body.status;
    if (body.status === 'cleared') update.cleared_at = new Date().toISOString();
  } else {
    return NextResponse.json({ error: 'valid status or agent_visible required' }, { status: 422 });
  }
  const { data, error } = await sb.from('loan_conditions')
    .update(update).eq('id', body.id).eq('lead_id', params.loanId).eq('org_id', orgId)
    .select('id, status, is_agent_visible').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ condition: data });
}
