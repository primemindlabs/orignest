/**
 * Phase 66 — pre-send TCPA + DNC check for a lead. LIVE (no external deps).
 * A send route MUST call this and refuse to send when can_send=false. Combines the
 * 8am-9pm borrower-local calling window with the internal DNC suppression list.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkCallingWindow } from '@/lib/communications/tcpaWindow';
import { normalizePhone } from '@/lib/compliance/dncScrub';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const leadId = new URL(req.url).searchParams.get('lead_id');
  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('property_state, phone, sms_consent').eq('id', leadId).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const window = checkCallingWindow(lead.property_state);
  const phone = normalizePhone(lead.phone ?? '');
  const { data: dnc } = phone ? await sb.from('dnc_entries').select('channel').eq('org_id', orgId).eq('phone_number', phone) : { data: [] };
  const smsBlocked = (dnc ?? []).some((e) => e.channel === 'sms' || e.channel === 'all');

  const reasons: string[] = [];
  if (!window.allowed && window.reason) reasons.push(window.reason);
  if (smsBlocked) reasons.push('Number is on your DNC suppression list (STOP/opt-out).');
  if (lead.sms_consent === false) reasons.push('No SMS consent on file (TCPA).');

  return NextResponse.json({ can_send: window.allowed && !smsBlocked && lead.sms_consent !== false, window, dnc_suppressed: smsBlocked, sms_consent: lead.sms_consent !== false, reasons });
}
