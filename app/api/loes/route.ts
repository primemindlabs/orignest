/**
 * Phase 62.1 — LOEs.
 *   GET  ?loan_id= → LOEs for a loan
 *   POST           → create + AI-draft an LOE (Haiku), sanitized
 *   PATCH          → save final_text / advance status (draft→…→accepted).
 *                    'sent_for_signature' is gated on the Sign SDK (P60).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateLOEDraft } from '@/lib/loe/aiDraft';
import { isSignConfigured } from '@/lib/sign/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATEGORIES = ['large_deposit', 'credit_inquiry', 'derogatory_credit', 'employment_gap', 'change_of_employment', 'self_employment_income', 'address_discrepancy', 'name_discrepancy', 'gift_funds', 'down_payment_source', 'bankruptcy', 'foreclosure', 'deed_in_lieu', 'short_sale', 'late_payments', 'collections', 'charge_offs', 'judgments', 'rental_income', 'multiple_properties', 'other'];

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const loanId = new URL(req.url).searchParams.get('loan_id');
  if (!loanId) return NextResponse.json({ error: 'loan_id required' }, { status: 400 });
  const sb = createAdminClient();
  const { data } = await sb.from('loes').select('id, category, status, ai_draft_text, final_text, created_at, sign_envelope_id').eq('org_id', orgId).eq('loan_id', loanId).order('created_at', { ascending: false });
  return NextResponse.json({ loes: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI not configured' }, { status: 501 });
  const b = (await req.json().catch(() => ({}))) as { loan_id?: string; category?: string; trigger_details?: Record<string, unknown> };
  if (!b.loan_id || !CATEGORIES.includes(b.category ?? '')) return NextResponse.json({ error: 'loan_id + valid category required' }, { status: 400 });

  const sb = createAdminClient();
  const [{ data: lead }, { data: profile }] = await Promise.all([
    sb.from('leads').select('first_name, last_name').eq('id', b.loan_id).eq('org_id', orgId).maybeSingle(),
    sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle(),
  ]);
  if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  const name = `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || 'Borrower';
  const draft = await generateLOEDraft(b.category!, b.trigger_details ?? {}, name);

  const { data, error } = await sb.from('loes').insert({ org_id: orgId, loan_id: b.loan_id, lo_id: profile?.id ?? null, category: b.category, trigger_details: b.trigger_details ?? null, ai_draft_text: draft, final_text: draft, status: 'draft', created_by: profile?.id ?? null }).select('id, category, status, ai_draft_text, final_text, created_at').single();
  if (error) { console.error('[loes]', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }
  return NextResponse.json({ loe: data });
}

export async function PATCH(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; final_text?: string; status?: string };
  if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  if (b.status === 'sent_for_signature' && !isSignConfigured()) {
    return NextResponse.json({ gated: true, reason: 'E-signature not configured — save the LOE and use wet-ink, or enable PrimeMind Sign.' }, { status: 501 });
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.final_text !== undefined) patch.final_text = b.final_text;
  if (b.status) patch.status = b.status;
  if (b.status === 'submitted_to_uw') patch.submitted_at = new Date().toISOString();
  const sb = createAdminClient();
  await sb.from('loes').update(patch).eq('id', b.id).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}
