/**
 * Phase 75 — shared money bar.
 *
 * Display-only here (used on the immersive dashboard). The pipeline page keeps its
 * own inline bar with an editable comp-rate metric (Phase 74); `onCompRateChange`
 * is reserved for a future shared-editable variant.
 */
import { IconAlertTriangle, IconTrendingUp, IconTrendingDown } from '@tabler/icons-react';

export interface MoneyBarProps {
  mtdVolume: number;
  mtdLoanCount: number;
  closingVolume: number;
  closingCount: number;
  estimatedCommission: number;
  compRate: number;
  onCompRateChange?: (rate: number) => void;
  pullThrough: number | null;
  pullThroughDelta?: number | null;
  alertCount: number;
}

const full = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const cell: React.CSSProperties = { padding: '11px 16px', borderRight: '0.5px solid rgba(0,0,0,0.06)' };
const cap: React.CSSProperties = { fontSize: 11, color: '#6E6E73', marginBottom: 2 };
const val: React.CSSProperties = { fontSize: 19, fontWeight: 500, fontFamily: "'DM Mono', monospace" };
const sub: React.CSSProperties = { fontSize: 11, color: '#6E6E73', marginTop: 1 };

export function MoneyBar({
  mtdVolume,
  mtdLoanCount,
  closingVolume,
  closingCount,
  estimatedCommission,
  compRate,
  pullThrough,
  pullThroughDelta,
  alertCount,
}: MoneyBarProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        background: '#ffffff',
        border: '0.5px solid rgba(0,0,0,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 8,
      }}
    >
      <div style={cell}>
        <div style={cap}>Funded MTD</div>
        <div style={{ ...val, color: '#1D1D1F' }}>{full(mtdVolume)}</div>
        <div style={sub}>{mtdLoanCount} loan{mtdLoanCount !== 1 ? 's' : ''}</div>
      </div>

      <div style={cell}>
        <div style={cap}>Closing this month</div>
        <div style={{ ...val, color: '#876830' }}>{full(closingVolume)}</div>
        <div style={sub}>{closingCount} loan{closingCount !== 1 ? 's' : ''}</div>
      </div>

      <div style={cell}>
        <div style={cap}>Est. commission</div>
        <div style={{ ...val, color: '#876830' }}>{full(estimatedCommission)}</div>
        <div style={sub}>@ {compRate}% of funded</div>
      </div>

      <div style={cell}>
        <div style={cap}>Pull-through</div>
        <div style={{ ...val, color: '#1a7a3c' }}>
          {pullThrough == null ? '—' : `${Math.round(pullThrough * 100)}%`}
        </div>
        <div style={{ ...sub, display: 'flex', alignItems: 'center', gap: 3 }}>
          {pullThroughDelta == null ? (
            'last 90 days'
          ) : pullThroughDelta >= 0 ? (
            <>
              <IconTrendingUp size={11} color="#1a7a3c" /> {Math.round(pullThroughDelta * 100)}%
            </>
          ) : (
            <>
              <IconTrendingDown size={11} color="#C4724A" /> {Math.round(Math.abs(pullThroughDelta) * 100)}%
            </>
          )}
        </div>
      </div>

      <div style={{ ...cell, borderRight: 'none' }}>
        <div style={cap}>Needs attention</div>
        <div style={{ ...val, color: alertCount > 0 ? '#C4724A' : '#1D1D1F', display: 'flex', alignItems: 'center', gap: 5 }}>
          {alertCount > 0 && <IconAlertTriangle size={15} color="#C4724A" />}
          {alertCount}
        </div>
        <div style={sub}>{alertCount === 1 ? 'loan' : 'loans'} flagged</div>
      </div>
    </div>
  );
}
