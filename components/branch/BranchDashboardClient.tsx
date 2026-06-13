'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconUsers, IconAlertTriangle, IconTrendingUp, IconBuilding } from '@tabler/icons-react';
import { AggregatePipelineChart } from './AggregatePipelineChart';
import { TeamLeaderboard } from './TeamLeaderboard';
import { TeamAlertSummary } from './TeamAlertSummary';
import { ProductionTrendChart } from './ProductionTrendChart';
import type { BranchDashboardData } from '@/types/branch-manager';

type Tab = 'overview' | 'team' | 'alerts' | 'trend';

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(v);

export function BranchDashboardClient({ data }: { data: BranchDashboardData }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const { aggregate, team, alerts, trend } = data;

  const TABS: { key: Tab; label: string; icon: typeof IconBuilding }[] = [
    { key: 'overview', label: 'Overview', icon: IconBuilding },
    { key: 'team', label: 'Team', icon: IconUsers },
    { key: 'alerts', label: `Alerts${alerts.length > 0 ? ` (${alerts.length})` : ''}`, icon: IconAlertTriangle },
    { key: 'trend', label: 'Trend', icon: IconTrendingUp },
  ];

  const cards = [
    { label: 'Active Leads', value: aggregate.total_active_leads.toLocaleString() },
    { label: 'Pipeline Value', value: fmtCurrency(aggregate.total_pipeline_value) },
    { label: 'Funded (30d)', value: aggregate.total_funded_30d.toLocaleString() },
    { label: 'TRID Alerts', value: aggregate.total_trid_alerts.toString(), highlight: aggregate.total_trid_alerts > 0 },
    { label: 'LO Count', value: aggregate.lo_count.toString() },
  ];

  return (
    <div className="max-w-6xl">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Branch Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Team performance — read only</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-100">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key ? 'border-[#C9A95C] text-[#C9A95C]' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {cards.map((card) => (
          <div key={card.label} className={`bg-white rounded-2xl border shadow-sm px-4 py-4 ${card.highlight ? 'border-red-100' : 'border-gray-100'}`}>
            <p className="text-xs text-gray-400 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.highlight ? 'text-red-500' : 'text-gray-900'}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AggregatePipelineChart team={team} />
          <ProductionTrendChart trend={trend} />
        </div>
      )}
      {tab === 'team' && <TeamLeaderboard team={team} onViewLO={(loId) => router.push(`/branch/lo/${loId}`)} />}
      {tab === 'alerts' && <TeamAlertSummary alerts={alerts} onViewLead={(leadId) => router.push(`/loans/${leadId}`)} />}
      {tab === 'trend' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <ProductionTrendChart trend={trend} fullHeight />
        </div>
      )}
    </div>
  );
}
