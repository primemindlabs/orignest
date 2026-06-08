/**
 * Phase 1.3 — Duplicate lead detection (server-only)
 *
 * Finds active (non-archived) leads in the same org that match on email, phone,
 * or full name. Inputs are sanitized for the PostgREST `or` filter grammar.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export interface DuplicateLead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  stage: string;
  loan_type: string | null;
  created_at: string;
}

// Strip characters that have meaning in the PostgREST or()/filter grammar.
function sanitize(value: string): string {
  return value.replace(/[(),*]/g, ' ').trim();
}

export async function findDuplicateLeads(params: {
  orgId: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  excludeId?: string;
}): Promise<DuplicateLead[]> {
  const sb = createAdminClient();

  const ors: string[] = [];
  const email = params.email ? sanitize(params.email) : '';
  const phone = params.phone ? sanitize(params.phone) : '';
  const first = params.firstName ? sanitize(params.firstName) : '';
  const last = params.lastName ? sanitize(params.lastName) : '';

  if (email) ors.push(`email.ilike.${email}`);
  if (phone) ors.push(`phone.eq.${phone}`);
  if (first && last) ors.push(`and(first_name.ilike.${first},last_name.ilike.${last})`);
  if (ors.length === 0) return [];

  let query = sb
    .from('leads')
    .select('id, first_name, last_name, email, phone, stage, loan_type, created_at')
    .eq('org_id', params.orgId)
    .is('archived_at', null)
    .or(ors.join(','))
    .order('created_at', { ascending: false })
    .limit(5);

  if (params.excludeId) query = query.neq('id', params.excludeId);

  const { data } = await query;
  return (data ?? []) as DuplicateLead[];
}
