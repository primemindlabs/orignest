'use client';

interface WeeklyVolume {
  weekStart: string;
  volume: number;
}

const CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: 12,
};

const fmt = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

export function VolumeSparkline({ weeks }: { weeks: WeeklyVolume[] }) {
  const WIDTH = 196;
  const HEIGHT = 48;
  const PADDING = 4;

  const hasData = weeks.length >= 2 && weeks.some((w) => w.volume > 0);

  const values = weeks.map((w) => w.volume);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const xStep = WIDTH / Math.max(1, weeks.length - 1);

  const points = weeks.map((w, i) => ({
    x: i * xStep,
    y: PADDING + (1 - (w.volume - min) / range) * (HEIGHT - PADDING * 2),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L ${WIDTH},${HEIGHT} L 0,${HEIGHT} Z`;
  const last = points[points.length - 1];
  const lastVolume = weeks[weeks.length - 1]?.volume ?? 0;

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 11px 4px' }}>
        <span style={{ fontSize: 11.5, fontWeight: 500, color: '#1D1D1F' }}>Volume trend</span>
        <span style={{ fontSize: 10, color: '#86868B' }}>{weeks.length} weeks</span>
      </div>

      {!hasData ? (
        <div style={{ padding: '28px 12px', textAlign: 'center', fontSize: 11, color: '#86868B' }}>
          No funded volume yet
        </div>
      ) : (
        <>
          <div style={{ padding: '10px 8px 4px' }}>
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A95C" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#C9A95C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#sparkGrad)" />
              <path d={linePath} fill="none" stroke="#C9A95C" strokeWidth={1.5} strokeLinejoin="round" />
              <circle cx={last.x} cy={last.y} r={3} fill="#C9A95C" />
            </svg>
          </div>
          <div style={{ padding: '4px 11px 10px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: '#6E6E73' }}>
              {new Date(weeks[0].weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <span style={{ fontSize: 10, fontWeight: 500, color: '#876830' }}>{fmt(lastVolume)} this wk</span>
          </div>
        </>
      )}
    </div>
  );
}
