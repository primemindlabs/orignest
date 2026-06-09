/**
 * Phase 60.2.2 — TRID 3-day gate. SERVER-ONLY but LIVE (independent of the Sign SDK).
 * Reads the real TRID fields on `leads` and hard-blocks fee collection / appraisal
 * order / rate lock until: LE sent, Intent-to-Proceed signed, and the 3-business-day
 * waiting period has elapsed. Enforced server-side — never bypass via UI.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { addBusinessDays } from '@/lib/sign/businessDays';

export type TRIDGateCode = 'NO_LE' | 'NO_ITP' | 'WAITING_PERIOD' | null;
export interface TRIDGateResult { can_proceed: boolean; reason: string | null; code: TRIDGateCode; earliest_date?: string; days_remaining?: number }

export class TRIDViolationError extends Error {
  code: TRIDGateCode;
  constructor(message: string, code: TRIDGateCode) { super(message); this.name = 'TRIDViolationError'; this.code = code; }
}

export async function checkTRIDGate(orgId: string, loanId: string): Promise<TRIDGateResult> {
  const sb = createAdminClient();
  const { data } = await sb.from('leads').select('loan_estimate_sent_at, intent_to_proceed_at, earliest_consummation_date').eq('id', loanId).eq('org_id', orgId).maybeSingle();
  if (!data?.loan_estimate_sent_at) return { can_proceed: false, reason: 'Initial disclosures (Loan Estimate) not yet sent.', code: 'NO_LE' };
  if (!data.intent_to_proceed_at) return { can_proceed: false, reason: 'Borrower has not signed Intent to Proceed.', code: 'NO_ITP' };

  const earliest = data.earliest_consummation_date ? new Date(data.earliest_consummation_date) : addBusinessDays(new Date(data.loan_estimate_sent_at), 3);
  const now = new Date();
  if (earliest > now) {
    const days = Math.ceil((earliest.getTime() - now.getTime()) / 86_400_000);
    return { can_proceed: false, reason: `3-business-day TRID waiting period — ${days} day(s) remaining.`, code: 'WAITING_PERIOD', earliest_date: earliest.toISOString().slice(0, 10), days_remaining: days };
  }
  return { can_proceed: true, reason: null, code: null };
}

/** Call before collecting a fee, ordering an appraisal, or locking a rate. Throws on violation. */
export async function enforceTRIDBeforeFee(orgId: string, loanId: string): Promise<void> {
  const gate = await checkTRIDGate(orgId, loanId);
  if (!gate.can_proceed) throw new TRIDViolationError(gate.reason ?? 'TRID gate', gate.code);
}
