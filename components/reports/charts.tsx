import { fmtDollars } from '@/lib/reports/compute';

const cardBox: React.CSSProperties = { background: '#fff', border: '0.5px solid rgba(0,0,0,0.08)', borderRadius: 12, padding: 16 };

// ── Money bar: pipeline by stage ──────────────────────────────────────────────
export function MoneyBar({ stages }: { stages: { label: string; volume: number; color: string }[] }) {
  const total = stages.reduce((s, st) => s + st.volume, 0);
  if (total === 0) {
    return (
      <div style={cardBox}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#6E6E73', marginBottom: 8 }}>Pipeline by stage</div>
        <div style={{ fontSize: 12, color: '#86868B' }}>No active pipeline volume.</div>
      </div>
    );
  }
  return (
    <div style={cardBox}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#6E6E73' }}>Pipeline by stage</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F', fontFamily: "'DM Mono', monospace" }}>{fmtDollars(total)}</span>
      </div>
      <div style={{ display: 'flex', height: 18, borderRadius: 6, overflow: 'hidden', gap: 1 }}>
        {stages.map((st) => (
          <div key={st.label} style={{ width: `${(st.volume / total) * 100}%`, background: st.color, minWidth: st.volume > 0 ? 4 : 0 }} title={`${st.label}: ${fmtDollars(st.volume)}`} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 10 }}>
        {stages.filter((s) => s.volume > 0).map((st) => (
          <div key={st.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: st.color }} />
            <span style={{ color: '#6E6E73' }}>{st.label}</span>
            <span style={{ color: '#1D1D1F', fontFamily: "'DM Mono', monospace" }}>{fmtDollars(st.volume)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Metric tile ───────────────────────────────────────────────────────────────
export function MetricTile({ label, value, delta, deltaLabel }: { label: string; value: string; delta?: number | null; deltaLabel?: string }) {
  const color = delta == null ? '#86868B' : delta > 0 ? '#1a7a3c' : delta < 0 ? '#C4724A' : '#6B7B8D';
  const sign = delta == null ? '' : delta > 0 ? '+' : '';
  return (
    <div style={cardBox}>
      <div style={{ fontSize: 22, fontWeight: 500, color: '#1D1D1F', fontFamily: "'DM Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: '#6B7B8D', marginTop: 2 }}>{label}</div>
      {delta != null && (
        <div style={{ fontSize: 11, color, marginTop: 3 }}>{sign}{delta}% {deltaLabel ?? ''}</div>
      )}
    </div>
  );
}

// ── Volume trend — SVG bars (12 months) ───────────────────────────────────────
export function VolumeTrendChart({ data }: { data: { month: string; monthLabel: string; volume: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.volume));
  const W = 540, H = 130, BAR_W = 28, GAP = 12;
  return (
    <div style={cardBox}>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#1D1D1F', marginBottom: 10 }}>Volume trend · 12 months</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {data.map((d, i) => {
          const barH = (d.volume / max) * (H - 26);
          const x = i * (BAR_W + GAP);
          const y = H - 20 - barH;
          const isCurrent = i === data.length - 1;
          return (
            <g key={d.month}>
              <rect x={x} y={y} width={BAR_W} height={Math.max(barH, d.volume > 0 ? 2 : 0)} fill={isCurrent ? '#C9A95C' : '#E5E7EB'} rx={3} />
              <text x={x + BAR_W / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="#86868B" fontFamily="sans-serif">{d.monthLabel}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Stage funnel — SVG horizontal bars ────────────────────────────────────────
export function StageFunnel({ rows }: { rows: { stage: string; label: string; count: number; dropoff: number | null }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div style={cardBox}>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#1D1D1F', marginBottom: 10 }}>Stage funnel</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rows.map((r) => {
          const isFunded = r.stage === 'closed';
          return (
            <div key={r.stage} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 92, fontSize: 11.5, color: '#6E6E73', flexShrink: 0 }}>{r.label}</span>
              <div style={{ flex: 1, height: 16, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: 16, width: `${(r.count / max) * 100}%`, minWidth: r.count > 0 ? 3 : 0, background: isFunded ? '#1a7a3c' : '#C9A95C', borderRadius: 4 }} />
              </div>
              <span style={{ width: 34, textAlign: 'right', fontSize: 12, fontWeight: 500, color: '#1D1D1F', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{r.count}</span>
              <span style={{ width: 40, textAlign: 'right', fontSize: 10.5, color: r.dropoff != null ? '#C4724A' : 'transparent', flexShrink: 0 }}>
                {r.dropoff != null ? `-${r.dropoff}%` : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
