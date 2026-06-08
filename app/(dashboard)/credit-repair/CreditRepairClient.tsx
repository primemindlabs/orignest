'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import {
  TrendingUp, Users, Trophy, DollarSign, Plus, X,
  Bot, RefreshCw, ChevronDown, ChevronUp, Phone
} from 'lucide-react';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  loan_type: string | null;
  estimated_credit_score: number | null;
}

interface Partner {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  avg_timeline_days: number | null;
  success_rate: number | null;
}

interface PipelineRecord {
  id: string;
  target_program: string;
  target_score: number;
  starting_score: number;
  current_score: number | null;
  score_history: unknown;
  known_issues: unknown;
  status: string;
  credit_repair_partner: string | null;
  checkin_frequency_days: number;
  next_checkin_date: string | null;
  ai_action_plan: string | null;
  reactivated_at: string | null;
  created_at: string;
  leads: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    loan_type: string | null;
    loan_amount: number | null;
  } | null;
}

interface KPIs {
  enrolledCount: number;
  qualifiedMTD: number;
  avgScoreGain: number;
  estPipelineValue: number;
}

interface CreditRepairClientProps {
  orgId: string;
  pipeline: PipelineRecord[];
  availableLeads: Lead[];
  partners: Partner[];
  kpis: KPIs;
}

const STATUS_LABELS: Record<string, string> = {
  enrolled: 'Enrolled',
  in_progress: 'In Progress',
  near_qualifying: 'Near Qualifying',
  qualified: 'Qualified',
  stopped_responding: 'Stopped Responding',
  reactivated: 'Reactivated',
};

const STATUS_VARIANT: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'neutral'> = {
  enrolled: 'info',
  in_progress: 'info',
  near_qualifying: 'warning',
  qualified: 'success',
  stopped_responding: 'danger',
  reactivated: 'success',
};

const TARGET_PROGRAMS = [
  { value: 'FHA 580', label: 'FHA (580 min)' },
  { value: 'FHA 620', label: 'FHA Enhanced (620)' },
  { value: 'Conventional 620', label: 'Conventional (620 min)' },
  { value: 'Conventional 680', label: 'Conventional Prime (680)' },
  { value: 'VA 580', label: 'VA (580 min)' },
  { value: 'USDA 640', label: 'USDA (640 min)' },
  { value: 'Jumbo 700', label: 'Jumbo (700 min)' },
  { value: 'Non-QM 580', label: 'Non-QM (580 min)' },
];

function getTargetScore(program: string): number {
  const match = program.match(/\d+/);
  return match ? parseInt(match[0], 10) : 620;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CreditRepairClient({
  orgId: _orgId,
  pipeline,
  availableLeads,
  partners,
  kpis,
}: CreditRepairClientProps) {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'partners'>('pipeline');
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState<string | null>(null);
  const [showAIModal, setShowAIModal] = useState<PipelineRecord | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Enroll form
  const [enrollForm, setEnrollForm] = useState({
    leadId: '', targetProgram: 'FHA 580', startingScore: '', knownIssues: '',
    creditRepairPartner: '', checkinFrequency: '30',
  });
  const [enrollLoading, setEnrollLoading] = useState(false);

  // Score update form
  const [scoreForm, setScoreForm] = useState({ newScore: '', notes: '' });
  const [scoreLoading, setScoreLoading] = useState(false);

  // AI coaching
  const [aiLoading, setAILoading] = useState(false);
  const [aiPlan, setAIPlan] = useState('');

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    setEnrollLoading(true);
    try {
      const r = await fetch('/api/credit-repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: enrollForm.leadId,
          targetProgram: enrollForm.targetProgram,
          targetScore: getTargetScore(enrollForm.targetProgram),
          startingScore: parseInt(enrollForm.startingScore, 10),
          creditRepairPartner: enrollForm.creditRepairPartner || undefined,
          checkinFrequencyDays: parseInt(enrollForm.checkinFrequency, 10),
          knownIssues: enrollForm.knownIssues
            ? enrollForm.knownIssues.split(',').map((s) => ({ type: s.trim() }))
            : [],
        }),
      });
      if (r.ok) { setShowEnrollModal(false); window.location.reload(); }
      else {
        const { error } = await r.json() as { error: string };
        alert(error);
      }
    } finally { setEnrollLoading(false); }
  }

  async function handleScoreUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!showScoreModal) return;
    setScoreLoading(true);
    try {
      const r = await fetch('/api/credit-repair/score-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditRepairId: showScoreModal,
          newScore: parseInt(scoreForm.newScore, 10),
          notes: scoreForm.notes,
        }),
      });
      if (r.ok) {
        const { qualified } = await r.json() as { qualified: boolean; newStatus: string };
        setShowScoreModal(null);
        setScoreForm({ newScore: '', notes: '' });
        if (qualified) alert('Score reached qualifying threshold. Lead has been marked as Qualified — reactivate in the main pipeline.');
        window.location.reload();
      }
    } finally { setScoreLoading(false); }
  }

  async function handleAICoach(record: PipelineRecord) {
    setShowAIModal(record);
    setAILoading(true);
    setAIPlan('');
    try {
      const knownIssues = Array.isArray(record.known_issues)
        ? (record.known_issues as Array<{ type: string; amount?: number; creditor?: string }>)
        : [];
      const r = await fetch('/api/ai/credit-coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: record.leads?.id ?? '',
          currentScore: record.current_score ?? record.starting_score,
          targetScore: record.target_score,
          targetProgram: record.target_program,
          knownIssues,
        }),
      });
      if (r.ok) {
        const { plan } = await r.json() as { plan: string };
        setAIPlan(plan);
      } else {
        setAIPlan('AI coaching unavailable. Please check your Anthropic API key.');
      }
    } finally { setAILoading(false); }
  }

  const filtered = pipeline.filter((r) => !statusFilter || r.status === statusFilter);

  return (
    <div className="max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-black tracking-tight">Credit Repair Pipeline</h1>
          <p className="text-label-2 text-sm mt-0.5">
            Track leads working toward qualification · AI-powered action plans
          </p>
        </div>
        <Button onClick={() => setShowEnrollModal(true)} leftIcon={<Plus size={15} />}>
          Add to Pipeline
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'In Pipeline', value: kpis.enrolledCount, icon: <Users size={16} />, color: 'text-blue', fmt: String },
          { label: 'Avg Score Gain', value: kpis.avgScoreGain, icon: <TrendingUp size={16} />, color: kpis.avgScoreGain > 0 ? 'text-green-600' : 'text-label-2', fmt: (v: number) => `+${v.toFixed(0)} pts` },
          { label: 'Qualified MTD', value: kpis.qualifiedMTD, icon: <Trophy size={16} />, color: kpis.qualifiedMTD > 0 ? 'text-green-600' : 'text-label-2', fmt: String },
          { label: 'Pipeline Value', value: kpis.estPipelineValue, icon: <DollarSign size={16} />, color: 'text-gold', fmt: (v: number) => `$${(v / 1000).toFixed(0)}K` },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span className={kpi.color}>{kpi.icon}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-label-2">{kpi.label}</span>
            </div>
            <p className={`text-[24px] font-bold font-mono ${kpi.color}`}>{kpi.fmt(kpi.value)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-[rgba(118,118,128,0.12)] rounded-xl p-1 w-fit">
          {(['pipeline', 'partners'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-[9px] text-[13px] font-medium transition-colors ${
                activeTab === tab ? 'bg-white shadow-sm text-black' : 'text-label-2 hover:text-black'
              }`}>
              {tab === 'pipeline' ? 'Pipeline' : 'Repair Partners'}
            </button>
          ))}
        </div>
        {activeTab === 'pipeline' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-[10px] border border-[rgba(60,60,67,0.2)] bg-white pl-3 pr-7 text-[13px] text-black appearance-none focus:outline-none focus:ring-2 focus:ring-blue/30"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}
      </div>

      {/* ── Pipeline Table ── */}
      {activeTab === 'pipeline' && (
        <div className="bg-white border border-black/[0.06] shadow-sm rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Borrower', 'Start Score', 'Current', 'Gap', 'Target Program', 'Days In', 'Next Check-In', 'Status', ''].map((h) => (
                  <th key={h} className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-label-2 text-sm">
                  No leads in credit repair pipeline. Click &ldquo;Add to Pipeline&rdquo; to enroll a lead.
                </td></tr>
              )}
              {filtered.map((record) => {
                const lead = record.leads;
                const currentScore = record.current_score ?? record.starting_score;
                const gap = Math.max(0, record.target_score - currentScore);
                const daysIn = Math.floor((Date.now() - new Date(record.created_at).getTime()) / (1000 * 60 * 60 * 24));
                const isExpanded = expandedRow === record.id;
                const today = new Date().toISOString().slice(0, 10);
                const checkinOverdue = record.next_checkin_date && record.next_checkin_date < today;

                return (
                  <>
                    <tr key={record.id}
                      className="hover:bg-[rgba(60,60,67,0.02)] transition-colors cursor-pointer"
                      onClick={() => setExpandedRow(isExpanded ? null : record.id)}>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-medium text-black">
                          {lead ? `${lead.first_name} ${lead.last_name}` : '—'}
                        </p>
                        {lead?.loan_type && (
                          <p className="text-[11px] text-label-2 uppercase">{lead.loan_type}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-mono text-black">{record.starting_score}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[13px] font-mono font-semibold ${
                          currentScore >= record.target_score ? 'text-green-600' :
                          gap <= 20 ? 'text-orange' : 'text-black'
                        }`}>{currentScore}</span>
                      </td>
                      <td className="px-4 py-3">
                        {gap > 0 ? (
                          <span className="text-[13px] font-mono text-red">-{gap}</span>
                        ) : (
                          <span className="text-[13px] font-mono text-green-600">✓</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-black">{record.target_program}</td>
                      <td className="px-4 py-3 text-[13px] text-label-2 font-mono">{daysIn}d</td>
                      <td className="px-4 py-3">
                        <span className={`text-[13px] ${checkinOverdue ? 'text-red font-semibold' : 'text-label-2'}`}>
                          {formatDate(record.next_checkin_date)}
                          {checkinOverdue && ' ⚠'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[record.status] ?? 'neutral'} size="sm">
                          {STATUS_LABELS[record.status] ?? record.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {isExpanded ? <ChevronUp size={15} className="text-label-2" /> : <ChevronDown size={15} className="text-label-2" />}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${record.id}-expanded`} className="bg-[rgba(60,60,67,0.02)]">
                        <td colSpan={9} className="px-4 py-4">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Button size="sm" variant="outline"
                              leftIcon={<TrendingUp size={13} />}
                              onClick={(e) => { e.stopPropagation(); setShowScoreModal(record.id); setExpandedRow(null); }}>
                              Update Score
                            </Button>
                            <Button size="sm" variant="outline"
                              leftIcon={<Bot size={13} />}
                              onClick={(e) => { e.stopPropagation(); handleAICoach(record); }}>
                              AI Coach
                            </Button>
                            {lead && (
                              <Button size="sm" variant="ghost"
                                leftIcon={<Phone size={13} />}
                                onClick={(e) => { e.stopPropagation(); window.location.href = `/leads/${lead.id}`; }}>
                                View Lead
                              </Button>
                            )}
                            {record.ai_action_plan && (
                              <span className="text-[12px] text-label-2 italic">
                                AI plan generated {formatDate(record.updated_at)}
                              </span>
                            )}
                            {record.credit_repair_partner && (
                              <span className="text-[12px] text-label-2">
                                Partner: {record.credit_repair_partner}
                              </span>
                            )}
                          </div>

                          {/* Score history mini-chart */}
                          {Array.isArray(record.score_history) && (record.score_history as unknown[]).length > 1 && (
                            <div className="mt-3 flex items-end gap-1.5 h-10">
                              {(record.score_history as Array<{ date: string; score: number }>).map((entry, idx) => {
                                const minScore = Math.min(...(record.score_history as Array<{ score: number }>).map((e) => e.score)) - 10;
                                const maxScore = Math.max(record.target_score, ...(record.score_history as Array<{ score: number }>).map((e) => e.score)) + 10;
                                const pct = ((entry.score - minScore) / (maxScore - minScore)) * 100;
                                const isTarget = entry.score >= record.target_score;
                                return (
                                  <div key={idx} className="flex flex-col items-center gap-0.5" title={`${entry.date}: ${entry.score}`}>
                                    <div
                                      className={`w-5 rounded-t transition-all ${isTarget ? 'bg-green' : 'bg-blue/60'}`}
                                      style={{ height: `${Math.max(4, pct * 0.36)}px` }}
                                    />
                                    <span className="text-[9px] text-label-3 font-mono">{entry.score}</span>
                                  </div>
                                );
                              })}
                              <div className="ml-2 text-[11px] text-label-2 self-center">
                                Target: <span className="font-semibold text-black">{record.target_score}</span>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Partners Tab ── */}
      {activeTab === 'partners' && (
        <div className="space-y-3">
          {partners.length === 0 && (
            <div className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-8 text-center text-label-2 text-sm">
              No credit repair partners on file. Partners are added via Settings.
            </div>
          )}
          {partners.map((p) => (
            <div key={p.id} className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[15px] font-semibold text-black">{p.name}</p>
                  {p.contact_name && <p className="text-[13px] text-label-2 mt-0.5">Contact: {p.contact_name}</p>}
                </div>
                <div className="flex gap-4 text-right">
                  {p.avg_timeline_days && (
                    <div>
                      <p className="text-[11px] text-label-2 uppercase font-semibold">Avg Timeline</p>
                      <p className="text-[15px] font-bold text-black font-mono">{p.avg_timeline_days}d</p>
                    </div>
                  )}
                  {p.success_rate !== null && (
                    <div>
                      <p className="text-[11px] text-label-2 uppercase font-semibold">Success Rate</p>
                      <p className="text-[15px] font-bold text-green-600 font-mono">{p.success_rate}%</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-4">
                {p.email && <a href={`mailto:${p.email}`} className="text-[12px] text-blue hover:underline">{p.email}</a>}
                {p.phone && <a href={`tel:${p.phone}`} className="text-[12px] text-label-2">{p.phone}</a>}
              </div>
            </div>
          ))}
          <p className="text-[12px] text-label-2 pl-1">
            Note: Referral to credit repair companies does not constitute an endorsement. Borrowers should research all options independently.
          </p>
        </div>
      )}

      {/* ── Enroll Modal ── */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-sheet w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
              <h2 className="text-[16px] font-bold text-black">Add Lead to Credit Repair</h2>
              <button onClick={() => setShowEnrollModal(false)} className="text-label-2 hover:text-black"><X size={18} /></button>
            </div>
            <form onSubmit={handleEnroll} className="p-5 space-y-4">
              <Select
                label="Lead *"
                options={[
                  { value: '', label: 'Select a lead...' },
                  ...availableLeads.map((l) => ({
                    value: l.id,
                    label: `${l.first_name} ${l.last_name}${l.estimated_credit_score ? ` (${l.estimated_credit_score})` : ''}`,
                  })),
                ]}
                value={enrollForm.leadId}
                onChange={(e) => setEnrollForm((p) => ({ ...p, leadId: e.target.value }))}
              />
              <Select
                label="Target Program *"
                options={TARGET_PROGRAMS}
                value={enrollForm.targetProgram}
                onChange={(e) => setEnrollForm((p) => ({ ...p, targetProgram: e.target.value }))}
              />
              <Input
                label="Starting Credit Score *"
                type="number"
                min="300"
                max="850"
                value={enrollForm.startingScore}
                onChange={(e) => setEnrollForm((p) => ({ ...p, startingScore: e.target.value }))}
                hint={`Target score for ${enrollForm.targetProgram}: ${getTargetScore(enrollForm.targetProgram)}`}
                required
              />
              <Input
                label="Known Issues (comma-separated)"
                placeholder="e.g. collections, late payments, high utilization"
                value={enrollForm.knownIssues}
                onChange={(e) => setEnrollForm((p) => ({ ...p, knownIssues: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Credit Repair Partner"
                  placeholder="Optional partner name"
                  value={enrollForm.creditRepairPartner}
                  onChange={(e) => setEnrollForm((p) => ({ ...p, creditRepairPartner: e.target.value }))}
                />
                <Select
                  label="Check-In Frequency"
                  options={[
                    { value: '30', label: 'Every 30 days' },
                    { value: '60', label: 'Every 60 days' },
                    { value: '90', label: 'Every 90 days' },
                  ]}
                  value={enrollForm.checkinFrequency}
                  onChange={(e) => setEnrollForm((p) => ({ ...p, checkinFrequency: e.target.value }))}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEnrollModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" loading={enrollLoading}>Enroll Lead</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Score Update Modal ── */}
      {showScoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-sheet w-full max-w-sm animate-slide-up">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
              <h2 className="text-[16px] font-bold text-black">Update Credit Score</h2>
              <button onClick={() => setShowScoreModal(null)} className="text-label-2 hover:text-black"><X size={18} /></button>
            </div>
            <form onSubmit={handleScoreUpdate} className="p-5 space-y-4">
              <Input
                label="New Score *"
                type="number"
                min="300"
                max="850"
                value={scoreForm.newScore}
                onChange={(e) => setScoreForm((p) => ({ ...p, newScore: e.target.value }))}
                required
              />
              <div>
                <label className="text-[13px] font-medium text-black block mb-1.5">Notes (optional)</label>
                <textarea
                  value={scoreForm.notes}
                  onChange={(e) => setScoreForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-[10px] border border-[rgba(60,60,67,0.2)] bg-surface px-3 py-2 text-[14px] text-black placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue resize-none"
                  placeholder="e.g. Disputed 2 collections, utilization down to 28%"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowScoreModal(null)}>Cancel</Button>
                <Button type="submit" className="flex-1" loading={scoreLoading}
                  leftIcon={<RefreshCw size={14} />}>Save Score</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── AI Coach Modal ── */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-sheet w-full max-w-2xl max-h-[80vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-[16px] font-bold text-black">AI Credit Coach</h2>
                <p className="text-[12px] text-label-2 mt-0.5">
                  {showAIModal.leads ? `${showAIModal.leads.first_name} ${showAIModal.leads.last_name}` : ''} ·
                  Score {showAIModal.current_score ?? showAIModal.starting_score} → Target {showAIModal.target_score} ({showAIModal.target_program})
                </p>
              </div>
              <button onClick={() => { setShowAIModal(null); setAIPlan(''); }} className="text-label-2 hover:text-black"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {aiLoading ? (
                <div className="flex items-center gap-3 text-label-2">
                  <RefreshCw size={16} className="animate-spin text-blue" />
                  <span className="text-[13px]">Generating credit improvement plan…</span>
                </div>
              ) : aiPlan ? (
                <div className="text-[13px] text-black leading-relaxed whitespace-pre-wrap">{aiPlan}</div>
              ) : (
                <p className="text-label-2 text-sm">No plan generated yet.</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex-shrink-0">
              <p className="text-[11px] text-label-2">
                AI advice is for informational purposes only. Not a substitute for a HUD-approved housing counselor. Results vary.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
