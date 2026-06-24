/**
 * Phase 144 — Concierge test harness. POST { lead_id, message } runs the full agent
 * (persona + Brain + tools + compliance guard) in a DRY RUN: nothing is persisted or
 * texted to the borrower. Lets an LO preview how Ashley would reply — and verify the
 * guardrails (try asking for a rate) — without a live Twilio number.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { runConcierge } from '@/lib/concierge/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { lead_id?: string; message?: string };
  if (!b.lead_id || !b.message?.trim()) return NextResponse.json({ error: 'lead_id and message are required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id, assigned_to').eq('id', b.lead_id).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const result = await runConcierge({
    orgId, leadId: b.lead_id, loId: (lead as { assigned_to: string | null }).assigned_to,
    inboundText: b.message, channel: 'sms', forceMode: 'suggest', dryRun: true,
  });
  return NextResponse.json({ result });
}
