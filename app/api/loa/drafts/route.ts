/**
 * Phase 133 — LOA communication drafts.
 *   POST  → LOA creates a draft (routed to their assigned LO for review).
 *   GET   → drafts visible to the caller (their own as LOA, or pending for them as LO).
 *   PATCH → the LO approves / rejects a draft ({ id, status }). Actual send stays
 *           with the LO's existing send paths; this records the decision.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function me(sb: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  return data?.id ?? null;
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as {
    loan_id?: string; contact_id?: string; draft_type?: string; draft_text?: string; draft_subject?: string;
  };
  if (!b.draft_text?.trim()) return NextResponse.json({ error: 'draft_text is required' }, { status: 400 });
  if (!['sms', 'email'].includes(b.draft_type ?? '')) return NextResponse.json({ error: 'draft_type must be sms or email' }, { status: 400 });

  const sb = createAdminClient();
  const loaId = await me(sb, userId);
  if (!loaId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // The LOA's assigned LO is the reviewer.
  const { data: roleRow } = await sb
    .from('user_roles')
    .select('assigned_lo_id')
    .eq('user_id', loaId).eq('org_id', orgId).eq('role', 'loa').eq('is_active', true)
    .maybeSingle();
  const loId = roleRow?.assigned_lo_id as string | null;
  if (!loId) return NextResponse.json({ error: 'You are not assigned to a loan officer.' }, { status: 403 });

  const contactId = b.contact_id ?? b.loan_id;
  if (!contactId) return NextResponse.json({ error: 'contact_id (or loan_id) is required' }, { status: 400 });

  const { data, error } = await sb.from('loa_communication_drafts').insert({
    org_id: orgId,
    loa_id: loaId,
    lo_id: loId,
    loan_id: b.loan_id ?? null,
    contact_id: contactId,
    draft_type: b.draft_type,
    draft_text: b.draft_text.trim(),
    draft_subject: b.draft_subject?.trim() ?? null,
    status: 'pending_review',
  }).select('*').single();
  if (error) {
    console.error('[loa-drafts] insert failed', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  return NextResponse.json({ draft: data }, { status: 201 });
}

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const profileId = await me(sb, userId);
  if (!profileId) return NextResponse.json({ drafts: [] });

  const { data } = await sb
    .from('loa_communication_drafts')
    .select('id, loan_id, contact_id, draft_type, draft_text, draft_subject, status, loa_id, lo_id, lo_reviewed_at, created_at, lead:leads(first_name, last_name)')
    .eq('org_id', orgId)
    .or(`loa_id.eq.${profileId},lo_id.eq.${profileId}`)
    .order('created_at', { ascending: false })
    .limit(200);

  return NextResponse.json({ drafts: data ?? [], viewer_id: profileId });
}

export async function PATCH(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
  if (!b.id || !['approved_sent', 'rejected', 'edited_sent'].includes(b.status ?? '')) {
    return NextResponse.json({ error: 'id and a valid status are required' }, { status: 400 });
  }
  const sb = createAdminClient();
  const profileId = await me(sb, userId);
  if (!profileId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // Only the reviewing LO may decide.
  const { data: draft } = await sb.from('loa_communication_drafts').select('id, lo_id').eq('id', b.id).eq('org_id', orgId).maybeSingle();
  if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (draft.lo_id !== profileId) return NextResponse.json({ error: 'Only the assigned LO can review this draft.' }, { status: 403 });

  const { error } = await sb.from('loa_communication_drafts')
    .update({ status: b.status, lo_reviewed_at: new Date().toISOString() })
    .eq('id', b.id);
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  return NextResponse.json({ ok: true, status: b.status });
}
