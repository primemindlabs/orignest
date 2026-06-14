/** Phase 131 — shared scan context: the LO's book + market rate + equity/heat joins. */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCurrentMarketRate } from './marketRates';

export interface GoldmineLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  stage: string | null;
  original_rate: number | null;
  loan_amount: number | null;
  closed_date: string | null;
  last_contacted_at: string | null;
}

export interface GoldmineRelationship {
  id: string;
  lead_ids: string[];
  estimated_equity: number | null;
  last_known_avm: number | null;
  current_loan_balance: number | null;
  last_close_date: string | null;
}

export interface GoldmineContext {
  sb: SupabaseClient;
  loId: string;
  orgId: string;
  loFirstName: string;
  compRate: number | null;
  marketRate: number;
  leads: GoldmineLead[];
  leadById: Map<string, GoldmineLead>;
  relationships: GoldmineRelationship[];
  heatByLead: Map<string, { band: string; days_since_last_contact: number | null }>;
}

export function fullName(l: { first_name: string | null; last_name: string | null }): string {
  return `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || 'Past client';
}

export async function buildGoldmineContext(
  sb: SupabaseClient,
  loId: string,
  orgId: string,
  loFirstName: string,
  compRate: number | null,
): Promise<GoldmineContext> {
  const [{ data: leadsData }, { data: relData }, marketRate] = await Promise.all([
    sb
      .from('leads')
      .select('id, first_name, last_name, phone, email, stage, original_rate, loan_amount, closed_date, last_contacted_at')
      .eq('org_id', orgId)
      .eq('assigned_to', loId)
      .is('archived_at', null)
      .limit(5000),
    sb.from('borrower_relationships').select('id, lead_ids, estimated_equity, last_known_avm, current_loan_balance, last_close_date').eq('org_id', orgId),
    getCurrentMarketRate(sb, '30yr_fixed'),
  ]);

  const leads = (leadsData ?? []) as GoldmineLead[];
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const leadIdSet = new Set(leads.map((l) => l.id));

  // Only relationships that touch one of this LO's leads.
  const relationships = ((relData ?? []) as GoldmineRelationship[]).filter((r) =>
    Array.isArray(r.lead_ids) && r.lead_ids.some((id) => leadIdSet.has(id)),
  );

  // Latest heat snapshot per lead.
  const heatByLead = new Map<string, { band: string; days_since_last_contact: number | null }>();
  if (leadIdSet.size) {
    const { data: heat } = await sb
      .from('borrower_heat_scores')
      .select('lead_id, band, days_since_last_contact, computed_at')
      .eq('org_id', orgId)
      .order('computed_at', { ascending: false });
    for (const h of (heat ?? []) as { lead_id: string; band: string; days_since_last_contact: number | null }[]) {
      if (leadIdSet.has(h.lead_id) && !heatByLead.has(h.lead_id)) {
        heatByLead.set(h.lead_id, { band: h.band, days_since_last_contact: h.days_since_last_contact });
      }
    }
  }

  return { sb, loId, orgId, loFirstName, compRate, marketRate, leads, leadById, relationships, heatByLead };
}
