// Phase 123 — Closing Vault (token-gated, read-only). Permanent documents; NO delete.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePortalToken } from '@/lib/portal/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const id = await resolvePortalToken(sb, params.token);
  if (!id) return NextResponse.json({ error: 'Invalid portal link' }, { status: 404 });

  const { data: docs } = await sb
    .from('closing_vault_documents')
    .select('id, document_type, document_label, storage_path, file_size_bytes, uploaded_by, uploaded_at')
    .eq('lead_id', id.leadId)
    .eq('org_id', id.orgId)
    .order('uploaded_at', { ascending: false });

  // Short-lived signed URLs for download (stored in the private borrower-docs bucket).
  const withUrls = await Promise.all((docs ?? []).map(async (d) => {
    let url: string | null = null;
    try {
      const { data: signed } = await sb.storage.from('borrower-docs').createSignedUrl(d.storage_path as string, 3600);
      url = signed?.signedUrl ?? null;
    } catch { url = null; }
    return { ...d, url };
  }));

  return NextResponse.json({ documents: withUrls });
}
