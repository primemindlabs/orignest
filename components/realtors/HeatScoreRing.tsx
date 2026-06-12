'use client';

/**
 * Phase 95 — circular heat-score ring. Pure SVG, no deps. Hot uses the Ashley IQ
 * gold accent; warm/cooling/cold use green/amber/red strictly inside this ring
 * (never as page chrome).
 */
const BAND_COLORS: Record<string, string> = {
  hot: '#C9A95C', // gold accent
  warm: '#1a7a3c', // green
  cooling: '#C4724A', // amber/terracotta (matches hub stale tone)
  cold: '#b85c20', // muted red-orange
};

interface HeatScoreRingProps {
  score: number;
  band: string;
  size?: number;
  strokeWidth?: number;
}

export function HeatScoreRing({ score, band, size = 80, strokeWidth = 7 }: HeatScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fill = Math.max(0, Math.min(score, 100));
  const dashOffset = circumference - (fill / 100) * circumference;
  const color = BAND_COLORS[band] ?? '#94A3B8';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Heat score ${score}, ${band}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </g>
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize={size * 0.3}
        fontWeight={700}
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        {Math.round(score)}
      </text>
    </svg>
  );
}
