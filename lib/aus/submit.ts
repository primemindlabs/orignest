/**
 * Phase 151 — AUS (DU/LPA) orchestrator. SERVER-ONLY.
 *
 * runAus(orgId, loanId, connectionId, loId, { system }):
 *   1. load + verify the AUS vendor connection (active, same org)
 *   2. build the MISMO 3.4 file from the authoritative application (reused export)
 *   3. decrypt the vendor credential at call time
 *   4. record an aus_submissions row (with the MISMO snapshot) BEFORE dispatch
 *   5. dispatch to the vendor adapter (gated-safe — nothing fake is ever sent)
 *   6. persist the recommendation + findings onto the row + the connection's last_run/last_error
 *
 * Gated outcome: the row is kept (status 'gated') with the MISMO snapshot and a reason,
 * so the file is prepared and audited even before an AUS endpoint is configured.
 *
 * The system (DU vs LPA) is intrinsic for the native vendors (fannie_du → du,
 * freddie_lpa → lpa); for the generic gateway it is chosen at run time.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto/encrypt';
import { buildUrlaForLoan } from '@/lib/mismo/loadUrlaInput';
import { getAusAdapter } from './registry';
import type { AusConnection, AusVendor, AusSystem, DecryptedCreds } from './types';

const CONN_COLS = 'id, org_id, vendor, api_url, auth_type, account_id, api_key_enc, api_secret_enc, is_active';
const ROW_COLS = 'id, vendor, aus_system, status, recommendation, raw_recommendation, eligibility, risk_class, case_file_id, dti, ltv, findings, report_ref, error_message, submitted_at, created_at';

export type RunAusOutcome =
  | { ok: false; status: 404 | 400; error: string }
  | { ok: true; gated: boolean; submission: Record<string, any> };

/** DU/LPA is fixed for native vendors; generic uses the caller's choice. */
function systemForVendor(vendor: AusVendor, chosen: AusSystem): AusSystem {
  if (vendor === 'fannie_du') return 'du';
  if (vendor === 'freddie_lpa') return 'lpa';
  return chosen;
}

export async function runAus(
  orgId: string, loanId: string, connectionId: string, loId: string | null,
  opts: { system: AusSystem },
): Promise<RunAusOutcome> {
  const sb = createAdminClient();

  const { data: conn } = await sb.from('aus_vendor_connections').select(CONN_COLS).eq('id', connectionId).eq('org_id', orgId).maybeSingle();
  if (!conn) return { ok: false, status: 404, error: 'AUS vendor connection not found.' };
  if (!conn.is_active) return { ok: false, status: 400, error: 'That AUS vendor connection is inactive.' };

  const built = await buildUrlaForLoan(orgId, loanId);
  if (!built.ok) return { ok: false, status: built.status, error: built.error };

  const system = systemForVendor(conn.vendor, opts.system);

  // Record the attempt (with the snapshot) before we dispatch — GSE rep-and-warrant
  // and ATR/QM audit trail keeps the exact file that produced the findings.
  const { data: row } = await sb.from('aus_submissions').insert({
    org_id: orgId, lead_id: loanId, connection_id: conn.id, lo_id: loId,
    vendor: conn.vendor, aus_system: system, status: 'queued',
    mismo_snapshot: built.xml,
  }).select('id').single();

  const creds: DecryptedCreds = {
    apiKey: conn.api_key_enc ? safeDecrypt(conn.api_key_enc) : null,
    apiSecret: conn.api_secret_enc ? safeDecrypt(conn.api_secret_enc) : null,
  };
  const connView: AusConnection = { id: conn.id, org_id: conn.org_id, vendor: conn.vendor, api_url: conn.api_url, auth_type: conn.auth_type, account_id: conn.account_id };

  const adapter = getAusAdapter(conn.vendor);
  const result = await adapter.submit(connView, creds, {
    system, mismoXml: built.xml, borrowerLastName: built.lead.last_name, loanAmount: built.lead.loan_amount,
  });

  const now = new Date().toISOString();
  const update: Record<string, any> = {
    status: result.status,
    recommendation: result.recommendation ?? null,
    raw_recommendation: result.rawRecommendation ?? null,
    eligibility: result.eligibility ?? null,
    risk_class: result.riskClass ?? null,
    case_file_id: result.caseFileId ?? null,
    dti: result.dti ?? null,
    ltv: result.ltv ?? null,
    findings: result.findings ?? null,
    report_ref: result.reportRef ?? null,
    raw_response: result.raw ?? null,
    error_message: result.error ?? null,
    submitted_at: result.gated ? null : now,
  };
  const { data: saved } = row
    ? await sb.from('aus_submissions').update(update).eq('id', row.id).select(ROW_COLS).single()
    : { data: null };

  await sb.from('aus_vendor_connections').update(
    result.gated || result.status === 'error'
      ? { last_error: result.error ?? 'AUS submission failed', updated_at: now }
      : { last_run_at: now, last_error: null, updated_at: now },
  ).eq('id', conn.id);

  return { ok: true, gated: !!result.gated, submission: saved ?? { aus_system: system, status: result.status, error_message: result.error } };
}

function safeDecrypt(enc: string): string | null {
  try { return decrypt(enc); } catch { return null; }
}
