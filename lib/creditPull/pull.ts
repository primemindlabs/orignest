/**
 * Phase 147 — credit pull orchestrator. SERVER-ONLY.
 *
 * Loads the vendor connection, gathers the applicant's identity (lead + the decrypted
 * SSN/DOB from the latest application), dispatches to the vendor adapter, and records
 * a credit_pulls row with the tri-bureau scores + mid score. Gated-safe: with no live
 * vendor the row is kept (status 'gated') and no fake scores are written.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto/encrypt';
import { decryptPII } from '@/lib/compliance/encryption';
import { getCreditAdapter } from './registry';
import { midScore, type CreditConnection, type DecryptedCreds, type CreditApplicant } from './types';

const CONN_COLS = 'id, org_id, vendor, api_url, auth_type, account_id, api_key_enc, api_secret_enc, is_active';

export type PullOutcome =
  | { ok: false; status: 404 | 400; error: string }
  | { ok: true; gated: boolean; pull: Record<string, any> };

async function dec(ct?: string | null, iv?: string | null): Promise<string | undefined> {
  if (!ct || !iv) return undefined;
  try { return await decryptPII(ct, iv); } catch { return undefined; }
}

export async function pullCredit(
  orgId: string, leadId: string, connectionId: string, loId: string | null,
  opts: { pullType: 'soft' | 'hard'; applicant?: 'borrower' | 'coborrower' | 'joint' },
): Promise<PullOutcome> {
  const sb = createAdminClient();

  const { data: conn } = await sb.from('credit_vendor_connections').select(CONN_COLS).eq('id', connectionId).eq('org_id', orgId).maybeSingle();
  if (!conn) return { ok: false, status: 404, error: 'Credit vendor connection not found.' };
  if (!conn.is_active) return { ok: false, status: 400, error: 'That credit vendor connection is inactive.' };

  const { data: lead } = await sb.from('leads').select('first_name, last_name, property_address, property_city, property_state, property_zip').eq('id', leadId).eq('org_id', orgId).maybeSingle();
  if (!lead) return { ok: false, status: 404, error: 'Loan not found.' };

  const { data: app } = await sb.from('loan_applications').select('borrower_data, ssn_encrypted, ssn_iv, dob_encrypted, dob_iv').eq('lead_id', leadId).eq('org_id', orgId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  const b = ((app?.borrower_data ?? {}) as Record<string, any>);
  const [ssn, dob] = await Promise.all([dec(app?.ssn_encrypted, app?.ssn_iv), dec(app?.dob_encrypted, app?.dob_iv)]);

  const applicant: CreditApplicant = {
    firstName: b.first_name ?? (lead as any).first_name ?? '',
    lastName: b.last_name ?? (lead as any).last_name ?? '',
    ssn, dob,
    addressLine: b.current_address ?? b.address_line ?? (lead as any).property_address ?? undefined,
    city: b.current_city ?? (lead as any).property_city ?? undefined,
    state: b.current_state ?? (lead as any).property_state ?? undefined,
    zip: b.current_zip ?? (lead as any).property_zip ?? undefined,
  };

  const creds: DecryptedCreds = {
    apiKey: conn.api_key_enc ? safeDecrypt(conn.api_key_enc) : null,
    apiSecret: conn.api_secret_enc ? safeDecrypt(conn.api_secret_enc) : null,
  };
  const connView: CreditConnection = { id: conn.id, org_id: conn.org_id, vendor: conn.vendor, api_url: conn.api_url, auth_type: conn.auth_type, account_id: conn.account_id };

  const adapter = getCreditAdapter(conn.vendor);
  const result = await adapter.pull(connView, creds, { pullType: opts.pullType, applicant });

  const scores = result.scores ?? {};
  const now = new Date().toISOString();
  const { data: saved } = await sb.from('credit_report_pulls').insert({
    org_id: orgId, lead_id: leadId, connection_id: conn.id, lo_id: loId, vendor: conn.vendor,
    pull_type: opts.pullType, applicant: opts.applicant ?? 'borrower',
    status: result.status,
    equifax_score: scores.equifax ?? null, experian_score: scores.experian ?? null, transunion_score: scores.transunion ?? null,
    mid_score: midScore(scores),
    report_ref: result.reportRef ?? null, tradeline_count: result.tradelineCount ?? null,
    raw_response: result.raw ?? null, error_message: result.error ?? null,
    pulled_at: result.status === 'completed' ? now : null,
  }).select('id, vendor, pull_type, status, equifax_score, experian_score, transunion_score, mid_score, report_ref, tradeline_count, error_message, pulled_at, created_at').single();

  await sb.from('credit_vendor_connections').update(
    result.gated || result.status === 'error'
      ? { last_error: result.error ?? 'pull failed', updated_at: now }
      : { last_pull_at: now, last_error: null, updated_at: now },
  ).eq('id', conn.id);

  return { ok: true, gated: !!result.gated, pull: saved ?? { status: result.status, error_message: result.error } };
}

function safeDecrypt(enc: string): string | null {
  try { return decrypt(enc); } catch { return null; }
}
