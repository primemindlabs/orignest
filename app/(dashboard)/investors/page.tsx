import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';
import InvestorsClient, { type Entity, type LeadOption } from './InvestorsClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Investors' };

export default async function InvestorsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const [{ data: entities }, { data: links }, { data: leads }] = await Promise.all([
    sb.from('investor_entities').select('*').eq('org_id', orgId).order('name'),
    sb
      .from('investor_properties')
      .select('entity_id, lead_id, leads(first_name, last_name, loan_amount, estimated_value, original_loan_amount, property_city, property_state)')
      .eq('org_id', orgId),
    sb
      .from('leads')
      .select('id, first_name, last_name, property_city, property_state, loan_amount')
      .eq('org_id', orgId)
      .order('first_name'),
  ]);

  type Agg = { properties: number; loanVolume: number; totalValue: number; equity: number; items: { lead_id: string; label: string }[] };
  const agg = new Map<string, Agg>();
  for (const l of links ?? []) {
    const lead = l.leads as any;
    const a = agg.get(l.entity_id as string) ?? { properties: 0, loanVolume: 0, totalValue: 0, equity: 0, items: [] };
    const loan = Number(lead?.loan_amount) || 0;
    const value = Number(lead?.estimated_value) || 0;
    const balance = Number(lead?.original_loan_amount) || loan;
    a.properties += 1;
    a.loanVolume += loan;
    a.totalValue += value;
    a.equity += Math.max(0, value - balance);
    a.items.push({
      lead_id: l.lead_id as string,
      label: `${lead?.first_name ?? ''} ${lead?.last_name ?? ''}`.trim() + (lead?.property_city ? ` · ${lead.property_city}, ${lead.property_state ?? ''}` : ''),
    });
    agg.set(l.entity_id as string, a);
  }

  const flatEntities: Entity[] = (entities ?? []).map((e) => {
    const a = agg.get(e.id as string) ?? { properties: 0, loanVolume: 0, totalValue: 0, equity: 0, items: [] };
    return {
      id: e.id as string,
      name: e.name as string,
      entity_type: e.entity_type as string,
      contact_email: (e.contact_email as string) ?? null,
      portfolio: { properties: a.properties, loanVolume: a.loanVolume, totalValue: a.totalValue, equity: a.equity },
      properties: a.items,
    };
  });

  const leadOptions: LeadOption[] = (leads ?? []).map((l) => ({
    id: l.id as string,
    label: `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() + (l.property_city ? ` · ${l.property_city}, ${l.property_state ?? ''}` : ''),
  }));

  return <InvestorsClient entities={flatEntities} leads={leadOptions} deedmineEnabled={!!process.env.DEEDMINE_API_KEY} />;
}
