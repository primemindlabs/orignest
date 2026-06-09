import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { determineFloodZone } from '@/lib/property/floodZone';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/loans/[loanId]/flood — determine flood zone (ATTOM→FEMA) and persist.
export async function POST(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, property_address, property_city, property_state, property_zip')
    .eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!lead.property_address) {
    return NextResponse.json({ error: 'No property address on file to determine flood zone.' }, { status: 422 });
  }

  const result = await determineFloodZone({
    line1: lead.property_address, city: lead.property_city, state: lead.property_state, zip: lead.property_zip,
  });

  if (!result) {
    return NextResponse.json({ error: 'Could not determine flood zone automatically. Enter it manually.', fallback: true }, { status: 200 });
  }

  await sb.from('leads').update({
    flood_zone: result.zone, flood_panel: result.panel_number, flood_zone_source: result.source,
    flood_zone_required: result.required, flood_zone_determined_at: result.determined_at,
  }).eq('id', params.loanId).eq('org_id', orgId);

  return NextResponse.json({ flood: result });
}
