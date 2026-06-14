'use client';

import { useState } from 'react';
import { IconChevronDown, IconChevronUp, IconMessage, IconMail, IconX } from '@tabler/icons-react';
import { SIGNAL_LABELS, type GoldmineSignalType } from '@/lib/goldmine/types';

export type GoldmineOpp = {
  id: string;
  contact_name: string;
  signal_type: GoldmineSignalType;
  signal_headline: string;
  signal_detail: Record<string, any>;
  priority_score: number;
  estimated_comp_dollars: number | null;
  draft_sms: string | null;
  draft_email_subject: string | null;
  draft_email_body: string | null;
  status: string;
};

const SIGNAL_COLOR: Record<string, string> = {
  rate_improvement: '#1A7A45',
  equity_milestone: '#876830',
  pre_approval_expired: '#6B7B8D',
  loan_anniversary: '#C9A95C',
  long_inactive: '#6B7B8D',
  denial_retry: '#6B7B8D',
};

function detailLine(o: GoldmineOpp): string | null {
  const d = o.signal_detail ?? {};
  switch (o.signal_type) {
    case 'rate_improvement':
      return d.original_rate != null ? `Original ${d.original_rate}% · Market ${d.current_market}% · Δ ${d.delta}%` : null;
    case 'equity_milestone':
      return d.estimated_equity != null ? `Est. equity $${Math.round(Number(d.estimated_equity) / 1000)}K` : null;
    case 'pre_approval_expired':
      return d.days_since_last_activity != null ? `${d.days_since_last_activity} days since last activity` : null;
    case 'loan_anniversary':
      return d.years != null ? `${d.years}-year anniversary` : null;
    case 'long_inactive':
      return d.days_since_last_contact != null ? `${d.days_since_last_contact} days since contact` : null;
    default:
      return null;
  }
}

type Props = {
  opp: GoldmineOpp;
  onSend: (id: string, channel: 'sms' | 'email') => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
};

export function GoldmineOpportunityCard({ opp, onSend, onDismiss }: Props) {
  const [showDraft, setShowDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const initial = opp.contact_name.charAt(0).toUpperCase();
  const detail = detailLine(opp);
  const color = SIGNAL_COLOR[opp.signal_type] ?? '#6B7B8D';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E8E4DE] px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[#F4F2EF] flex items-center justify-center flex-shrink-0 text-sm font-semibold text-[#6B7B8D]">
          {initial}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[#1A1A1A]">{opp.contact_name}</p>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color, backgroundColor: `${color}15` }}>
              {SIGNAL_LABELS[opp.signal_type]}
            </span>
            {opp.estimated_comp_dollars != null && (
              <span className="text-xs text-[#6B7B8D]" style={{ fontFamily: 'var(--font-dm-mono), DM Mono, monospace' }}>
                ~${opp.estimated_comp_dollars.toLocaleString()} est.
              </span>
            )}
          </div>
          <p className="text-sm text-[#1A1A1A] font-medium mt-1 leading-snug">{opp.signal_headline}</p>
          {detail && <p className="text-xs text-[#6B7B8D] mt-0.5" style={{ fontFamily: 'var(--font-dm-mono), DM Mono, monospace' }}>{detail}</p>}

          {(opp.draft_sms || opp.draft_email_body) && (
            <div className="mt-2">
              <button onClick={() => setShowDraft((v) => !v)} className="text-xs text-[#876830] flex items-center gap-1 hover:underline">
                {showDraft ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
                {showDraft ? 'Hide draft' : 'View draft'}
              </button>
              {showDraft && (
                <div className="mt-2 bg-[#F9F7F4] rounded-lg px-4 py-3 text-sm text-[#4A4A4A] leading-relaxed whitespace-pre-wrap">
                  {opp.draft_sms ?? opp.draft_email_body}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => run(() => onSend(opp.id, 'sms'))}
              disabled={busy || !opp.draft_sms}
              className="flex items-center gap-1.5 bg-[#C9A95C] text-white text-xs px-3 py-1.5 rounded-lg hover:brightness-95 disabled:opacity-40"
            >
              <IconMessage size={13} /> Send Text
            </button>
            <button
              onClick={() => run(() => onSend(opp.id, 'email'))}
              disabled={busy || !opp.draft_email_body}
              className="flex items-center gap-1.5 border border-[#E8E4DE] text-[#4A4A4A] text-xs px-3 py-1.5 rounded-lg hover:bg-[#FAFAF8] disabled:opacity-40"
            >
              <IconMail size={13} /> Send Email
            </button>
            <button
              onClick={() => run(() => onDismiss(opp.id))}
              disabled={busy}
              className="flex items-center gap-1.5 text-[#6B7B8D] text-xs px-2 py-1.5 rounded-lg hover:text-[#C4724A] hover:bg-[#FFF4F0] disabled:opacity-40 ml-auto"
            >
              <IconX size={13} /> Dismiss 90d
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
