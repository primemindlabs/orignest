// PATCH /api/leads/[id] — edit core loan-file fields from the lead detail page.
// Writes the canonical leads columns the whole app reads (pipeline, PPE, LTV,
// commission), so an edit here propagates everywhere. Org-scoped + whitelisted.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NUMERIC = new Set(['loan_amount', 'estimated_value', 'down_payment', 'commission_rate']);
const STRING = new Set([
  'loan_purpose', 'loan_type', 'property_type', 'occupancy_type', 'closing_date',
  'property_address', 'property_city', 'property_state', 'property_zip',
]);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (NUMERIC.has(k)) {
      update[k] = v === '' || v == null ? null : Number(v);
      if (Number.isNaN(update[k] as number)) return NextResponse.json({ error: `Invalid number for ${k}` }, { status: 400 });
    } else if (STRING.has(k)) {
      update[k] = v === '' || v == null ? null : String(v);
    }
    // ignore any non-whitelisted key
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });

  const sb = createAdminClient();
  // Confirm the lead is in this org before writing.
  const { data: lead } = await sb.from('leads').select('id').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const { data, error } = await sb
    .from('leads')
    .update(update)
    .eq('id', params.id)
    .eq('org_id', orgId)
    .select('id, loan_purpose, loan_type, loan_amount, estimated_value, down_payment, property_type, occupancy_type, closing_date, commission_rate')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, lead: data });
}
