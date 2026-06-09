import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { computeRelationshipHealth, type RelationshipHealth } from './healthScore';

export interface PortfolioProperty {
  id: string;
  lead_id: string | null;
  address_line1: string;
  address_city: string;
  address_state: string;
  property_type: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  original_loan_amount: number | null;
  original_rate: number | null;
  loan_program: string | null;
  current_avm: number | null;
  avm_source: string | null;
  current_balance: number | null;
  estimated_equity: number | null;
  is_primary_residence: boolean | null;
  is_active: boolean | null;
}

export interface BorrowerRecord {
  id: string;
  orgId: string;
  fullName: string;
  email: string;
  phone: string | null;
  firstCloseDate: string | null;
  totalLoansClosed: number;
  totalVolumeClosed: number;
  rateDelta: number | null;
  refiThreshold: number;
  properties: PortfolioProperty[];
  totals: { avm: number; balance: number; equity: number };
  health: RelationshipHealth;
}

export async function getBorrowerRecord(id: string): Promise<BorrowerRecord | null> {
  const { orgId } = await getOrgContext();
  if (!orgId) return null;
  const sb = createAdminClient();

  const { data: rel } = await sb
    .from('borrower_relationships')
    .select('id, email, full_name, phone, first_close_date, total_loans_closed, total_volume_closed, rate_delta, refi_alert_threshold')
    .eq('id', id).eq('org_id', orgId).maybeSingle();
  if (!rel) return null;

  const [{ data: props }, { data: events }] = await Promise.all([
    sb.from('portfolio_properties').select('*').eq('relationship_id', id).eq('org_id', orgId).eq('is_active', true).order('purchase_date', { ascending: false }),
    sb.from('retention_events').select('event_type, created_at').eq('relationship_id', id).eq('org_id', orgId).order('created_at', { ascending: false }).limit(200),
  ]);

  const properties = (props ?? []) as PortfolioProperty[];
  const totals = properties.reduce(
    (s, p) => ({
      avm: s.avm + (Number(p.current_avm) || 0),
      balance: s.balance + (Number(p.current_balance) || 0),
      equity: s.equity + (Number(p.estimated_equity) || 0),
    }),
    { avm: 0, balance: 0, equity: 0 }
  );

  return {
    id: rel.id, orgId,
    fullName: rel.full_name, email: rel.email, phone: rel.phone,
    firstCloseDate: rel.first_close_date,
    totalLoansClosed: rel.total_loans_closed ?? 0,
    totalVolumeClosed: Number(rel.total_volume_closed) || 0,
    rateDelta: rel.rate_delta != null ? Number(rel.rate_delta) : null,
    refiThreshold: Number(rel.refi_alert_threshold ?? 0.75),
    properties,
    totals,
    health: computeRelationshipHealth(events ?? []),
  };
}
