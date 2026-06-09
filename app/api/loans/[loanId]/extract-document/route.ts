/**
 * Phase 30.3 — Document extraction (LO-only).
 *   GET  → recent extractions for this loan
 *   POST → run Textract + Claude on an uploaded doc. GATED: returns 501 until AWS
 *          Textract is configured. When configured, persists a document_extractions
 *          row with confidence + discrepancies vs the current 1003.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractDocumentData, type DocumentType } from '@/lib/ai/documentExtractor';
import { buildDiscrepancies } from '@/lib/ai/fieldMapper';
import { isTextractConfigured, TextractNotConfiguredError } from '@/lib/ai/textract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES: DocumentType[] = ['paystub', 'w2', 'bank_statement', '1099', 'tax_return', 'unknown'];

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb
    .from('document_extractions')
    .select('*')
    .eq('lead_id', params.loanId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(20);
  return NextResponse.json({ extractions: data ?? [], textractConfigured: isTextractConfigured() });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { document_id?: string; storage_path?: string; document_type?: DocumentType };
  const documentType: DocumentType = TYPES.includes(body.document_type as DocumentType) ? (body.document_type as DocumentType) : 'unknown';

  const sb = createAdminClient();

  let storagePath = body.storage_path ?? null;
  let documentId = body.document_id ?? null;
  if (documentId && !storagePath) {
    const { data: doc } = await sb.from('documents').select('storage_path').eq('id', documentId).eq('org_id', orgId).maybeSingle();
    storagePath = doc?.storage_path ?? null;
  }
  if (!storagePath) return NextResponse.json({ error: 'missing_document' }, { status: 400 });

  let extraction;
  try {
    extraction = await extractDocumentData(storagePath, documentType);
  } catch (err) {
    if (err instanceof TextractNotConfiguredError) {
      return NextResponse.json(
        { error: 'textract_unavailable', message: 'Document auto-extraction needs AWS Textract. Configure AWS credentials + S3 bucket to enable it.' },
        { status: 501 }
      );
    }
    console.error('[extract-document] failed', err);
    return NextResponse.json({ error: 'extraction_failed' }, { status: 502 });
  }

  // Discrepancies vs the current 1003.
  const { data: app } = await sb
    .from('loan_applications')
    .select('employment_data, assets_data')
    .eq('lead_id', params.loanId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const discrepancies = buildDiscrepancies(documentType, extraction.fields, {
    employment_data: (app?.employment_data ?? {}) as Record<string, unknown>,
    assets_data: (app?.assets_data ?? {}) as Record<string, unknown>,
  });

  const { data: inserted, error } = await sb
    .from('document_extractions')
    .insert({
      lead_id: params.loanId,
      org_id: orgId,
      document_id: documentId,
      document_type: documentType,
      extracted_fields: extraction.fields,
      confidence: extraction.confidence,
      discrepancies,
    })
    .select('*')
    .single();
  if (error) {
    console.error('[extract-document] insert failed', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  return NextResponse.json({ extraction: inserted });
}
