/**
 * Phase 30.3 — apply a confirmed extraction to the 1003 (LO-only).
 * Writes mapped fields into loan_applications jsonb sections ONLY after the LO
 * confirms. SSN/DOB are never mapped or written (sanitized at extraction time).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyExtractionToApplication } from '@/lib/ai/fieldMapper';
import type { DocumentType } from '@/lib/ai/documentExtractor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { loanId: string; id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: extraction } = await sb
    .from('document_extractions')
    .select('*')
    .eq('id', params.id)
    .eq('lead_id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!extraction) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: app } = await sb
    .from('loan_applications')
    .select('id, employment_data, assets_data')
    .eq('lead_id', params.loanId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { patch, applied } = applyExtractionToApplication(
    extraction.document_type as DocumentType,
    (extraction.extracted_fields ?? {}) as Record<string, unknown>,
    {
      employment_data: (app?.employment_data ?? {}) as Record<string, unknown>,
      assets_data: (app?.assets_data ?? {}) as Record<string, unknown>,
    }
  );

  if (Object.keys(patch).length > 0) {
    if (app?.id) {
      await sb.from('loan_applications').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', app.id);
    } else {
      await sb.from('loan_applications').insert({ lead_id: params.loanId, org_id: orgId, ...patch });
    }
  }

  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  await sb
    .from('document_extractions')
    .update({ lo_confirmed: true, lo_confirmed_at: new Date().toISOString(), confirmed_by: profile?.id ?? null, fields_applied: applied })
    .eq('id', params.id);

  return NextResponse.json({ ok: true, applied });
}
