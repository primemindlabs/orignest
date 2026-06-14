/**
 * Phase 128 — execution. Runs after the 5-minute undo window via the executor cron.
 * Re-checks TCPA at send time, injects the NMLS disclaimer, and records an immutable
 * 'executed' (or 'failed') audit row. Twilio is env-gated: without creds, sends are
 * recorded as executed but not transmitted (record-only), mirroring the rest of the app.
 */
import 'server-only';
import twilio from 'twilio';
import type { SupabaseClient } from '@supabase/supabase-js';
import { canSendSMS } from '@/lib/communications/canSendSMS';
import { sendCompliantEmail } from '@/lib/resend';
import { nmlsDisclaimer } from '@/lib/coMarketing/copyPrompts';
import { buildSenderIdentity } from '@/lib/relay/sender';
import { smsCategoryForSignal, type AutopilotAction, type AutopilotSignalType } from './types';

function twilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

interface LoRow {
  first_name: string | null;
  last_name: string | null;
  nmls_id: string | null;
  email: string | null;
  phone: string | null;
}
interface OrgRow {
  name: string | null;
  reply_to_email: string | null;
  twilio_number: string | null;
}

async function loadIdentity(sb: SupabaseClient, loId: string, orgId: string) {
  const [{ data: lo }, { data: org }] = await Promise.all([
    sb.from('profiles').select('first_name, last_name, nmls_id, email, phone').eq('id', loId).maybeSingle(),
    // Base `organizations` only guarantees `name`; the SMS from-number comes from env.
    sb.from('organizations').select('name').eq('id', orgId).maybeSingle(),
  ]);
  const loRow = (lo ?? {}) as LoRow;
  const orgName = ((org ?? {}) as { name: string | null }).name ?? null;
  const orgRow: OrgRow = {
    name: orgName,
    reply_to_email: null,
    twilio_number: process.env.DEFAULT_TWILIO_NUMBER || process.env.TWILIO_PHONE_NUMBER || null,
  };
  const loName = `${loRow.first_name ?? ''} ${loRow.last_name ?? ''}`.trim() || 'Your Loan Officer';
  const disclaimer = nmlsDisclaimer(loName, loRow.nmls_id, orgName);
  const identity = buildSenderIdentity(loRow, orgRow);
  return { loRow, orgRow, loName, disclaimer, identity };
}

async function markExecuted(sb: SupabaseClient, action: AutopilotAction, tcpa: boolean | null, nmls: boolean) {
  await sb
    .from('autopilot_actions')
    .update({ status: 'executed', executed_at: new Date().toISOString() })
    .eq('id', action.id);
  await sb.from('autopilot_audit_log').insert({
    org_id: action.org_id,
    lo_id: action.lo_id,
    autopilot_action_id: action.id,
    event: 'executed',
    tcpa_consent_verified: tcpa,
    nmls_disclaimer_injected: nmls,
  });
}

async function markFailed(sb: SupabaseClient, action: AutopilotAction, reason: string) {
  await sb
    .from('autopilot_actions')
    .update({ status: 'executed', executed_at: new Date().toISOString(), failure_reason: reason })
    .eq('id', action.id);
  await sb.from('autopilot_audit_log').insert({
    org_id: action.org_id,
    lo_id: action.lo_id,
    autopilot_action_id: action.id,
    event: 'failed',
    event_metadata: { reason },
  });
}

export async function executeAction(sb: SupabaseClient, action: AutopilotAction): Promise<void> {
  // Guard: only execute actions still 'approved' (not undone/already executed).
  const { data: current } = await sb
    .from('autopilot_actions')
    .select('status')
    .eq('id', action.id)
    .maybeSingle();
  if (!current || current.status !== 'approved') return;

  switch (action.action_type) {
    case 'send_sms': {
      // SMS only goes to borrowers (lead-keyed); entity_id is the lead id.
      const gate = await canSendSMS(sb, {
        orgId: action.org_id,
        leadId: action.entity_id,
        category: smsCategoryForSignal(action.signal_type as AutopilotSignalType),
      });
      if (!gate.allowed) {
        await markFailed(sb, action, `TCPA_BLOCKED: ${gate.reason ?? 'not permitted'}`);
        return;
      }
      const { data: lead } = await sb.from('leads').select('phone').eq('id', action.entity_id).maybeSingle();
      const to = (lead as { phone: string | null } | null)?.phone;
      if (!to) {
        await markFailed(sb, action, 'NO_PHONE');
        return;
      }
      const { disclaimer, identity } = await loadIdentity(sb, action.lo_id, action.org_id);
      const body = `${action.recommended_content ?? ''}\n\n${disclaimer}`.trim();
      if (twilioConfigured() && identity.sms_from) {
        try {
          const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
          await client.messages.create({ body, from: identity.sms_from, to });
        } catch (e) {
          console.error('[autopilot] sms send failed', action.id, e);
          await markFailed(sb, action, 'TWILIO_ERROR');
          return;
        }
      }
      await markExecuted(sb, action, true, true);
      return;
    }

    case 'send_email': {
      // Resolve recipient: borrower → leads.email, realtor → realtors.email.
      let to: string | null = null;
      if (action.entity_type === 'realtor') {
        const { data: r } = await sb.from('realtors').select('email').eq('id', action.entity_id).maybeSingle();
        to = (r as { email: string | null } | null)?.email ?? null;
      } else {
        const { data: l } = await sb.from('leads').select('email').eq('id', action.entity_id).maybeSingle();
        to = (l as { email: string | null } | null)?.email ?? null;
      }
      if (!to) {
        await markFailed(sb, action, 'NO_EMAIL');
        return;
      }
      const { disclaimer } = await loadIdentity(sb, action.lo_id, action.org_id);
      const text = `${action.recommended_content ?? ''}\n\n${disclaimer}`.trim();
      try {
        await sendCompliantEmail({
          to,
          subject: action.recommended_subject ?? 'A quick note',
          text,
          orgId: action.org_id,
          recipientEmail: to,
          leadId: action.entity_type === 'realtor' ? null : action.entity_id,
        });
      } catch (e) {
        console.error('[autopilot] email send failed', action.id, e);
        await markFailed(sb, action, 'EMAIL_ERROR');
        return;
      }
      await markExecuted(sb, action, null, true);
      return;
    }

    case 'internal_alert':
    case 'schedule_call_reminder':
    case 'trigger_workflow':
    default: {
      // No outbound communication — surfacing to the LO is the action itself.
      await markExecuted(sb, action, null, false);
      return;
    }
  }
}

/** Executor sweep: run every approved action whose 5-minute undo window has passed. */
export async function executeApprovedDue(sb: SupabaseClient, limit = 200): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data } = await sb
    .from('autopilot_actions')
    .select('*')
    .eq('status', 'approved')
    .lte('undo_deadline', nowIso)
    .order('undo_deadline', { ascending: true })
    .limit(limit);

  const actions = (data ?? []) as AutopilotAction[];
  let count = 0;
  for (const a of actions) {
    try {
      await executeAction(sb, a);
      count++;
    } catch (e) {
      console.error('[autopilot] execute failed', a.id, e);
    }
  }
  return count;
}
