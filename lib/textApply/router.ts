/**
 * Phase 68 — branch round-robin lead routing with specialty weighting. SERVER-ONLY.
 * For a branch keyword, route to the LO who (a) lists the matching loan specialty and
 * (b) was assigned a lead least recently. Falls back to plain round-robin across all
 * active LOs. Stamps last_lead_assigned_at on assignment.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

const LO_ROLES = ['loan_officer', 'lo'];

export async function routeInboundKeyword(orgId: string, loanProgram: string): Promise<string | null> {
  const sb = createAdminClient();
  // 1. Specialists first (least-recently-assigned).
  const { data: specialists } = await sb.from('profiles').select('id, last_lead_assigned_at').eq('org_id', orgId).contains('loan_specialties', [loanProgram]).order('last_lead_assigned_at', { ascending: true, nullsFirst: true }).limit(1);
  let chosen = specialists?.[0]?.id ?? null;

  // 2. Fall back to any active LO, round-robin.
  if (!chosen) {
    const { data: los } = await sb.from('profiles').select('id, last_lead_assigned_at').eq('org_id', orgId).in('role', LO_ROLES).order('last_lead_assigned_at', { ascending: true, nullsFirst: true }).limit(1);
    chosen = los?.[0]?.id ?? null;
  }
  if (chosen) await sb.from('profiles').update({ last_lead_assigned_at: new Date().toISOString() }).eq('id', chosen);
  return chosen;
}
