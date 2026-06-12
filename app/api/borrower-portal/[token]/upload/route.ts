import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyLoOfPortalEvent } from '@/lib/portal/notifyLoOfPortalEvent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 25 * 1024 * 1024;

// Token-authenticated borrower document upload.
// The portal token IS the auth — no Clerk session here.
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
): Promise<NextResponse> {
  const sb = createAdminClient();

  const { data: portal, error: portalError } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id, expires_at')
    .eq('token', params.token)
    .maybeSingle();

  if (portalError || !portal) {
    return NextResponse.json({ error: 'Invalid portal link' }, { status: 401 });
  }

  if (portal.expires_at && new Date(portal.expires_at as string) < new Date()) {
    return NextResponse.json({ error: 'Portal link has expired' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const documentType = formData.get('document_type') as string | null;
  const documentId = formData.get('document_id') as string | null;

  if (!file || !documentType) {
    return NextResponse.json({ error: 'Missing file or document type' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Only PDF, JPG, PNG, and WEBP files are accepted' },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File must be under 25MB' }, { status: 400 });
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${portal.lead_id as string}/${documentType}/${timestamp}-${safeName}`;
  const fileBuffer = await file.arrayBuffer();

  const { error: storageError } = await sb.storage
    .from('borrower-docs')
    .upload(filePath, fileBuffer, { contentType: file.type, upsert: false });

  if (storageError) {
    console.error('[borrower-upload] Storage error:', storageError.message);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const uploadData = {
    status: 'uploaded' as const,
    file_path: filePath,
    file_name: file.name,
    file_size_bytes: file.size,
    uploaded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (documentId) {
    // Update the existing document_requests row (scoped to this lead).
    const { error: updateError } = await sb
      .from('document_requests')
      .update(uploadData)
      .eq('id', documentId)
      .eq('lead_id', portal.lead_id);

    if (updateError) {
      console.error('[borrower-upload] Update error:', updateError.message);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
  } else {
    // No pre-existing request — create one so the LO sees the upload.
    const label = documentType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const { error: insertError } = await sb.from('document_requests').insert({
      lead_id: portal.lead_id,
      org_id: portal.org_id,
      doc_type: documentType,
      display_name: label,
      ...uploadData,
    });

    if (insertError) {
      console.error('[borrower-upload] Insert error:', insertError.message);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
  }

  // Log activity for the LO timeline (actor_id null = borrower-originated).
  await sb.from('lead_activities').insert({
    lead_id: portal.lead_id,
    org_id: portal.org_id,
    action: 'document_uploaded',
    description: `Borrower uploaded ${file.name}`,
    metadata: { document_type: documentType, file_path: filePath, source: 'borrower_portal' },
  });

  // Ping the assigned LO's notification bell (best-effort).
  await notifyLoOfPortalEvent(sb, {
    orgId: portal.org_id as string,
    leadId: portal.lead_id as string,
    kind: 'doc_uploaded',
    detail: file.name,
  });

  return NextResponse.json({ success: true, file_path: filePath });
}
