/**
 * Phase 97 — application session create/update seam.
 *
 * The Smart 1003 form (Phase 59) is deferred, so this is the integration point
 * the form will call to (a) start a session at consent time and (b) record
 * progress as sections complete. Authenticated (Clerk getOrgContext) + org-scoped.
 * Submitting the form sets completed_at, which removes the session from recovery.
 *
 *   POST { lead_id, sms_consent?, borrower_phone?, borrower_state?,
 *          completion_pct?, last_section_completed?, sections_completed?,
 *          completed? }
 *   → upsert by lead_id (one live session per lead).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  lead_id?: string;
  sms_consent?: boolean;
  borrower_phone?: string;
  borrower_state?: string;
  completion_pct?: number;
  last_section_completed?: string;
  sections_completed?: string[];
  completed?: boolean;
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.lead_id) return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });

  const sb = createAdminClient();
  // Lead must belong to the org.
  const { data: lead } = await sb
    .from('leads')
    .select('id, phone, property_state')
    .eq('id', b.lead_id)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const now = new Date().toISOString();
  const { data: existing } = await sb
    .from('application_sessions')
    .select('id')
    .eq('lead_id', b.lead_id)
    .is('completed_at', null)
    .maybeSingle();

  const patch: Record<string, unknown> = { last_activity_at: now };
  if (b.sms_consent !== undefined) patch.sms_consent = b.sms_consent;
  if (b.borrower_phone !== undefined) patch.borrower_phone = b.borrower_phone;
  else if (!existing) patch.borrower_phone = lead.phone ?? null;
  if (b.borrower_state !== undefined) patch.borrower_state = b.borrower_state;
  else if (!existing) patch.borrower_state = lead.property_state ?? null;
  if (typeof b.completion_pct === 'number') patch.completion_pct = Math.max(0, Math.min(100, Math.round(b.completion_pct)));
  if (b.last_section_completed !== undefined) patch.last_section_completed = b.last_section_completed;
  if (Array.isArray(b.sections_completed)) patch.sections_completed = b.sections_completed;
  if (b.completed) {
    patch.completed_at = now;
    patch.completion_pct = 100;
  }

  if (existing) {
    const { data, error } = await sb.from('application_sessions').update(patch).eq('id', existing.id).select().single();
    if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });
    return NextResponse.json({ session: data });
  }

  const { data, error } = await sb
    .from('application_sessions')
    .insert({ org_id: orgId, lead_id: b.lead_id, ...patch })
    .select()
    .single();
  if (error) {
    console.error('[abandon-recovery] session create failed', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  return NextResponse.json({ session: data }, { status: 201 });
}
