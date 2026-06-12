// Phase 84 — Docs & Compliance hub, anchored by the TRID delivery clock + event log.
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect, notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTRIDStatus, tridBusinessDaysRemaining } from '@/lib/compliance/trid';
import { TRIDClockWidget } from '@/components/trid/TRIDClockWidget';
import { TRIDAlertBanner } from '@/components/trid/TRIDAlertBanner';
import { RateLockCountdown } from '@/components/trid/RateLockCountdown';
import { TRIDEventLog, type TridEventRow } from '@/components/trid/TRIDEventLog';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name, stage, application_submitted_at, loan_estimate_sent_at, closing_disclosure_sent_at, closing_date')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  const status = getTRIDStatus(lead as Parameters<typeof getTRIDStatus>[0]);
  const leDays = status.le_deadline ? tridBusinessDaysRemaining(status.le_deadline) : null;
  const cdDays = status.cd_deadline ? tridBusinessDaysRemaining(status.cd_deadline) : null;

  const [{ data: events }, { data: lock }] = await Promise.all([
    sb.from('trid_events')
      .select('id, event_type, event_date, deadline_date, is_compliant, notes')
      .eq('org_id', orgId).eq('lead_id', params.loanId),
    sb.from('rate_lock_expirations')
      .select('rate, lock_expires_at').eq('lead_id', params.loanId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const lockDays = lock?.lock_expires_at ? tridBusinessDaysRemaining(new Date(lock.lock_expires_at)) : null;

  // Critical banner when LE or CD is ≤ 1 business day (or overdue) and not yet satisfied.
  const banners: { type: 'le' | 'cd'; deadline: string; days: number }[] = [];
  if ((status.le === 'overdue' || status.le === 'due_today' || (leDays !== null && leDays <= 1)) && status.le !== 'ok' && status.le !== 'not_applicable' && status.le_deadline) {
    banners.push({ type: 'le', deadline: status.le_deadline.toISOString().slice(0, 10), days: leDays ?? 0 });
  }
  if ((status.cd === 'overdue' || status.cd === 'due_today' || status.cd === 'blocked' || (cdDays !== null && cdDays <= 1)) && status.cd !== 'ok' && status.cd !== 'not_applicable' && status.cd_deadline) {
    banners.push({ type: 'cd', deadline: status.cd_deadline.toISOString().slice(0, 10), days: cdDays ?? 0 });
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-[18px] font-bold text-[var(--c-text)]">Docs &amp; Compliance</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">TRID delivery clock, rate lock, and the immutable event log.</p>
      </div>

      {banners.map((b) => (
        <TRIDAlertBanner key={b.type} type={b.type} deadline={b.deadline} daysRemaining={b.days} />
      ))}

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-[280px]"><TRIDClockWidget leadId={params.loanId} /></div>
        {lock?.lock_expires_at && lock.rate != null && lockDays !== null && (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-4">
            <p className="text-[12px] font-semibold text-[var(--c-text)] mb-2">Rate lock</p>
            <RateLockCountdown lockedRate={Number(lock.rate)} daysRemaining={lockDays} />
            <p className="text-[10px] text-[var(--c-label3)] mt-2">Expires {new Date(lock.lock_expires_at).toISOString().slice(0, 10)}</p>
          </div>
        )}
      </div>

      <TRIDEventLog events={(events ?? []) as TridEventRow[]} />
    </div>
  );
}
