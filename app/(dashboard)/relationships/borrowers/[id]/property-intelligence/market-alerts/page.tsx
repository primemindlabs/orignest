import { getBorrowerRecord } from '@/lib/relationships/getBorrowerRecord';
import { notFound } from 'next/navigation';
import { Bell, BellRing } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MarketAlertsPage({ params }: { params: { id: string } }) {
  const rec = await getBorrowerRecord(params.id);
  if (!rec) notFound();
  const currentRate = Number(process.env.CURRENT_MARKET_RATE) || 6.5;
  const delta = rec.rateDelta;
  const triggered = delta != null && delta >= rec.refiThreshold;

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Market Alerts</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Rate monitoring for this borrower.</p>
      </div>
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 flex items-start gap-4">
        <div className="w-11 h-11 rounded-[12px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: triggered ? 'var(--c-gold)' : 'var(--c-fill)' }}>
          {triggered ? <BellRing size={20} className="text-white" /> : <Bell size={20} className="text-[var(--c-label2)]" />}
        </div>
        <div>
          <p className="text-[15px] font-semibold" style={{ color: triggered ? 'var(--c-gold-deep)' : 'var(--c-text)' }}>
            {triggered ? 'Alert triggered — outreach recommended' : 'Watching'}
          </p>
          <p className="text-[13px] text-[var(--c-label2)] mt-1">
            Current market rate {currentRate.toFixed(3)}% · alert threshold {rec.refiThreshold}% drop ·
            {delta != null ? ` current delta ${delta > 0 ? '+' : ''}${delta.toFixed(3)}%` : ' no original rate on file'}
          </p>
        </div>
      </div>
      <p className="text-[12px] text-[var(--c-label3)]">When the delta crosses the threshold a rate-drop retention event is logged and the LO is notified to reach out. AI-drafted outreach lands here once Relay is connected.</p>
    </div>
  );
}
