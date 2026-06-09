import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getBorrowerRecord } from '@/lib/relationships/getBorrowerRecord';
import { RelationshipSidebar } from './RelationshipSidebar';

export const dynamic = 'force-dynamic';

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const HEALTH_TONE: Record<string, string> = { success: 'var(--c-success)', warning: 'var(--c-warning)', danger: 'var(--c-danger)' };

export default async function BorrowerRecordLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const rec = await getBorrowerRecord(params.id);
  if (!rec) notFound();

  const since = rec.firstCloseDate ? new Date(rec.firstCloseDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—';
  const lastTouch = rec.health.days_since_last_touch != null ? `${rec.health.days_since_last_touch}d ago` : 'never';

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-6">
      <header className="flex-shrink-0 bg-[var(--c-surface)] border-b border-[var(--c-border)] px-5 py-3">
        <Link href="/relationships" className="inline-flex items-center gap-1.5 text-[12px] text-[var(--c-label2)] hover:text-[var(--c-text)]"><ArrowLeft size={13} /> Book of Business</Link>
        <div className="flex items-baseline gap-3 flex-wrap mt-1">
          <h1 className="text-[18px] font-bold text-[var(--c-text)] tracking-tight">{rec.fullName}</h1>
          <span className="text-[12px] text-[var(--c-label2)]">Client since {since} · {rec.totalLoansClosed} loan{rec.totalLoansClosed === 1 ? '' : 's'} · {usd(rec.totalVolumeClosed)} volume</span>
        </div>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <Pill label={`Equity ${usd(rec.totals.equity)}`} />
          {rec.rateDelta != null && <Pill label={`Rate Δ ${rec.rateDelta > 0 ? '+' : ''}${rec.rateDelta.toFixed(2)}%`} />}
          <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--c-fill)', color: HEALTH_TONE[rec.health.color] }}>{rec.health.label} · {rec.health.score}</span>
          <Pill label={`Last touch ${lastTouch}`} />
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <RelationshipSidebar recordId={params.id} />
        <main className="flex-1 overflow-y-auto bg-[var(--c-bg)] p-6">{children}</main>
      </div>
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]">{label}</span>;
}
