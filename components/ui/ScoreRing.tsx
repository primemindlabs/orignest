/**
 * Phase 129 — reusable SVG score ring (0–100). Used across File Intelligence,
 * heat scores, UW readiness, etc. Green ≥75 / gold ≥50 / terra below. DM Mono label.
 */
type Props = {
  score: number; // 0–100
  size?: number; // diameter in px, default 48
  strokeWidth?: number;
};

export function ScoreRing({ score, size = 48, strokeWidth = 4 }: Props) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const progress = (clamped / 100) * circumference;

  const color =
    clamped >= 75 ? '#1A7A45'
    : clamped >= 50 ? '#C9A95C'
    : '#C4724A';

  return (
    <svg width={size} height={size}>
      {/* Background track */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="#E8E4DE" strokeWidth={strokeWidth}
      />
      {/* Score arc */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${progress} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {/* Score label */}
      <text
        x={size / 2} y={size / 2 + 1}
        textAnchor="middle" dominantBaseline="middle"
        fill={color}
        fontSize={size * 0.22}
        fontFamily="'DM Mono', monospace"
        fontWeight="600"
      >
        {Math.round(clamped)}
      </text>
    </svg>
  );
}
