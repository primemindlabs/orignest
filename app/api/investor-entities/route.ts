/**
 * Phase 55.2 — investor entity resolution.
 *   GET ?lead_id= → entities linked to this borrower + prior loans across those
 *                   entities (total exposure). EIN is never returned (only last4).
 *   POST          → create entity (EIN AES-256-GCM server-side) + link to borrower
 *                   and optionally to this loan.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt } from '@/lib/crypto/encrypt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const leadId = new URL(req.url).searchParams.get('lead_id');
  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: links } = await sb.from('borrower_entity_links').select('id, relationship, ownership_percentage, is_primary_signer, entity_id, investor_entities(id, name, entity_type, state_of_formation, ein_last4, is_verified)').eq('org_id', orgId).eq('lead_id', leadId);
  const entityIds = (links ?? []).map((l) => l.entity_id);

  // Prior loans across the same entities (excluding this lead) → total exposure.
  let priorLoans: { lead_id: string; loan_amount: number | null; name: string; stage: string }[] = [];
  if (entityIds.length) {
    const { data: loanLinks } = await sb.from('loan_entity_links').select('lead_id, leads(id, first_name, last_name, loan_amount, stage)').in('entity_id', entityIds).eq('org_id', orgId).neq('lead_id', leadId);
    const seen = new Set<string>();
    for (const ll of loanLinks ?? []) {
      const l = ll.leads as unknown as { id: string; first_name: string; last_name: string; loan_amount: number | null; stage: string } | null;
      if (l && !seen.has(l.id)) { seen.add(l.id); priorLoans.push({ lead_id: l.id, loan_amount: l.loan_amount, name: `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim(), stage: l.stage }); }
    }
  }
  return NextResponse.json({ entities: links ?? [], prior_loans: priorLoans });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { lead_id?: string; name?: string; entity_type?: string; state_of_formation?: string; ein?: string; relationship?: string; ownership_percentage?: number; is_primary_signer?: boolean; link_to_loan?: boolean };
  if (!b.lead_id || !b.name || !['owner', 'member', 'trustee', 'guarantor', 'manager', 'partner'].includes(b.relationship ?? '')) {
    return NextResponse.json({ error: 'lead_id, name and a valid relationship are required' }, { status: 400 });
  }
  if (b.ownership_percentage != null && (b.ownership_percentage < 0 || b.ownership_percentage > 100)) {
    return NextResponse.json({ error: 'ownership_percentage must be 0–100' }, { status: 400 });
  }

  const sb = createAdminClient();
  const ein = (b.ein ?? '').replace(/\D/g, '');
  const { data: entity, error: e1 } = await sb.from('investor_entities').insert({
    org_id: orgId, name: b.name, entity_type: b.entity_type ?? null, state_of_formation: b.state_of_formation ?? null,
    ein_encrypted: ein ? encrypt(ein) : null, ein_last4: ein ? ein.slice(-4) : null,
  }).select('id').single();
  if (e1 || !entity) { console.error('[investor-entities]', e1); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }

  await sb.from('borrower_entity_links').insert({ org_id: orgId, lead_id: b.lead_id, entity_id: entity.id, relationship: b.relationship, ownership_percentage: b.ownership_percentage ?? null, is_primary_signer: b.is_primary_signer ?? false });
  if (b.link_to_loan) await sb.from('loan_entity_links').insert({ org_id: orgId, lead_id: b.lead_id, entity_id: entity.id }).select('id').maybeSingle();

  return NextResponse.json({ entity_id: entity.id });
}
