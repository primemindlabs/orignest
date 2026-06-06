'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { clsx } from 'clsx';
import {
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Send,
  RefreshCw,
  MessageSquare,
  Award,
  ChevronDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { format, formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NpsResponse {
  id: string;
  lead_id: string;
  lo_id: string | null;
  score: number | null;
  sent_at: string;
  responded_at: string | null;
  review_requested_at: string | null;
  review_link_clicked: boolean;
  created_at: string;
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  stage: string;
  closing_date: string | null;
}

interface EnrichedNps extends NpsResponse {
  lead: Lead | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreCategory(score: number | null): 'promoter' | 'passive' | 'detractor' | 'pending' {
  if (score === null) return 'pending';
  if (score >= 9) return 'promoter';
  if (score >= 7) return 'passive';
  return 'detractor';
}

function calcNPS(responses: EnrichedNps[]): number {
  const answered = responses.filter((r) => r.score !== null);
  if (answered.length === 0) return 0;
  const promoters = answered.filter((r) => (r.score ?? 0) >= 9).length;
  const detractors = answered.filter((r) => (r.score ?? 0) <= 6).length;
  return Math.round(((promoters - detractors) / answered.length) * 100);
}

// ─── NPS gauge ────────────────────────────────────────────────────────────────

function NPSGauge({ score }: { score: number }) {
  const clamped = Math.max(-100, Math.min(100, score));
  const rotation = (clamped + 100) * 0.9; // 0-180deg
  const color = score >= 50 ? '#34C759' : score >= 0 ? '#FF9500' : '#FF3B30';
  const label = score >= 50 ? 'Excellent' : score >= 20 ? 'Good' : score >= 0 ? 'Needs work' : 'At risk';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-32 h-16 overflow-hidden">
        <svg viewBox="0 0 120 60" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 10 55 A 50 50 0 0 1 110 55"
            fill="none"
            stroke="rgba(60,60,67,0.08)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Score arc */}
          <path
            d="M 10 55 A 50 50 0 0 1 110 55"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(clamped + 100) * 0.785} 157`}
          />
          {/* Needle */}
          <g transform={`rotate(${rotation - 90}, 60, 55)`}>
            <line x1="60" y1="55" x2="60" y2="15" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="60" cy="55" r="4" fill={color} />
          </g>
        </svg>
      </div>
      <div className="text-[28px] font-bold text-black tabular-nums" style={{ color }}>
        {score > 0 ? `+${score}` : score}
      </div>
      <div className="text-[12px] font-medium text-label-2">{label}</div>
    </div>
  );
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const colors: Record<string, string> = {
    promoter: '#34C759',
    passive: '#FF9500',
    detractor: '#FF3B30',
    pending: '#AEAEB2',
  };
  const category = scoreCategory(score);
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-white text-[11px] font-bold"
      style={{ backgroundColor: colors[category] }}
    >
      <Star size={10} fill="currentColor" />
      {score}
    </div>
  );
}

// ─── Response row ─────────────────────────────────────────────────────────────

function ResponseRow({
  nps,
  onRequestReview,
}: {
  nps: EnrichedNps;
  onRequestReview: (nps: EnrichedNps) => void;
}) {
  const category = scoreCategory(nps.score);
  const name = nps.lead ? `${nps.lead.first_name} ${nps.lead.last_name}` : '—';

  return (
    <div className="flex items-center gap-4 px-5 py-3 border-b border-[rgba(60,60,67,0.07)] hover:bg-[rgba(60,60,67,0.02)] transition-colors">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-[rgba(60,60,67,0.08)] flex items-center justify-center text-[12px] font-semibold text-label-2 flex-shrink-0">
        {nps.lead ? `${nps.lead.first_name[0]}${nps.lead.last_name[0]}` : '?'}
      </div>

      {/* Name + date */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-black truncate">{name}</p>
        <p className="text-[11px] text-label-3">
          {nps.responded_at
            ? `Responded ${formatDistanceToNow(new Date(nps.responded_at), { addSuffix: true })}`
            : `Sent ${formatDistanceToNow(new Date(nps.sent_at), { addSuffix: true })}`}
        </p>
      </div>

      {/* Score */}
      <div className="flex-shrink-0">
        {nps.score !== null ? (
          <ScoreBar score={nps.score} />
        ) : (
          <Badge variant="neutral" size="sm">Pending</Badge>
        )}
      </div>

      {/* Category */}
      <div className="flex-shrink-0 hidden sm:block">
        {category === 'promoter' && <Badge variant="success" size="sm">Promoter</Badge>}
        {category === 'passive' && <Badge variant="warning" size="sm">Passive</Badge>}
        {category === 'detractor' && <Badge variant="danger" size="sm">Detractor</Badge>}
        {category === 'pending' && <Badge variant="neutral" size="sm">No response</Badge>}
      </div>

      {/* Action */}
      <div className="flex-shrink-0">
        {category === 'promoter' && !nps.review_requested_at && (
          <button
            onClick={() => onRequestReview(nps)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[7px] bg-green/10 text-green text-[11px] font-medium hover:bg-green/15 transition-colors"
          >
            <ExternalLink size={11} />
            Request Review
          </button>
        )}
        {nps.review_requested_at && (
          <span className="text-[11px] text-label-3 flex items-center gap-1">
            <Send size={10} />
            Review link sent
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Request review modal ─────────────────────────────────────────────────────

function RequestReviewModal({
  nps,
  onClose,
  onSent,
}: {
  nps: EnrichedNps;
  onClose: () => void;
  onSent: () => void;
}) {
  const [googleLink, setGoogleLink] = useState('');
  const [sending, setSending] = useState(false);
  const name = nps.lead ? `${nps.lead.first_name} ${nps.lead.last_name}` : 'Borrower';

  async function handleSend() {
    if (!googleLink.trim()) return;
    setSending(true);
    try {
      await fetch('/api/inbox/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: nps.lead_id,
          channel: 'sms',
          body: `Thank you for the 10, ${nps.lead?.first_name ?? 'there'}! We'd love if you shared your experience: ${googleLink} 🙏`,
          toAddress: nps.lead?.email ?? '',
        }),
      });
      onSent();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-[16px] shadow-sheet p-6 space-y-4">
        <h2 className="text-[16px] font-semibold text-black">Request Google Review</h2>
        <p className="text-[13px] text-label-2">
          {name} gave you a {nps.score}/10. Send them your Google review link.
        </p>
        <input
          type="url"
          value={googleLink}
          onChange={(e) => setGoogleLink(e.target.value)}
          placeholder="https://g.page/your-business/review"
          className="w-full h-9 px-3 rounded-[8px] border border-[rgba(60,60,67,0.15)] text-[13px] outline-none focus:border-blue/60 focus:shadow-input transition-all"
        />
        <div className="flex items-center gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={sending} onClick={handleSend} disabled={!googleLink.trim()}>
            Send Review Link
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReviewsPage() {
  const sb = createClient();
  const [responses, setResponses] = useState<EnrichedNps[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState<EnrichedNps | null>(null);

  const loadData = useCallback(async () => {
    const { data: npsData } = await sb
      .from('nps_responses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    const leadIds = [...new Set((npsData ?? []).map((n) => n.lead_id).filter(Boolean))] as string[];

    const { data: leadsData } = leadIds.length
      ? await sb.from('leads').select('id,first_name,last_name,email,stage,closing_date').in('id', leadIds)
      : { data: [] };

    const leadsMap = new Map((leadsData ?? []).map((l) => [l.id, l]));

    setResponses(
      (npsData ?? []).map((n) => ({
        ...(n as NpsResponse),
        lead: leadsMap.get(n.lead_id) ?? null,
      }))
    );
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const answered = responses.filter((r) => r.score !== null);
  const npsScore = calcNPS(responses);

  const promoters = answered.filter((r) => (r.score ?? 0) >= 9).length;
  const passives = answered.filter((r) => (r.score ?? 0) >= 7 && (r.score ?? 0) <= 8).length;
  const detractors = answered.filter((r) => (r.score ?? 0) <= 6).length;
  const pending = responses.filter((r) => r.score === null).length;
  const responseRate = responses.length > 0 ? Math.round((answered.length / responses.length) * 100) : 0;

  async function handleRequestReview(nps: EnrichedNps) {
    setReviewModal(nps);
  }

  async function handleSendNPS(leadId: string) {
    await fetch('/api/automations/nps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId }),
    });
    void loadData();
  }

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-black tracking-tight">Reviews & NPS</h1>
        <p className="text-[14px] text-label-2 mt-0.5">
          Track borrower satisfaction and collect Google reviews from your promoters.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* NPS gauge */}
        <div className="lg:col-span-1 bg-white rounded-[12px] border border-[rgba(60,60,67,0.10)] shadow-card p-5 flex flex-col items-center justify-center">
          <NPSGauge score={npsScore} />
          <p className="text-[11px] text-label-3 mt-2">Net Promoter Score</p>
        </div>

        {/* Response breakdown */}
        <div className="lg:col-span-1 bg-white rounded-[12px] border border-[rgba(60,60,67,0.10)] shadow-card p-5 space-y-3">
          <h3 className="text-[12px] font-semibold text-label-2 uppercase tracking-wide">Breakdown</h3>
          <div className="space-y-1.5">
            {[
              { label: 'Promoters (9-10)', count: promoters, color: 'bg-green' },
              { label: 'Passives (7-8)', count: passives, color: 'bg-orange' },
              { label: 'Detractors (1-6)', count: detractors, color: 'bg-red' },
              { label: 'Pending', count: pending, color: 'bg-label-3' },
            ].map(({ label, count, color }) => {
              const total = responses.length || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[11px] text-label-2 w-28 flex-shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-[rgba(60,60,67,0.08)] rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] font-semibold text-black w-6 text-right tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Response rate */}
        <div className="bg-white rounded-[12px] border border-[rgba(60,60,67,0.10)] shadow-card p-5 flex flex-col justify-between">
          <div>
            <p className="text-[12px] font-semibold text-label-2 uppercase tracking-wide mb-2">Response Rate</p>
            <p className="text-[32px] font-bold text-black tabular-nums">{responseRate}%</p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-label-3">
            <MessageSquare size={11} />
            {answered.length} of {responses.length} replied
          </div>
        </div>

        {/* Total surveys */}
        <div className="bg-white rounded-[12px] border border-[rgba(60,60,67,0.10)] shadow-card p-5 flex flex-col justify-between">
          <div>
            <p className="text-[12px] font-semibold text-label-2 uppercase tracking-wide mb-2">Total Sent</p>
            <p className="text-[32px] font-bold text-black tabular-nums">{responses.length}</p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-label-3">
            <Award size={11} />
            {promoters} Google-ready promoters
          </div>
        </div>
      </div>

      {/* Response table */}
      <div className="bg-white rounded-[12px] border border-[rgba(60,60,67,0.10)] shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(60,60,67,0.08)]">
          <h2 className="text-[15px] font-semibold text-black">Survey Responses</h2>
          <button
            onClick={() => void loadData()}
            className="flex items-center gap-1.5 text-[12px] text-label-2 hover:text-black transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-label-3 text-[13px]">Loading…</div>
        ) : responses.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <Star size={28} className="text-label-3" />
            <p className="text-[14px] font-semibold text-black">No NPS surveys sent yet</p>
            <p className="text-[13px] text-label-2">Surveys are sent automatically 14 days after a loan closes.</p>
          </div>
        ) : (
          <div>
            {responses.map((nps) => (
              <ResponseRow key={nps.id} nps={nps} onRequestReview={handleRequestReview} />
            ))}
          </div>
        )}
      </div>

      {/* Review modal */}
      {reviewModal && (
        <RequestReviewModal
          nps={reviewModal}
          onClose={() => setReviewModal(null)}
          onSent={() => {
            setReviewModal(null);
            void loadData();
          }}
        />
      )}
    </div>
  );
}
