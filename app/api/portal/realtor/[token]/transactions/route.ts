import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/portal/realtor/[token]/transactions — every loan this realtor is linked
// to with this LO/org (Phase 28.8). Token-gated, NO financial fields returned —
// only transaction-level data (status, address, close date, loan size).
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const sb = createAdminClient();

  const { data: realtor } = await sb
    .from('portal_realtors')
    .select('id, org_id, realtor_email, revoked, token_expires_at, approved_by_lo')
    .eq('token', params.token)
    .maybeSingle();

  if (!realtor || realtor.revoked || !realtor.approved_by_lo) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (realtor.token_expires_at && new Date(realtor.token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Expired' }, { status: 404 });
  }

  // All non-revoked portal_realtors with the same email in this org → their leads.
  const { data: links } = await sb
    .from('portal_realtors')
    .select('lead_id')
    .eq('org_id', realtor.org_id)
    .eq('realtor_email', realtor.realtor_email)
    .eq('revoked', false);

  const leadIds = Array.from(new Set((links ?? []).map((l) => l.lead_id)));
  if (leadIds.length === 0) return NextResponse.json({ transactions: [], totalVolume: 0 });

  const { data: leads } = await sb
    .from('leads')
    .select('id, first_name, last_name, stage, property_address, property_city, property_state, closing_date, loan_amount, created_at')
    .in('id', leadIds)
    .order('created_at', { ascending: false });

  const transactions = (leads ?? []).map((l) => ({
    id: l.id,
    borrower: `${l.first_name ?? ''} ${l.last_name ? l.last_name[0] + '.' : ''}`.trim(),
    address: [l.property_address, l.property_city, l.property_state].filter(Boolean).join(', ') || null,
    stage: l.stage,
    closing_date: l.closing_date,
    loan_amount: l.loan_amount,
    closed: l.stage === 'closed',
  }));

  const totalVolume = transactions.reduce((s, t) => s + (Number(t.loan_amount) || 0), 0);
  return NextResponse.json({ transactions, totalVolume });
}
