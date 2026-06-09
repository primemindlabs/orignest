import { Home } from 'lucide-react';
import type { PortfolioProperty } from '@/lib/relationships/getBorrowerRecord';

const usd = (n: number | null) => (n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n));

export function PortfolioPanel({
  properties,
  totals,
  yearDelta,
}: {
  properties: PortfolioProperty[];
  totals: { avm: number; balance: number; equity: number };
  yearDelta?: { value: number; equity: number } | null;
}) {
  return (
    <div className="space-y-4">
      {/* Overview card */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
        <h2 className="text-[13px] font-semibold text-[var(--c-text)] mb-4">Portfolio</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Stat label="Total Value" value={usd(totals.avm)} delta={yearDelta?.value} />
          <Stat label="Total Equity" value={usd(totals.equity)} delta={yearDelta?.equity} gold />
          <Stat label="Properties" value={String(properties.length)} />
        </div>
      </div>

      {/* Property cards */}
      <div className="space-y-3">
        {properties.length === 0 && <p className="text-[13px] text-[var(--c-label3)] text-center py-6">No properties yet. They appear automatically when a loan funds.</p>}
        {properties.map((p) => (
          <div key={p.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Home size={15} className="text-[var(--c-label2)]" />
              <p className="text-[14px] font-semibold text-[var(--c-text)]">{p.address_line1}, {p.address_city} {p.address_state}</p>
              {p.is_primary_residence && <span className="text-[10px] text-[var(--c-gold-deep)] bg-[var(--c-gold-light)] px-1.5 py-0.5 rounded-full">Primary</span>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Mini label="Est. Value" value={usd(p.current_avm)} sub={p.avm_source ?? 'pending AVM'} />
              <Mini label="Balance" value={usd(p.current_balance)} sub="borrower-entered" />
              <Mini label="Equity" value={usd(p.estimated_equity)} sub="" gold />
            </div>
            <p className="text-[11px] text-[var(--c-label3)] mt-3">
              Original {usd(p.original_loan_amount)}{p.original_rate ? ` · ${Number(p.original_rate).toFixed(3)}%` : ''}{p.purchase_date ? ` · Closed ${new Date(p.purchase_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}{p.loan_program ? ` · ${p.loan_program.toUpperCase()}` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, delta, gold }: { label: string; value: string; delta?: number | null; gold?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[var(--c-label3)] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-[24px] font-bold font-mono tabular-nums leading-none" style={{ color: gold ? 'var(--c-gold-deep)' : 'var(--c-text)' }}>{value}</p>
      {delta != null && delta !== 0 && (
        <p className="text-[12px] font-medium mt-1" style={{ color: delta > 0 ? 'var(--c-gold-deep)' : 'var(--c-label2)' }}>
          {delta > 0 ? '↑' : '↓'} {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(delta))} this year
        </p>
      )}
    </div>
  );
}
function Mini({ label, value, sub, gold }: { label: string; value: string; sub: string; gold?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[var(--c-label3)]">{label}</p>
      <p className="text-[15px] font-mono tabular-nums font-semibold" style={{ color: gold ? 'var(--c-gold-deep)' : 'var(--c-text)' }}>{value}</p>
      {sub && <p className="text-[10px] text-[var(--c-label3)]">{sub}</p>}
    </div>
  );
}
