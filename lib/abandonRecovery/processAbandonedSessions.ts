/**
 * Phase 97 — abandon-recovery engine. Finds incomplete 1003 sessions that are
 * eligible for the next recovery SMS (2h / 24h / 72h, max 3) and sends them,
 * subject to: explicit sms_consent on the session, the app-wide leads.sms_opt_out
 * flag, and the TCPA calling window (8am–9pm borrower-local).
 *
 * Twilio is GATED: with no creds the message is RECORDED (delivery_status
 * 'gated') and the cadence still advances, so the dashboard and counters work
 * without a live SMS provider. Real send happens once Twilio env is configured.
 */
import twilio from 'twilio';
import type { createAdminClient } from '@/lib/supabase/admin';
import { buildDeepLink, buildRecoverySMS, nextEligibleAttempt } from '@/lib/abandonRecovery/smsTemplates';
import { checkCallingWindow, stripPII } from '@/lib/communications/tcpaWindow';
import type { RecoveryAttempt } from '@/types/abandonRecovery';

type Admin = ReturnType<typeof createAdminClient>;

const HOUR = 3_600_000;

interface SessionRow {
  id: string;
  org_id: string;
  lead_id: string;
  token: string;
  last_section_completed: string | null;
  completion_pct: number;
  borrower_phone: string | null;
  borrower_state: string | null;
  last_activity_at: string;
  recovery_attempts_sent: number;
  lead: { first_name: string | null; last_name: string | null; assigned_to: string | null; sms_opt_out: boolean | null } | null;
}

function twilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

export interface RecoveryRunResult {
  eligible: number;
  sent: number;
  gated: number;
  skipped_window: number;
  skipped_optout: number;
  failed: number;
}

export async function processAbandonedSessions(sb: Admin, now: Date = new Date()): Promise<RecoveryRunResult> {
  const res: RecoveryRunResult = { eligible: 0, sent: 0, gated: 0, skipped_window: 0, skipped_optout: 0, failed: 0 };

  const { data: sessions } = await sb
    .from('application_sessions')
    .select(
      'id, org_id, lead_id, token, last_section_completed, completion_pct, borrower_phone, borrower_state, last_activity_at, recovery_attempts_sent, lead:leads!inner(first_name, last_name, assigned_to, sms_opt_out)',
    )
    .is('completed_at', null)
    .is('abandoned_at', null)
    .eq('sms_consent', true)
    .lt('recovery_attempts_sent', 3)
    .not('borrower_phone', 'is', null)
    .limit(500);

  const rows = (sessions ?? []) as unknown as SessionRow[];
  if (rows.length === 0) return res;

  // Resolve LO display names in one batch.
  const loIds = Array.from(new Set(rows.map((r) => r.lead?.assigned_to).filter(Boolean))) as string[];
  const loNames = new Map<string, string>();
  if (loIds.length) {
    const { data: profiles } = await sb.from('profiles').select('id, first_name, last_name').in('id', loIds);
    for (const p of profiles ?? []) {
      loNames.set(p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Your loan officer');
    }
  }

  const client = twilioConfigured()
    ? twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
    : null;

  for (const s of rows) {
    const hours = (now.getTime() - new Date(s.last_activity_at).getTime()) / HOUR;
    const attempt = nextEligibleAttempt(s.recovery_attempts_sent, hours);
    if (!attempt) continue;
    res.eligible++;

    // App-wide opt-out wins: revoke this session's consent and stop.
    if (s.lead?.sms_opt_out) {
      await sb.from('application_sessions').update({ sms_consent: false }).eq('id', s.id);
      res.skipped_optout++;
      continue;
    }

    // TCPA calling window (borrower-local). Default-deny when state unknown — try
    // again on the next run rather than risk an out-of-window send.
    const win = checkCallingWindow(s.borrower_state, now);
    if (!win.allowed) {
      res.skipped_window++;
      continue;
    }

    const deepLink = buildDeepLink(s.token, s.last_section_completed);
    const body = stripPII(
      buildRecoverySMS({
        attempt,
        first_name: s.lead?.first_name ?? '',
        completion_pct: s.completion_pct,
        lo_name: (s.lead?.assigned_to && loNames.get(s.lead.assigned_to)) || 'Your loan officer',
        deep_link: deepLink,
      }),
    );

    let twilioSid: string | null = null;
    let status: 'sent' | 'gated' | 'failed' = 'gated';
    if (client) {
      try {
        const msg = await client.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER!, to: s.borrower_phone! });
        twilioSid = msg.sid;
        status = 'sent';
      } catch (err) {
        console.error(`[abandon-recovery] send failed for session ${s.id}`, err);
        status = 'failed';
      }
    }

    await sb.from('abandon_recovery_messages').insert({
      org_id: s.org_id,
      session_id: s.id,
      lead_id: s.lead_id,
      recovery_attempt: attempt as RecoveryAttempt,
      sms_body: body,
      deep_link: deepLink,
      delivery_status: status,
      twilio_sid: twilioSid,
    });

    if (status !== 'failed') {
      await sb
        .from('application_sessions')
        .update({
          recovery_attempts_sent: s.recovery_attempts_sent + 1,
          ...(attempt === 3 ? { abandoned_at: now.toISOString() } : {}),
        })
        .eq('id', s.id);
      if (status === 'sent') res.sent++;
      else res.gated++;
    } else {
      res.failed++;
    }
  }

  return res;
}
