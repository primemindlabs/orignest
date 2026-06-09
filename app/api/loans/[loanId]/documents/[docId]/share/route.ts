/**
 * Phase 31.4c — document sharing controls (LO-only).
 * PATCH { role: 'borrower'|'coborrower'|'realtor'|'title_agent', share: boolean }
 * Adds/removes a role from documents.visible_to_roles. A realtor can NEVER be
 * granted visibility to a financial document, regardless of request.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHAREABLE_ROLES = ['borrower', 'coborrower', 'realtor', 'title_agent'];
const FINANCIAL_DOC_TYPES = ['paystub', 'w2', 'bank_statement', '1099', 'tax_return', 'credit_report', 'asset_statement', 'income', 'tax', 'bank'];

function isFinancialDoc(documentType: string | null | undefined): boolean {
  const t = (documentType ?? '').toLowerCase();
  return FINANCIAL_DOC_TYPES.some((f) => t.includes(f));
}

export async function PATCH(req: Request, { params }: { params: { loanId: string; docId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { role?: string; share?: boolean };
  if (!body.role || !SHAREABLE_ROLES.includes(body.role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 });

  const sb = createAdminClient();
  const { data: doc } = await sb
    .from('documents')
    .select('id, document_type, visible_to_roles')
    .eq('id', params.docId)
    .eq('lead_id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  // HARD RULE: a realtor can never see a financial document.
  if (body.role === 'realtor' && body.share && isFinancialDoc(doc.document_type)) {
    return NextResponse.json({ error: 'Financial documents can never be shared with realtors.', code: 'financial_doc_blocked' }, { status: 400 });
  }

  const current: string[] = Array.isArray(doc.visible_to_roles) ? doc.visible_to_roles : [];
  const next = body.share ? Array.from(new Set([...current, body.role])) : current.filter((r) => r !== body.role);

  const { error } = await sb.from('documents').update({ visible_to_roles: next }).eq('id', doc.id);
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  return NextResponse.json({ visible_to_roles: next });
}
