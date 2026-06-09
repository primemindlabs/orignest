/**
 * Phase 64.1 — wire instruction handling. SERVER-ONLY.
 * Bank/routing/account are AES-256-GCM encrypted (never plaintext). A CHANGE to
 * routing/account vs. an existing record is treated as a wire-fraud red flag.
 * Wire details ALWAYS require phone verification before use (verified_at set by LO).
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt, decrypt } from '@/lib/crypto/encrypt';

export interface WireInput { bank_name: string; routing_number: string; account_number: string; account_name: string }
export type WireReceiveResult = { ok: true; wire_id: string; fraud_flag: boolean };

export async function receiveWireInstructions(orgId: string, loanId: string, titleDocumentId: string | null, wire: WireInput): Promise<WireReceiveResult> {
  const sb = createAdminClient();
  const { data: existing } = await sb.from('wire_instructions').select('id, routing_number_enc, account_number_enc, change_count').eq('org_id', orgId).eq('loan_id', loanId).order('received_at', { ascending: false }).limit(1).maybeSingle();

  let fraudFlag = false;
  if (existing) {
    let prevRouting = ''; let prevAccount = '';
    try { prevRouting = existing.routing_number_enc ? decrypt(existing.routing_number_enc) : ''; prevAccount = existing.account_number_enc ? decrypt(existing.account_number_enc) : ''; } catch { /* treat unreadable as changed */ }
    if (prevRouting !== wire.routing_number || prevAccount !== wire.account_number) {
      fraudFlag = true;
      // Flag the prior record + bump change count.
      await sb.from('wire_instructions').update({ change_count: (existing.change_count ?? 0) + 1, change_flag: true, change_flag_reason: `Wire instructions changed on ${new Date().toISOString()} — possible fraud; verify by phone.` }).eq('id', existing.id);
    }
  }

  const last4 = (wire.account_number ?? '').replace(/\D/g, '').slice(-4);
  const { data: row, error } = await sb.from('wire_instructions').insert({
    org_id: orgId, loan_id: loanId, title_document_id: titleDocumentId,
    bank_name_enc: encrypt(wire.bank_name), routing_number_enc: encrypt(wire.routing_number), account_number_enc: encrypt(wire.account_number), account_name_enc: encrypt(wire.account_name), account_last4: last4,
    change_flag: fraudFlag, change_flag_reason: fraudFlag ? 'Changed from prior wire instructions — verify by phone before use.' : null,
  }).select('id').single();
  if (error || !row) throw new Error('wire_save_failed');
  return { ok: true, wire_id: row.id, fraud_flag: fraudFlag };
}
