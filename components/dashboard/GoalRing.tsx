'use client';

interface GoalRingProps {
  current: number; // MTD funded volume in dollars
  goal: number; // monthly_volume_goal
  daysLeft: number;
  label?: string; // "Monthly goal" (producer) or "Team goal" (leadership)
}

const CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '0.5px solid rgba(0,0,0,0.08)',
  borderRadius: 12,
};

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.max(0, Math.round(n / 1_000))}K`;

export function GoalRing({ current, goal, daysLeft, label = 'Monthly goal' }: GoalRingProps) {
  const r = 48;
  const circumference = 2 * Math.PI * r; // 301.59

  const hasGoal = goal && goal > 0;
  const pct = hasGoal ? Math.min(1, current / goal) : 0;
  const filled = pct * circumference;

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 11px 4px' }}>
        <span style={{ fontSize: 11.5, fontWeight: 500, color: '#1D1D1F' }}>{label}</span>
        <span style={{ fontSize: 10, color: '#876830' }}>{daysLeft}d left</span>
      </div>

      {!hasGoal ? (
        <div style={{ padding: '28px 12px', textAlign: 'center', fontSize: 11, color: '#86868B' }}>
          No goal set
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
            <svg viewBox="0 0 130 130" width={118} height={118}>
              <circle cx={65} cy={65} r={r} fill="none" stroke="#ececec" strokeWidth={13} />
              <circle
                cx={65}
                cy={65}
                r={r}
                fill="none"
                stroke="#C9A95C"
                strokeWidth={13}
                strokeDasharray={`${filled} ${circumference - filled}`}
                transform="rotate(-90, 65, 65)"
                strokeLinecap="round"
              />
              <text x={65} y={60} textAnchor="middle" fontSize={18} fontWeight={500} fill="#876830" fontFamily="'DM Mono', monospace">
                {Math.round(pct * 100)}%
              </text>
              <text x={65} y={73} textAnchor="middle" fontSize={9} fill="#876830" fontFamily="sans-serif">
                of {fmt(goal)} goal
              </text>
              <text x={65} y={84} textAnchor="middle" fontSize={8.5} fill="#6E6E73" fontFamily="sans-serif">
                {fmt(current)} funded
              </text>
            </svg>
          </div>
          <div style={{ padding: '4px 10px 10px', textAlign: 'center', fontSize: 10, color: '#6E6E73' }}>
            {current >= goal ? 'Goal reached' : `${fmt(goal - current)} to target`}
          </div>
        </>
      )}
    </div>
  );
}
