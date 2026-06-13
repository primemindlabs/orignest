'use client';

import { useEffect, useState } from 'react';
import { IconClockHour4, IconSparkles, IconSend, IconBellRinging, IconFileText, IconTrendingUp } from '@tabler/icons-react';

interface Impact {
  month: string;
  hoursSaved: number;
  pipelineTouched: number;
  breakdown: { aiAssists: number; automatedUpdates: number; alertsSurfaced: number; proposals: number; loansAdvanced: number };
}

const usd = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n).toLocaleString()}`);

export function ImpactClient() {
  const [data, setData] = useState<Impact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ai/impact').then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-[var(--c-surface)] rounded-card border border-[var(--c-border)] p-8 text-[13px] text-[var(--c-label2)]">Calculating Ashley&rsquo;s impact…</div>;
  if (!data) return <div className="bg-[var(--c-surface)] rounded-card border border-[var(--c-border)] p-8 text-[13px] text-[var(--c-label2)]">Impact data isn&rsquo;t available yet.</div>;

  const b = data.breakdown;
  const cards = [
    { icon: <IconSparkles size={18} />, label: 'AI assists', value: b.aiAssists, hint: 'Questions answered & messages drafted' },
    { icon: <IconSend size={18} />, label: 'Automated updates sent', value: b.automatedUpdates, hint: 'Milestone texts, emails & outreach' },
    { icon: <IconBellRinging size={18} />, label: 'Proactive alerts', value: b.alertsSurfaced, hint: 'At-risk loans, rate drops, TRID flags' },
    { icon: <IconFileText size={18} />, label: 'Proposals generated', value: b.proposals, hint: 'Personalized borrower proposals' },
    { icon: <IconTrendingUp size={18} />, label: 'Loans advanced', value: b.loansAdvanced, hint: 'Files that moved forward a stage' },
  ];

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-card bg-[#0F0D0B] p-6 sm:p-8 grid sm:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 text-[rgba(201,169,92,.7)] mb-2"><IconClockHour4 size={16} /><span className="text-[12px] font-medium uppercase tracking-wide">Time saved · {data.month}</span></div>
          <p className="text-[44px] leading-none font-semibold text-[#F5F3F0] font-mono">{data.hoursSaved}<span className="text-[20px] text-[#C9A95C] ml-1">hrs</span></p>
          <p className="text-[12.5px] text-white/50 mt-2">Estimated hours Ashley saved your team on drafting, follow-up, and busywork this month.</p>
        </div>
        <div className="sm:border-l sm:border-white/10 sm:pl-6 flex flex-col justify-center">
          <p className="text-[12px] font-medium uppercase tracking-wide text-[rgba(201,169,92,.7)] mb-1">Pipeline moved</p>
          <p className="text-[32px] leading-none font-semibold text-[#F5F3F0] font-mono">{usd(data.pipelineTouched)}</p>
          <p className="text-[12.5px] text-white/50 mt-2">Total loan volume that advanced a stage this month.</p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-[var(--c-surface)] rounded-card border border-[var(--c-border)] p-4">
            <div className="flex items-center gap-2 text-[var(--c-gold-deep)]">{c.icon}<span className="text-[22px] font-semibold text-[var(--c-text)] font-mono ml-auto">{c.value.toLocaleString()}</span></div>
            <p className="text-[13px] font-medium text-[var(--c-text)] mt-2">{c.label}</p>
            <p className="text-[11.5px] text-[var(--c-label2)] mt-0.5">{c.hint}</p>
          </div>
        ))}
      </div>

      <p className="text-[11.5px] text-[var(--c-label2)] px-1">
        Time-saved is an estimate based on typical effort per task (AI assist ~5 min, automated update ~4 min, proposal ~25 min, alert ~3 min). Counts reflect activity across your organization this calendar month.
      </p>
    </div>
  );
}
