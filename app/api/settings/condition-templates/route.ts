import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CATEGORIES = ['income', 'credit', 'assets', 'property', 'title', 'insurance', 'other'];
const PRIORITIES = ['standard', 'prior_to_docs', 'prior_to_funding', 'prior_to_closing'];
const PHASES = ['processing', 'underwriting', 'closing', 'post_closing'];

// GET /api/settings/condition-templates — platform defaults + this org's custom templates.
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();
  const { data } = await sb
    .from('condition_templates')
    .select('id, org_id, loan_program, condition_text, category, priority, phase, display_order')
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .order('loan_program', { ascending: true })
    .order('display_order', { ascending: true });

  return NextResponse.json({
    templates: (data ?? []).map((t) => ({ ...t, is_custom: !!t.org_id })),
  });
}

// POST /api/settings/condition-templates — add a custom org template (admins only).
export async function POST(req: NextRequest) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can add templates.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const loanProgram = str(body.loan_program);
  const conditionText = str(body.condition_text);
  if (!loanProgram || !conditionText) {
    return NextResponse.json({ error: 'Loan program and condition text are required.' }, { status: 422 });
  }

  const category = CATEGORIES.includes(str(body.category)) ? str(body.category) : 'other';
  const priority = PRIORITIES.includes(str(body.priority)) ? str(body.priority) : 'standard';
  const phase = PHASES.includes(str(body.phase)) ? str(body.phase) : 'processing';

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('condition_templates')
    .insert({
      org_id: orgId,
      loan_program: loanProgram,
      condition_text: conditionText,
      category,
      priority,
      phase,
      is_default: false,
      display_order: 100,
    })
    .select('id, org_id, loan_program, condition_text, category, priority, phase, display_order')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: { ...data, is_custom: true } }, { status: 201 });
}

// DELETE /api/settings/condition-templates?id=<uuid> — remove a custom org template.
// Platform defaults (org_id NULL) cannot be deleted; the org filter guarantees it.
export async function DELETE(req: NextRequest) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can delete templates.' }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing template id.' }, { status: 422 });

  const sb = createAdminClient();
  const { error } = await sb
    .from('condition_templates')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
