/**
 * Phase 61.1 — referral code helpers. SERVER-ONLY.
 * Generates a readable code from the LO's name (e.g. "SMITH7K3"). Collision-safe.
 */
import 'server-only';
import { randomBytes } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
function suffix(len = 4): string {
  const b = randomBytes(len); let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}

/** Get (or create) the LO-level referral code for a profile. */
export async function ensureReferralCode(orgId: string, loId: string | null, lastName?: string | null): Promise<string> {
  const sb = createAdminClient();
  if (loId) {
    const { data: existing } = await sb.from('referral_codes').select('code').eq('org_id', orgId).eq('lo_id', loId).is('source_loan_id', null).eq('is_active', true).maybeSingle();
    if (existing) return existing.code;
  }
  const base = (lastName ?? 'REFER').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 6) || 'REFER';
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = `${base}${suffix(attempt < 2 ? 3 : 5)}`;
    const { error } = await sb.from('referral_codes').insert({ org_id: orgId, lo_id: loId, code });
    if (!error) return code;
  }
  // Last resort: fully random.
  const code = `R${suffix(7)}`;
  await sb.from('referral_codes').insert({ org_id: orgId, lo_id: loId, code });
  return code;
}
