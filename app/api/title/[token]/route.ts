/**
 * Phase 64.1 — PUBLIC title-portal API (no auth; token-scoped to one loan).
 *   GET  → portal info (property, LO contact, doc statuses). Expired/revoked → {valid:false}.
 *   POST → multipart file upload (doc), OR JSON wire instructions (fraud-guarded).
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { receiveWireInstructions } from '@/lib/title/wireVerification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const BUCKET = 'borrower-docs';

async function resolveToken(token: string) {
  const sb = createAdminClient();
  const { data: t } = await sb.from('title_portal_tokens').select('*').eq('token', token).maybeSingle();
  if (!t || t.is_revoked || new Date(t.expires_at) < new Date()) return null;
  return t;
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const t = await resolveToken(params.token);
  if (!t) return NextResponse.json({ valid: false });
  const sb = createAdminClient();
  await sb.from('title_portal_tokens').update({ last_accessed_at: new Date().toISOString() }).eq('id', t.id);
  const [{ data: lead }, { data: lo }, { data: docs }] = await Promise.all([
    sb.from('leads').select('first_name, last_name, property_address, assigned_to').eq('id', t.loan_id).maybeSingle(),
    Promise.resolve({ data: null }),
    sb.from('title_documents').select('doc_type, uploaded_at').eq('loan_id', t.loan_id).eq('org_id', t.org_id),
  ]);
  let loName = 'Your Loan Officer'; let loPhone: string | null = null; let loEmail: string | null = null;
  if (lead?.assigned_to) { const { data: p } = await sb.from('profiles').select('first_name, last_name, phone, email').eq('id', lead.assigned_to).maybeSingle(); if (p) { loName = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || loName; loPhone = p.phone; loEmail = p.email; } }
  return NextResponse.json({ valid: true, property_address: lead?.property_address ?? null, borrower: `${lead?.first_name ?? ''} ${lead?.last_name ?? ''}`.trim(), lo_name: loName, lo_phone: loPhone, lo_email: loEmail, title_company: t.title_company_name, uploaded: (docs ?? []).map((d) => d.doc_type) });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const t = await resolveToken(params.token);
  if (!t) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 });
  const sb = createAdminClient();
  const ctype = req.headers.get('content-type') ?? '';

  if (ctype.includes('application/json')) {
    // Wire instructions — fraud-guarded, encrypted.
    const b = (await req.json().catch(() => ({}))) as { bank_name?: string; routing_number?: string; account_number?: string; account_name?: string; uploaded_by_name?: string };
    if (!b.routing_number || !b.account_number) return NextResponse.json({ error: 'Routing and account numbers required' }, { status: 400 });
    const result = await receiveWireInstructions(t.org_id, t.loan_id, null, { bank_name: b.bank_name ?? '', routing_number: b.routing_number, account_number: b.account_number, account_name: b.account_name ?? '' });
    await sb.from('title_documents').insert({ org_id: t.org_id, loan_id: t.loan_id, token_id: t.id, doc_type: 'wire_instructions', doc_name: 'Wire Instructions', uploaded_by_name: b.uploaded_by_name ?? t.title_agent_name ?? t.title_company_name });
    return NextResponse.json({ ok: true, fraud_flag: result.fraud_flag, message: 'Received. Your loan officer must verbally confirm these instructions by phone before use.' });
  }

  // Multipart file upload.
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const docType = String(form?.get('doc_type') ?? 'other');
  const uploadedBy = String(form?.get('uploaded_by_name') ?? t.title_agent_name ?? t.title_company_name);
  if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });
  const key = `title-docs/${t.loan_id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
  const up = await sb.storage.from(BUCKET).upload(key, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (up.error) { console.error('[title-upload]', up.error); return NextResponse.json({ error: 'upload_failed' }, { status: 500 }); }
  await sb.from('title_documents').insert({ org_id: t.org_id, loan_id: t.loan_id, token_id: t.id, doc_type: docType, doc_name: file.name, storage_path: key, file_size_bytes: file.size, uploaded_by_name: uploadedBy });
  return NextResponse.json({ ok: true });
}
