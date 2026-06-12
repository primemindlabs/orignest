/**
 * Phase 49.7 — documents attached to a specific UW condition.
 *   GET    → list (with short-lived signed download URLs)
 *   POST   → upload (multipart) to the borrower-docs bucket + row
 *   PATCH  → toggle is_included_in_submission (body.document_id, body.included)
 *   DELETE → ?document_id=
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { recalculateLoanIntelligence } from '@/lib/intelligence/recalculateLoanIntelligence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUCKET = 'borrower-docs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('condition_documents').select('*').eq('condition_id', params.id).eq('org_id', orgId).order('created_at', { ascending: false });
  const docs = await Promise.all((data ?? []).map(async (d) => {
    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(d.storage_path, 600);
    return { ...d, url: signed?.signedUrl ?? null };
  }));
  return NextResponse.json({ documents: docs });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: cond } = await sb.from('loan_conditions').select('id, lead_id').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!cond) return NextResponse.json({ error: 'Condition not found' }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `conditions/${params.id}/${Date.now()}_${safe}`;
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (upErr) { console.error('[condition-docs] upload', upErr); return NextResponse.json({ error: 'upload_failed' }, { status: 500 }); }

  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const { data, error } = await sb.from('condition_documents').insert({
    condition_id: params.id, lead_id: cond.lead_id, org_id: orgId, uploaded_by: profile?.id ?? null,
    file_name: file.name, file_size: buf.length, storage_path: path, mime_type: file.type || null, note: (form?.get('note') as string) || null,
  }).select('*').single();
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });

  // Phase 129 — a document upload moves File Intelligence. Best-effort, non-blocking.
  await recalculateLoanIntelligence(sb, cond.lead_id as string, 'document_upload').catch((e) =>
    console.error('[intelligence] document recalc failed', e),
  );

  return NextResponse.json({ document: data });
}

export async function PATCH(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { document_id?: string; included?: boolean };
  if (!b.document_id || typeof b.included !== 'boolean') return NextResponse.json({ error: 'document_id + included required' }, { status: 400 });
  const sb = createAdminClient();
  await sb.from('condition_documents').update({ is_included_in_submission: b.included }).eq('id', b.document_id).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const docId = new URL(req.url).searchParams.get('document_id');
  if (!docId) return NextResponse.json({ error: 'document_id required' }, { status: 400 });
  const sb = createAdminClient();
  const { data: doc } = await sb.from('condition_documents').select('storage_path').eq('id', docId).eq('org_id', orgId).maybeSingle();
  if (doc?.storage_path) await sb.storage.from(BUCKET).remove([doc.storage_path]).then(() => undefined, () => undefined);
  await sb.from('condition_documents').delete().eq('id', docId).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}
