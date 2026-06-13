// Phase 112 — DSCR lender comparison: the LO's active AE connections, flagged for
// DSCR capability (loan_types includes a DSCR product). Reuses lender_ae_connections
// (Phase 89). Read-only.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ lenders: [] });

  const sb = createAdminClient();
  const { data: aes } = await sb
    .from('lender_ae_connections')
    .select('id, lender_name, ae_name, ae_email, ae_phone, ae_cell, loan_types, preferred')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('preferred', { ascending: false })
    .order('lender_name', { ascending: true });

  const lenders = (aes ?? []).map((a) => {
    const types = (a.loan_types as string[] | null) ?? [];
    const dscr = types.some((t) => /dscr|non.?qm|investor|commercial/i.test(t));
    return {
      id: a.id,
      lender_name: a.lender_name,
      ae_name: a.ae_name,
      ae_email: a.ae_email,
      ae_phone: a.ae_cell ?? a.ae_phone,
      preferred: !!a.preferred,
      offers_dscr: dscr,
    };
  });

  return NextResponse.json({ lenders });
}
