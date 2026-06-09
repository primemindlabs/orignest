import { getBorrowerRecord } from '@/lib/relationships/getBorrowerRecord';
import { notFound } from 'next/navigation';
import { computeRefiOpportunity } from '@/lib/relationships/refiWatch';

export const dynamic = 'force-dynamic';

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default async function RefiWatchPage({ params }: { params: { id: string } }) {
  const rec = await getBorrowerRecord(params.id);
  if (!rec) notFound();
  const currentRate = Number(process.env.CURRENT_MARKET_RATE) || 6.5;
  const threshold = rec.refiThreshold;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Refi Watch</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Per-property refi analysis at today&apos;s market rate ({currentRate.toFixed(3)}%). Alert threshold: {threshold}% drop.</p>
      </div>

      {rec.properties.length === 0 && <p className="text-[13px] text-[var(--c-label3)]">No properties to analyze yet.</p>}

      <div className="space-y-3">
        {rec.properties.map((p) => {
          const o = computeRefiOpportunity(
            { original_loan_amount: p.original_loan_amount, original_rate: p.original_rate, current_balance: p.current_balance, purchase_date: p.purchase_date },
            currentRate
          );
          const opportunity = o.rate_delta != null && o.rate_delta >= threshold && o.worth_it;
          const watching = o.rate_delta != null && o.rate_delta < threshold;
          return (
            <div key={p.id} className="bg-[var(--c-surface)] rounded-[14px] p-5 border" style={{ borderColor: opportunity ? 'var(--c-gold)' : 'var(--c-border)' }}>
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-[14px] font-semibold text-[var(--c-text)]">{p.address_line1}, {p.address_city}</p>
                {opportunity ? (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]">Rate drop opportunity</span>
                ) : watching ? (
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[var(--c-fill)] text-[var(--c-label2)]">Watching — not yet worth it</span>
                ) : (
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[var(--c-fill)] text-[var(--c-label3)]">No original rate on file</span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Mini label="Original Rate" value={p.original_rate != null ? `${Number(p.original_rate).toFixed(3)}%` : '—'} />
                <Mini label="Rate Δ" value={o.rate_delta != null ? `${o.rate_delta > 0 ? '+' : ''}${o.rate_delta.toFixed(3)}%` : '—'} />
                <Mini label="Monthly Savings" value={o.monthly_savings ? usd(o.monthly_savings) : '—'} gold />
                <Mini label="Break-Even" value={o.break_even_months != null ? `${o.break_even_months} mo` : '—'} />
              </div>
              {o.monthly_savings > 0 && (
                <p className="text-[12px] text-[var(--c-label2)] mt-3">5-year savings ≈ <span className="font-mono text-[var(--c-text)]">{usd(o.five_year_savings)}</span> (est. {usd(5000)} closing costs).</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[var(--c-label3)]">{label}</p>
      <p className="text-[15px] font-mono tabular-nums font-semibold" style={{ color: gold ? 'var(--c-gold-deep)' : 'var(--c-text)' }}>{value}</p>
    </div>
  );
}
