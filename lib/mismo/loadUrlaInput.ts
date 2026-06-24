/**
 * Shared loader for the MISMO 3.4 (ULAD) URLA export — SERVER-ONLY.
 *
 * Assembles the authoritative application snapshot (leads row + latest
 * loan_applications row + decrypted PII) that buildUrlaXml consumes. Used by both
 * the download route (GET /api/loans/[loanId]/mismo) and the wholesale-submission
 * layer (lib/lenders/submission) so the file we email and the file we POST to a
 * lender are byte-identical.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptPII } from '@/lib/compliance/encryption';
import { buildUrlaXml, type UrlaInput } from '@/lib/mismo/buildUrla';

async function dec(ct?: string | null, iv?: string | null): Promise<string | undefined> {
  if (!ct || !iv) return undefined;
  try { return await decryptPII(ct, iv); } catch { return undefined; }
}

export type UrlaLoadResult =
  | { ok: true; input: UrlaInput; lead: Record<string, any> }
  | { ok: false; status: 404; error: string };

/** Load the lead + latest application + decrypted PII for a loan (lead id). */
export async function loadUrlaInput(orgId: string, loanId: string): Promise<UrlaLoadResult> {
  const sb = createAdminClient();

  const { data: lead } = await sb.from('leads').select('*').eq('id', loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) return { ok: false, status: 404, error: 'Loan not found' };

  const { data: app } = await sb
    .from('loan_applications').select('*')
    .eq('lead_id', loanId).eq('org_id', orgId)
    .order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (!app) return { ok: false, status: 404, error: 'No application on file — complete the 1003 first.' };

  const [ssn, dob, coSsn, coDob] = await Promise.all([
    dec(app.ssn_encrypted, app.ssn_iv), dec(app.dob_encrypted, app.dob_iv),
    dec(app.co_ssn_encrypted, app.co_ssn_iv), dec(app.co_dob_encrypted, app.co_dob_iv),
  ]);

  return { ok: true, input: { app, lead, pii: { ssn, dob, coSsn, coDob } }, lead };
}

/** Convenience: load + render the MISMO XML in one call. */
export async function buildUrlaForLoan(orgId: string, loanId: string): Promise<
  { ok: true; xml: string; lead: Record<string, any> } | { ok: false; status: 404; error: string }
> {
  const r = await loadUrlaInput(orgId, loanId);
  if (!r.ok) return r;
  return { ok: true, xml: buildUrlaXml(r.input), lead: r.lead };
}
