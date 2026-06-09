/**
 * Phase 55.4 — doc stacking. GET returns this loan's condition documents + the
 * Fannie default template + the latest stack. POST merges the given document order
 * into a single PDF SERVER-SIDE (pdf-lib), uploads it, and returns a 15-min signed
 * URL. Non-PDF files are skipped (and reported). Merge never runs client-side.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { PDFDocument } from 'pdf-lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const BUCKET = 'borrower-docs';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const [{ data: docs }, { data: tmpl }, { data: stack }] = await Promise.all([
    sb.from('condition_documents').select('id, file_name, mime_type, is_included_in_submission, created_at').eq('lead_id', params.loanId).eq('org_id', orgId).order('created_at'),
    sb.from('doc_stacking_templates').select('template_name, stack_order').or(`org_id.is.null,org_id.eq.${orgId}`).eq('loan_type', 'conventional_fannie').limit(1).maybeSingle(),
    sb.from('doc_stacks').select('id, name, document_order, merged_at').eq('lead_id', params.loanId).eq('org_id', orgId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  return NextResponse.json({ documents: docs ?? [], template: tmpl ?? null, latest_stack: stack ?? null });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { document_order?: string[]; name?: string };
  const order = Array.isArray(b.document_order) ? b.document_order : [];
  if (order.length === 0) return NextResponse.json({ error: 'document_order required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: docs } = await sb.from('condition_documents').select('id, storage_path, mime_type, file_name').eq('lead_id', params.loanId).eq('org_id', orgId).in('id', order);
  const byId = new Map((docs ?? []).map((d) => [d.id, d]));

  const merged = await PDFDocument.create();
  const skipped: string[] = [];
  for (const id of order) {
    const d = byId.get(id);
    if (!d) continue;
    if (!(d.mime_type ?? '').includes('pdf') && !(d.storage_path ?? '').toLowerCase().endsWith('.pdf')) { skipped.push(d.file_name); continue; }
    const { data: file, error } = await sb.storage.from(BUCKET).download(d.storage_path);
    if (error || !file) { skipped.push(d.file_name); continue; }
    try {
      const src = await PDFDocument.load(await file.arrayBuffer());
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    } catch { skipped.push(d.file_name); }
  }
  if (merged.getPageCount() === 0) return NextResponse.json({ error: 'No PDF pages to merge', skipped }, { status: 400 });

  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const bytes = await merged.save();
  const key = `doc-stacks/${params.loanId}/${Date.now()}-merged.pdf`;
  const up = await sb.storage.from(BUCKET).upload(key, bytes, { contentType: 'application/pdf', upsert: true });
  if (up.error) { console.error('[doc-stack]', up.error); return NextResponse.json({ error: 'upload_failed' }, { status: 500 }); }

  await sb.from('doc_stacks').insert({ org_id: orgId, lead_id: params.loanId, name: b.name ?? 'Initial UW Submission', document_order: order, merged_pdf_url: key, merged_at: new Date().toISOString(), created_by: profile?.id ?? null });
  const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(key, 900);
  return NextResponse.json({ url: signed?.signedUrl ?? null, page_count: merged.getPageCount(), skipped });
}
