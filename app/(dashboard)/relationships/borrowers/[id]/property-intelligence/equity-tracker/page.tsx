import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { getBorrowerRecord } from '@/lib/relationships/getBorrowerRecord';
import { EquityChart, type SnapshotPoint } from '@/components/relationships/EquityChart';
import { EQUITY_MILESTONES } from '@/lib/relationships/refiWatch';

export const dynamic = 'force-dynamic';

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default async function EquityTrackerPage({ params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const rec = await getBorrowerRecord(params.id);
  if (!rec) notFound();

  const sb = createAdminClient();
  const { data: snaps } = await sb
    .from('portfolio_snapshots')
    .select('snapshot_date, total_avm, total_balance, total_equity')
    .eq('relationship_id', params.id).eq('org_id', orgId)
    .order('snapshot_date', { ascending: true })
    .limit(24);

  const points: SnapshotPoint[] = (snaps ?? []).map((s) => ({ date: s.snapshot_date, avm: Number(s.total_avm), balance: Number(s.total_balance), equity: Number(s.total_equity) }));
  // Seed a current point from live totals so the chart isn't empty before the first cron run.
  if (points.length === 0 && rec.totals.avm > 0) {
    points.push({ date: new Date().toISOString().slice(0, 10), avm: rec.totals.avm, balance: rec.totals.balance, equity: rec.totals.equity });
  }

  const currentEquity = rec.totals.equity;
  const nextMilestone = EQUITY_MILESTONES.find((m) => m > currentEquity) ?? null;
  const lastCrossed = [...EQUITY_MILESTONES].reverse().find((m) => m <= currentEquity) ?? null;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Equity Tracker</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Portfolio value, balance, and the equity gap over time.</p>
      </div>

      <EquityChart points={points} />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Current Equity" value={usd(currentEquity)} gold />
        <Stat label="Last Milestone" value={lastCrossed ? usd(lastCrossed) : '—'} />
        <Stat label="Next Milestone" value={nextMilestone ? usd(nextMilestone) : 'Max' } />
      </div>

      {nextMilestone && (
        <div className="bg-[var(--c-gold-light)] border border-[var(--c-gold)]/30 rounded-[14px] p-4">
          <p className="text-[13px] text-[var(--c-text)]">
            <span className="font-semibold">{usd(nextMilestone - currentEquity)}</span> from the {usd(nextMilestone)} equity milestone — a natural moment for a check-in call.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
      <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)] mb-1">{label}</p>
      <p className="text-[18px] font-mono tabular-nums font-bold" style={{ color: gold ? 'var(--c-gold-deep)' : 'var(--c-text)' }}>{value}</p>
    </div>
  );
}
