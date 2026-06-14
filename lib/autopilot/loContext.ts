/** Phase 128 — resolve the internal LO profile from a Clerk user id. */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoSignatureContext } from './types';

export interface LoProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nmls_id: string | null;
  org_id: string | null;
}

export async function resolveLoProfile(sb: SupabaseClient, clerkUserId: string): Promise<LoProfile | null> {
  const { data } = await sb
    .from('profiles')
    .select('id, first_name, last_name, nmls_id, org_id')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();
  return (data as LoProfile | null) ?? null;
}

export function toSignatureContext(p: LoProfile, company: string | null): LoSignatureContext {
  return { loId: p.id, firstName: p.first_name, lastName: p.last_name, nmls: p.nmls_id, company };
}

/** UTC date string (YYYY-MM-DD) used for generated_date — matches the cron + DB default. */
export function todayStr(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
