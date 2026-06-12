// Phase 84 — GET TRID countdown status for one loan: LE/CD business days remaining +
// color states, plus rate-lock days remaining (from rate_lock_expirations).

import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTRIDStatus, tridBusinessDaysRemaining, getTRIDColorState } from '@/lib/compliance/trid';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  try {
    const { userId, orgId } = await getOrgContext();
    if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sb = createAdminClient();
    const { data: lead } = await sb
      .from('leads')
      .select('id, first_name, last_name, stage, application_submitted_at, loan_estimate_sent_at, closing_disclosure_sent_at, closing_date')
      .eq('id', params.loanId)
      .eq('org_id', orgId)
      .maybeSingle();
    if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    const status = getTRIDStatus(lead as Parameters<typeof getTRIDStatus>[0]);

    const leBiz = status.le_deadline ? tridBusinessDaysRemaining(status.le_deadline) : null;
    const cdBiz = status.cd_deadline ? tridBusinessDaysRemaining(status.cd_deadline) : null;

    // Rate lock (latest expiration row, if any).
    const { data: lock } = await sb
      .from('rate_lock_expirations')
      .select('rate, lock_expires_at, lock_period_days, status')
      .eq('lead_id', params.loanId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const lockBiz = lock?.lock_expires_at ? tridBusinessDaysRemaining(new Date(lock.lock_expires_at)) : null;

    return NextResponse.json({
      lead_id: lead.id,
      le: status.le,
      cd: status.cd,
      le_deadline: status.le_deadline ? status.le_deadline.toISOString().slice(0, 10) : null,
      cd_deadline: status.cd_deadline ? status.cd_deadline.toISOString().slice(0, 10) : null,
      le_days_remaining: leBiz,
      cd_days_remaining: cdBiz,
      le_color: leBiz !== null ? getTRIDColorState(leBiz) : null,
      cd_color: cdBiz !== null ? getTRIDColorState(cdBiz) : null,
      rate_lock: lock
        ? {
            rate: lock.rate,
            expiry: lock.lock_expires_at ? new Date(lock.lock_expires_at).toISOString().slice(0, 10) : null,
            days_remaining: lockBiz,
            status: lock.status,
          }
        : null,
    });
  } catch (err) {
    console.error('[trid-status]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
