// Phase 119 — borrower identity verification (token-gated; no borrower login).
// GET → current status. POST → submit ID + SSN-last4 + DOB. SSN last-4 is validated
// then DISCARDED (never stored). ID doc → private borrower-docs bucket (identity/ prefix).
// Basic mode auto-verifies; a DOB mismatch vs the lead flags manual_review.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ID_TYPES = ['drivers_license', 'passport', 'state_id'];

async function resolve(sb: ReturnType<typeof createAdminClient>, token: string) {
  const { data } = await sb.from('borrower_portal_tokens').select('lead_id, org_id, expires_at').eq('token', token).maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at as string) < new Date()) return null;
  return data as { lead_id: string; org_id: string };
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const portal = await resolve(sb, params.token);
  if (!portal) return NextResponse.json({ error: 'Invalid portal link' }, { status: 401 });
  const { data } = await sb
    .from('identity_verifications')
    .select('status, verification_method, verified_at')
    .eq('org_id', portal.org_id)
    .eq('lead_id', portal.lead_id)
    .maybeSingle();
  return NextResponse.json({ status: data?.status ?? 'pending', method: data?.verification_method ?? null, verified_at: data?.verified_at ?? null });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const portal = await resolve(sb, params.token);
  if (!portal) return NextResponse.json({ error: 'Invalid portal link' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Expected multipart form' }, { status: 400 });
  const file = form.get('idDocument') as File | null;
  const idType = (form.get('idType') as string | null) ?? '';
  const ssnLast4 = (form.get('ssnLast4') as string | null) ?? '';
  const dob = (form.get('dateOfBirth') as string | null) ?? '';

  // Validate SSN last-4 format only — NEVER stored or logged.
  if (!/^\d{4}$/.test(ssnLast4)) return NextResponse.json({ error: 'Enter the last 4 digits of your SSN' }, { status: 400 });
  if (!ID_TYPES.includes(idType)) return NextResponse.json({ error: 'Select a valid ID type' }, { status: 400 });
  if (!file) return NextResponse.json({ error: 'Upload a photo of your ID' }, { status: 400 });
  if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: 'File must be under 25MB' }, { status: 400 });

  const { data: lead } = await sb.from('leads').select('assigned_to, date_of_birth').eq('id', portal.lead_id).eq('org_id', portal.org_id).maybeSingle();
  const loId = (lead?.assigned_to as string | null) ?? null;

  // Upload ID to the private borrower-docs bucket.
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `identity/${portal.lead_id}/${Date.now()}_${idType}_${safe}`;
  const { error: upErr } = await sb.storage.from('borrower-docs').upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (upErr) {
    console.error('[identity] upload failed', upErr.message);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  // DOB cross-check (light KBA): mismatch vs the lead's DOB → manual review.
  const leadDob = (lead?.date_of_birth as string | null)?.slice(0, 10) ?? null;
  const dobMismatch = leadDob && dob && dob.slice(0, 10) !== leadDob;
  const finalStatus = dobMismatch ? 'manual_review' : 'verified';

  const { data: ver } = await sb
    .from('identity_verifications')
    .upsert(
      {
        org_id: portal.org_id,
        lead_id: portal.lead_id,
        lo_id: loId,
        status: 'in_review',
        verification_method: 'basic',
        id_document_path: path,
        id_document_type: idType,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'lead_id' }
    )
    .select('id')
    .single();

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  if (ver) {
    await sb.from('identity_verification_events').insert({
      verification_id: ver.id,
      org_id: portal.org_id,
      event_type: 'submitted',
      ip_address: ip,
      user_agent: req.headers.get('user-agent') ?? null,
      details: { id_type: idType, dob_provided: !!dob },
    });
    await sb
      .from('identity_verifications')
      .update({
        status: finalStatus,
        verified_at: finalStatus === 'verified' ? new Date().toISOString() : null,
        failure_reason: dobMismatch ? 'Date of birth did not match the file — manual review required' : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ver.id);
    await sb.from('identity_verification_events').insert({
      verification_id: ver.id,
      org_id: portal.org_id,
      event_type: finalStatus === 'verified' ? 'auto_verified' : 'flagged_manual_review',
      ip_address: ip,
      details: { method: 'basic' },
    });
  }

  return NextResponse.json({ status: finalStatus });
}
