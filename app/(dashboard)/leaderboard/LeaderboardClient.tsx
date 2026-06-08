'use client';

import { useState } from 'react';
import { Trophy, Medal } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

interface LOSnapshot {
  lo_id: string;
  leads_in_pipeline: number;
  leads_closed_mtd: number;
  volume_closed_mtd: number;
  avg_speed_to_contact_minutes?: number | null;
  trid_compliance_rate?: number | null;
  conversion_rate?: number | null;
  avg_days_to_close?: number | null;
  referrals_received_mtd: number;
  ai_score_avg?: number | null;
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    avatar_url: string | null;
    nmls_id: string | null;
  } | null;
}

interface FallbackLO {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar_url: string | null;
  nmls_id: string | null;
}

interface Props {
  snapshots: LOSnapshot[];
  fallbackLOs: FallbackLO[];
}

type SortKey = 'volume_closed_mtd' | 'leads_closed_mtd' | 'trid_compliance_rate' | 'conversion_rate' | 'ai_score_avg';

function getSpeedColor(minutes: number | null | undefined): string {
  if (minutes == null) return 'text-label-3';
  if (minutes <= 5) return 'text-green';
  if (minutes <= 30) return 'text-orange';
  return 'text-red';
}

function getTridColor(rate: number | null | undefined): string {
  if (rate == null) return 'text-label-3';
  if (rate >= 95) return 'text-green';
  if (rate >= 80) return 'text-orange';
  return 'text-red';
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <div className="w-7 h-7 rounded-full bg-gold/20 flex items-center justify-center"><Trophy size={14} className="text-gold" /></div>;
  if (rank === 2) return <div className="w-7 h-7 rounded-full bg-black/[0.08] flex items-center justify-center"><Medal size={14} className="text-label-2" /></div>;
  if (rank === 3) return <div className="w-7 h-7 rounded-full bg-orange/10 flex items-center justify-center"><Medal size={14} className="text-orange" /></div>;
  return <div className="w-7 h-7 rounded-full bg-black/[0.06] flex items-center justify-center text-xs font-bold text-label-2">{rank}</div>;
}

// Spark trend bar (using random demo data)
function SparkBar({ color }: { color: string }) {
  const vals = Array.from({ length: 7 }, () => Math.floor(Math.random() * 100));
  const max = Math.max(...vals, 1);
  return (
    <div className="flex items-end gap-px h-6 w-14">
      {vals.map((v, i) => (
        <div key={i} className={cn('flex-1 rounded-sm opacity-60', color)} style={{ height: `${Math.max(2, (v / max) * 24)}px` }} />
      ))}
    </div>
  );
}

export function LeaderboardClient({ snapshots, fallbackLOs }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('volume_closed_mtd');
  const [period, setPeriod] = useState<'MTD' | 'QTD' | 'YTD'>('MTD');

  // Build rows from snapshots or fallback
  const rows = snapshots.length > 0
    ? [...snapshots].sort((a, b) => {
        const av = (a[sortKey] as number | null) ?? 0;
        const bv = (b[sortKey] as number | null) ?? 0;
        return bv - av;
      })
    : fallbackLOs.map((lo) => ({
        lo_id: lo.id,
        leads_in_pipeline: 0,
        leads_closed_mtd: 0,
        volume_closed_mtd: 0,
        avg_speed_to_contact_minutes: null,
        trid_compliance_rate: null,
        conversion_rate: null,
        avg_days_to_close: null,
        referrals_received_mtd: 0,
        ai_score_avg: null,
        profiles: lo,
      }));

  // Team aggregates
  const teamStats = {
    totalVolume: rows.reduce((s, r) => s + r.volume_closed_mtd, 0),
    totalClosed: rows.reduce((s, r) => s + r.leads_closed_mtd, 0),
    totalPipeline: rows.reduce((s, r) => s + r.leads_in_pipeline, 0),
    avgTrid:
      rows.filter((r) => r.trid_compliance_rate != null).length > 0
        ? rows.reduce((s, r) => s + (r.trid_compliance_rate ?? 0), 0) /
          rows.filter((r) => r.trid_compliance_rate != null).length
        : null,
  };

  function SortButton({ k, label }: { k: SortKey; label: string }) {
    return (
      <button
        onClick={() => setSortKey(k)}
        className={cn(
          'text-xs font-medium px-2 py-1 rounded-[6px] transition-colors',
          sortKey === k ? 'bg-navy text-white' : 'text-label-3 hover:text-label hover:bg-black/[0.06]',
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-label tracking-tight">Leaderboard</h1>
          <p className="text-sm text-label-2 mt-0.5">Team performance rankings — branch view</p>
        </div>
        <div className="flex items-center gap-1 bg-black/[0.06] rounded-[10px] p-1">
          {(['MTD', 'QTD', 'YTD'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors',
                period === p ? 'bg-white text-label shadow-card' : 'text-label-3 hover:text-label',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Team aggregate bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Team Volume Closed', value: formatCurrency(teamStats.totalVolume), color: 'text-navy' },
          { label: 'Total Loans Closed', value: String(teamStats.totalClosed), color: 'text-green' },
          { label: 'Active Pipeline', value: String(teamStats.totalPipeline), color: 'text-blue' },
          {
            label: 'Team TRID Rate',
            value: teamStats.avgTrid != null ? `${teamStats.avgTrid.toFixed(1)}%` : '—',
            color: getTridColor(teamStats.avgTrid),
          },
        ].map((s) => (
          <div key={s.label} className="bg-surface rounded-[10px] border border-black/[0.06] p-4 shadow-card">
            <div className={cn('text-xl font-bold mb-1', s.color)}>{s.value}</div>
            <div className="text-xs text-label-2">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-label-3 mr-1">Sort by:</span>
        <SortButton k="volume_closed_mtd" label="Volume" />
        <SortButton k="leads_closed_mtd" label="Loans Closed" />
        <SortButton k="trid_compliance_rate" label="TRID %" />
        <SortButton k="conversion_rate" label="Conversion" />
        <SortButton k="ai_score_avg" label="AI Score" />
      </div>

      {/* Leaderboard table */}
      <div className="bg-surface rounded-[10px] border border-black/[0.06] shadow-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/[0.06] bg-bg">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide w-8">#</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide">Loan Officer</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide">Pipeline</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide">Closed {period}</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide">Speed</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide">TRID %</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide">Conv %</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide">AI Score</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide">Referrals</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-label-3 uppercase tracking-wide w-16">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-12 text-label-3 text-sm">
                  No data yet. Performance snapshots are generated nightly.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const lo = row.profiles;
                if (!lo) return null;
                const initials = `${lo.first_name.charAt(0)}${lo.last_name.charAt(0)}`.toUpperCase();

                return (
                  <tr key={row.lo_id} className={cn('hover:bg-bg transition-colors', idx === 0 && 'bg-gold/[0.03]')}>
                    <td className="px-4 py-3.5">
                      <RankBadge rank={idx + 1} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {lo.avatar_url ? (
                          <img src={lo.avatar_url} alt={lo.full_name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-xs font-bold text-white">
                            {initials}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-label">{lo.full_name}</p>
                          {lo.nmls_id && <p className="text-[10px] text-label-3">NMLS #{lo.nmls_id}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="text-sm font-semibold text-label">{row.leads_in_pipeline}</p>
                      <p className="text-[10px] text-label-3">leads</p>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="text-sm font-semibold text-label">{formatCurrency(row.volume_closed_mtd)}</p>
                      <p className="text-[10px] text-label-3">{row.leads_closed_mtd} loans</p>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={cn('text-sm font-semibold', getSpeedColor(row.avg_speed_to_contact_minutes))}>
                        {row.avg_speed_to_contact_minutes != null
                          ? `${row.avg_speed_to_contact_minutes}m`
                          : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={cn('text-sm font-semibold', getTridColor(row.trid_compliance_rate))}>
                        {row.trid_compliance_rate != null ? `${row.trid_compliance_rate.toFixed(0)}%` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-semibold text-label">
                        {row.conversion_rate != null ? `${row.conversion_rate.toFixed(0)}%` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-semibold text-label">
                        {row.ai_score_avg != null ? row.ai_score_avg.toFixed(0) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-semibold text-label">{row.referrals_received_mtd}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <SparkBar color="bg-blue" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
