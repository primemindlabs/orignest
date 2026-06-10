'use client';

interface PipelineStage {
  stage: string;
  label: string;
  count: number;
  color: string;
}

const CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: 12,
};

export function PipelineDonut({ stages }: { stages: PipelineStage[] }) {
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  const circumference = 2 * Math.PI * 46; // 289.03

  let cumulative = 0;
  const segments = stages
    .filter((s) => s.count > 0)
    .map((s) => {
      const length = (s.count / total) * circumference;
      const startAngle = (cumulative / circumference) * 360 - 90;
      cumulative += length;
      return { ...s, length, startAngle };
    });

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 11px 4px' }}>
        <span style={{ fontSize: 11.5, fontWeight: 500, color: '#1D1D1F' }}>Pipeline stages</span>
        <span style={{ fontSize: 10, color: '#86868B' }}>{total} loans</span>
      </div>

      {total === 0 ? (
        <div style={{ padding: '28px 12px', textAlign: 'center', fontSize: 11, color: '#86868B' }}>
          No active loans
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
            <svg viewBox="0 0 130 130" width={118} height={118}>
              <circle cx={65} cy={65} r={46} fill="none" stroke="#ececec" strokeWidth={17} />
              {segments.map((seg) => (
                <circle
                  key={seg.stage}
                  cx={65}
                  cy={65}
                  r={46}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={17}
                  strokeDasharray={`${seg.length} 289`}
                  transform={`rotate(${seg.startAngle}, 65, 65)`}
                />
              ))}
              <text x={65} y={61} textAnchor="middle" fontSize={17} fontWeight={500} fill="#1D1D1F" fontFamily="'DM Mono', monospace">
                {total}
              </text>
              <text x={65} y={74} textAnchor="middle" fontSize={9} fill="#6E6E73" fontFamily="sans-serif">
                active loans
              </text>
            </svg>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px', padding: '4px 11px 10px' }}>
            {stages
              .filter((s) => s.count > 0)
              .map((s) => (
                <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#6E6E73' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <span>
                    {s.label} {s.count}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
