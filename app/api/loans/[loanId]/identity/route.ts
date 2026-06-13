// Phase 119 — LO-side identity: GET status + POST manual-verify (in-person ID check).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data } = await sb
    .from('identity_verifications')
    .select('status, verification_method, id_document_type, failure_reason, submitted_at, verified_at, manual_verification_notes')
    .eq('org_id', orgId)
    .eq('lead_id', params.loanId)
    .maybeSingle();
  return NextResponse.json({ verification: data ?? null });
}

export async function POST(request: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const notes = (body.notes ?? '').toString().slice(0, 1000);

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('assigned_to').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

  const { data: ver, error } = await sb
    .from('identity_verifications')
    .upsert(
      {
        org_id: orgId,
        lead_id: params.loanId,
        lo_id: lead.assigned_to ?? profile?.id ?? null,
        status: 'verified',
        verification_method: 'lo_manual',
        manually_verified_by: profile?.id ?? null,
        manually_verified_at: new Date().toISOString(),
        manual_verification_notes: notes || null,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'lead_id' }
    )
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from('identity_verification_events').insert({
    verification_id: ver.id,
    org_id: orgId,
    event_type: 'lo_manual_verified',
    performed_by: profile?.id ?? null,
    details: { notes: notes || null },
  });

  return NextResponse.json({ ok: true, status: 'verified' });
}
