import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/investors — investor entities with aggregated portfolio metrics
 * (property count, total loan volume, total value, estimated equity) computed
 * from their linked loans.
 */
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();
  const [{ data: entities }, { data: links }] = await Promise.all([
    sb.from('investor_entities').select('*').eq('org_id', orgId).order('name'),
    sb
      .from('investor_properties')
      .select('entity_id, leads(loan_amount, estimated_value, original_loan_amount, property_city, property_state)')
      .eq('org_id', orgId),
  ]);

  const agg = new Map<string, { properties: number; loanVolume: number; totalValue: number; equity: number }>();
  for (const l of links ?? []) {
    const lead = l.leads as { loan_amount?: number; estimated_value?: number; original_loan_amount?: number } | null;
    const a = agg.get(l.entity_id as string) ?? { properties: 0, loanVolume: 0, totalValue: 0, equity: 0 };
    const loan = Number(lead?.loan_amount) || 0;
    const value = Number(lead?.estimated_value) || 0;
    const balance = Number(lead?.original_loan_amount) || loan;
    a.properties += 1;
    a.loanVolume += loan;
    a.totalValue += value;
    a.equity += Math.max(0, value - balance);
    agg.set(l.entity_id as string, a);
  }

  const result = (entities ?? []).map((e) => ({
    ...e,
    portfolio: agg.get(e.id as string) ?? { properties: 0, loanVolume: 0, totalValue: 0, equity: 0 },
  }));

  return NextResponse.json({ entities: result, deedmineEnabled: !!process.env.DEEDMINE_API_KEY });
}

/** POST /api/investors — create an investor entity. */
export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  const ENTITY_TYPES = new Set(['individual', 'llc', 'lp', 'trust', 'corporation', 'partnership']);
  const entity_type = ENTITY_TYPES.has(body.entity_type) ? body.entity_type : 'individual';

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('investor_entities')
    .insert({
      org_id: orgId,
      name: body.name.trim(),
      entity_type,
      contact_email: body.contact_email || null,
      contact_phone: body.contact_phone || null,
      notes: body.notes || null,
    })
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entity: data }, { status: 201 });
}
