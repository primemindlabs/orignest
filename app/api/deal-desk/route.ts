// Phase 120 — AE Deal Desk: list + create pricing requests. Org + LO scoped.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const PURPOSES = ['purchase', 'rate_term_refi', 'cash_out', 'dscr', 'other'];
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function GET(_req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ requests: [] });

  const sb = createAdminClient();
  const { data } = await sb
    .from('ae_deal_desk_requests')
    .select('*, lead:leads(id, first_name, last_name, loan_amount)')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });

  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(request: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const leadId = (b.lead_id ?? '').toString();
  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

  const purpose = b.loan_purpose ? b.loan_purpose.toString() : null;
  if (purpose && !PURPOSES.includes(purpose)) return NextResponse.json({ error: 'Invalid loan_purpose' }, { status: 400 });

  const sb = createAdminClient();

  // Resolve LO profile + confirm the lead belongs to this org.
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: lead } = await sb.from('leads').select('id').eq('id', leadId).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  // Snapshot AE contact from the LO's lender connections (if one is chosen).
  let lenderName: string | null = b.lender_name ? b.lender_name.toString() : null;
  let aeName: string | null = null;
  let aeEmail: string | null = null;
  const aeId = b.lender_ae_id ? b.lender_ae_id.toString() : null;
  if (aeId) {
    const { data: ae } = await sb
      .from('lender_ae_connections')
      .select('lender_name, ae_name, ae_email')
      .eq('id', aeId)
      .eq('org_id', orgId)
      .maybeSingle();
    if (ae) { lenderName = (ae.lender_name as string) ?? lenderName; aeName = (ae.ae_name as string) ?? null; aeEmail = (ae.ae_email as string) ?? null; }
  }

  const { data, error } = await sb
    .from('ae_deal_desk_requests')
    .insert({
      org_id: orgId,
      lo_id: profile.id,
      lead_id: leadId,
      lender_ae_id: aeId,
      lender_name: lenderName,
      ae_name: aeName,
      ae_email: aeEmail,
      loan_type: b.loan_type ? b.loan_type.toString() : null,
      loan_amount: num(b.loan_amount),
      ltv: num(b.ltv),
      fico_score: num(b.fico_score),
      property_type: b.property_type ? b.property_type.toString() : null,
      loan_purpose: purpose,
      occupancy: b.occupancy ? b.occupancy.toString() : null,
      requested_rate: num(b.requested_rate),
      requested_price: num(b.requested_price),
      lock_period_days: num(b.lock_period_days) ?? 30,
      exception_reason: b.exception_reason ? b.exception_reason.toString().slice(0, 2000) : null,
      notes: b.notes ? b.notes.toString().slice(0, 2000) : null,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
