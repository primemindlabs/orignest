// Phase 104 — initialize the extension wizard for a loan: lock context, TRID conflicts,
// and the LO's AE contacts. Org-scoped (Clerk). No records created here.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { tridBusinessDaysRemaining } from '@/lib/compliance/trid';

type Ctx = { params: Promise<{ leadId: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { leadId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();

  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name, loan_amount, loan_type, stage, closing_date')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const { data: lock } = await sb
    .from('rate_lock_requests')
    .select('id, requested_lock_expiration, extension_status, requested_rate')
    .eq('lead_id', leadId)
    .eq('org_id', orgId)
    .not('requested_lock_expiration', 'is', null)
    .not('status', 'in', '(cancelled,declined)')
    .order('requested_lock_expiration', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!lock) {
    return NextResponse.json({ error: 'No active rate lock found for this loan' }, { status: 404 });
  }

  const today = new Date();
  const expiry = lock.requested_lock_expiration as string;
  const businessDaysLeft = tridBusinessDaysRemaining(new Date(expiry), today);
  if (businessDaysLeft > 5) {
    return NextResponse.json({ error: 'Rate lock not within 5-business-day extension window' }, { status: 422 });
  }

  // TRID conflicts: any LE/CD deadline falling within the lock window.
  const { data: tridConflicts } = await sb
    .from('trid_events')
    .select('event_type, deadline_date')
    .eq('lead_id', leadId)
    .eq('org_id', orgId)
    .not('deadline_date', 'is', null)
    .gte('deadline_date', today.toISOString().slice(0, 10))
    .lte('deadline_date', expiry);

  // AE contacts for the org (leads carry no lender_name, so we surface all active AEs,
  // preferred first, for the LO to choose).
  const { data: aeConnections } = await sb
    .from('lender_ae_connections')
    .select('id, lender_name, ae_name, ae_email, ae_phone, ae_cell, ae_title, preferred')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('preferred', { ascending: false })
    .order('lender_name', { ascending: true });

  const firstInitial = (lead.last_name as string | null)?.[0] ?? '';
  return NextResponse.json({
    lead: {
      id: lead.id,
      display_name: `${lead.first_name ?? ''} ${firstInitial ? firstInitial + '.' : ''}`.trim(),
      loan_amount: lead.loan_amount != null ? Number(lead.loan_amount) : null,
      loan_type: lead.loan_type ?? null,
      stage: lead.stage,
      closing_date_target: lead.closing_date ?? null,
    },
    alert: {
      id: lock.id,
      lock_expiry_date: expiry,
      lock_ref_number: null,
      extension_status: lock.extension_status ?? 'none',
      business_days_left: businessDaysLeft,
    },
    trid_conflicts: tridConflicts ?? [],
    ae_connections: aeConnections ?? [],
  });
}
