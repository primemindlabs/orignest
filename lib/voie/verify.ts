/**
 * Phase 150 — VOI/VOE orchestrator. SERVER-ONLY.
 *
 * Loads the vendor connection, gathers the applicant's identity (lead + the decrypted
 * SSN/DOB and employer/title from the latest application), dispatches to the vendor
 * adapter, and records a voie_verifications row with the verified employment/income.
 * Gated-safe: with no live vendor the row is kept (status 'gated') and no fake figures
 * are written.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto/encrypt';
import { decryptPII } from '@/lib/compliance/encryption';
import { getVoieAdapter } from './registry';
import type { VoieConnection, DecryptedCreds, VoieApplicant, VerificationType, VoieMethod } from './types';

const CONN_COLS = 'id, org_id, vendor, api_url, auth_type, account_id, api_key_enc, api_secret_enc, is_active';

export type VerifyOutcome =
  | { ok: false; status: 404 | 400; error: string }
  | { ok: true; gated: boolean; verification: Record<string, any> };

async function dec(ct?: string | null, iv?: string | null): Promise<string | undefined> {
  if (!ct || !iv) return undefined;
  try { return await decryptPII(ct, iv); } catch { return undefined; }
}

export async function runVoie(
  orgId: string, leadId: string, connectionId: string, loId: string | null,
  opts: { verificationType: VerificationType; method: VoieMethod; applicant?: 'borrower' | 'coborrower' },
): Promise<VerifyOutcome> {
  const sb = createAdminClient();

  const { data: conn } = await sb.from('voie_vendor_connections').select(CONN_COLS).eq('id', connectionId).eq('org_id', orgId).maybeSingle();
  if (!conn) return { ok: false, status: 404, error: 'VOI/VOE vendor connection not found.' };
  if (!conn.is_active) return { ok: false, status: 400, error: 'That VOI/VOE vendor connection is inactive.' };

  const { data: lead } = await sb.from('leads').select('first_name, last_name').eq('id', leadId).eq('org_id', orgId).maybeSingle();
  if (!lead) return { ok: false, status: 404, error: 'Loan not found.' };

  const { data: app } = await sb.from('loan_applications').select('borrower_data, employment_data, ssn_encrypted, ssn_iv, dob_encrypted, dob_iv').eq('lead_id', leadId).eq('org_id', orgId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  const b = ((app?.borrower_data ?? {}) as Record<string, any>);
  const emp = ((app?.employment_data ?? {}) as Record<string, any>);
  const empSrc = (emp.primary_employer ?? emp) as Record<string, any>;
  const [ssn, dob] = await Promise.all([dec(app?.ssn_encrypted, app?.ssn_iv), dec(app?.dob_encrypted, app?.dob_iv)]);

  const applicant: VoieApplicant = {
    firstName: b.first_name ?? (lead as any).first_name ?? '',
    lastName: b.last_name ?? (lead as any).last_name ?? '',
    ssn, dob,
    employerName: empSrc.employer_name ?? empSrc.business_name ?? undefined,
    jobTitle: empSrc.job_title ?? empSrc.position ?? undefined,
  };

  const creds: DecryptedCreds = {
    apiKey: conn.api_key_enc ? safeDecrypt(conn.api_key_enc) : null,
    apiSecret: conn.api_secret_enc ? safeDecrypt(conn.api_secret_enc) : null,
  };
  const connView: VoieConnection = { id: conn.id, org_id: conn.org_id, vendor: conn.vendor, api_url: conn.api_url, auth_type: conn.auth_type, account_id: conn.account_id };

  const adapter = getVoieAdapter(conn.vendor);
  const result = await adapter.verify(connView, creds, { verificationType: opts.verificationType, method: opts.method, applicant });

  const e = result.employment ?? {};
  const inc = result.income ?? {};
  const now = new Date().toISOString();
  const { data: saved } = await sb.from('voie_verifications').insert({
    org_id: orgId, lead_id: leadId, connection_id: conn.id, lo_id: loId, vendor: conn.vendor,
    verification_type: opts.verificationType, method: opts.method, applicant: opts.applicant ?? 'borrower',
    status: result.status,
    verified: !!result.verified,
    employer_name: e.employerName ?? null, job_title: e.jobTitle ?? null,
    employment_status: e.status ?? null, employment_start: e.startDate ?? null, employment_end: e.endDate ?? null,
    annual_income: inc.annualIncome ?? null, monthly_income: inc.monthlyIncome ?? null, pay_frequency: inc.payFrequency ?? null,
    report_ref: result.reportRef ?? null, raw_response: result.raw ?? null, error_message: result.error ?? null,
    verified_at: result.status === 'completed' ? now : null,
  }).select('id, vendor, verification_type, method, applicant, status, verified, employer_name, job_title, employment_status, employment_start, employment_end, annual_income, monthly_income, pay_frequency, report_ref, error_message, verified_at, created_at').single();

  await sb.from('voie_vendor_connections').update(
    result.gated || result.status === 'error'
      ? { last_error: result.error ?? 'verification failed', updated_at: now }
      : { last_run_at: now, last_error: null, updated_at: now },
  ).eq('id', conn.id);

  return { ok: true, gated: !!result.gated, verification: saved ?? { status: result.status, error_message: result.error } };
}

function safeDecrypt(enc: string): string | null {
  try { return decrypt(enc); } catch { return null; }
}
