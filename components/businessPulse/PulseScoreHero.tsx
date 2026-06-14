import Link from 'next/link';
import { IconArrowRight } from '@tabler/icons-react';
import { ScoreRing } from '@/components/ui/ScoreRing';
import type { PulseRow, ScoreBand } from '@/lib/businessPulse/types';

const BAND_CONFIG: Record<ScoreBand, { label: string; bg: string; border: string; text: string }> = {
  green: { label: 'Healthy', bg: '#F0FBF4', border: '#1A7A45', text: '#1A7A45' },
  yellow: { label: 'Needs Attention', bg: '#FFFBF0', border: '#C9A95C', text: '#8A6A1A' },
  orange: { label: 'Intervention Needed', bg: '#FFF4F0', border: '#C4724A', text: '#C4724A' },
  red: { label: 'Crisis Mode', bg: '#FFF0F0', border: '#C42A2A', text: '#C42A2A' },
};

const DIMENSIONS = (s: PulseRow) => [
  { label: 'Pipeline', score: s.pipeline_velocity_score },
  { label: 'Relations', score: s.relationship_health_score },
  { label: 'Revenue', score: s.revenue_trajectory_score },
  { label: 'Compliance', score: s.compliance_posture_score },
  { label: 'Growth', score: s.growth_signals_score },
];

function dimColor(n: number | null): string {
  const v = n ?? 0;
  return v >= 75 ? '#1A7A45' : v >= 50 ? '#C9A95C' : '#C4724A';
}

export function PulseScoreHero({ score, linkToDetail = false }: { score: PulseRow; linkToDetail?: boolean }) {
  const band = BAND_CONFIG[score.score_band];

  return (
    <div className="rounded-2xl border px-6 py-5 flex items-center gap-6 flex-wrap" style={{ backgroundColor: band.bg, borderColor: band.border }}>
      <ScoreRing score={score.pulse_score} size={64} strokeWidth={5} />

      <div className="flex-1 min-w-[220px]">
        <div className="flex items-center gap-2 mb-1.5">
          <h2 className="font-bold text-lg text-[#1A1A1A]" style={{ fontFamily: 'var(--font-lora), Lora, serif' }}>
            Business Pulse™
          </h2>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: band.text, backgroundColor: `${band.border}20` }}>
            {band.label}
          </span>
          {linkToDetail && (
            <Link href="/branch/pulse" className="ml-auto text-xs font-medium text-[#876830] flex items-center gap-1 hover:underline">
              View details <IconArrowRight size={12} />
            </Link>
          )}
        </div>

        <div className="space-y-1">
          {(score.top_risks ?? []).slice(0, 2).map((risk, i) => (
            <p key={`r${i}`} className="text-sm text-[#C4724A] flex items-start gap-1.5">
              <span>⚠️</span> {risk}
            </p>
          ))}
          {(score.top_wins ?? []).slice(0, 1).map((win, i) => (
            <p key={`w${i}`} className="text-sm text-[#1A7A45] flex items-start gap-1.5">
              <span>✓</span> {win}
            </p>
          ))}
          {(score.top_risks ?? []).length === 0 && (score.top_wins ?? []).length === 0 && (
            <p className="text-sm text-[#6B7B8D]">No notable signals today — business is steady.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 text-center flex-shrink-0">
        {DIMENSIONS(score).map(({ label, score: dimScore }) => (
          <div key={label}>
            <p className="text-[10px] text-[#6B7B8D] uppercase tracking-wide">{label}</p>
            <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-dm-mono), DM Mono, monospace', color: dimColor(dimScore) }}>
              {dimScore ?? '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
