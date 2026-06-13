'use client';

import { useEffect, useState } from 'react';
import { IconShieldCheck, IconMessageCheck, IconBan, IconClockCheck, IconCertificate, IconHistory } from '@tabler/icons-react';

interface Shield {
  tcpa: { consentsOnFile: number; optOutsHonored: number; consentEvents30d: number };
  trid: { onTimePct: number | null; compliant: number; breaches: number; total: number };
  trail: { kind: string; label: string; at: string }[];
}

export function ShieldClient() {
  const [d, setD] = useState<Shield | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/compliance/shield').then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-[var(--c-surface)] rounded-card border border-[var(--c-border)] p-8 text-[13px] text-[var(--c-label2)]">Checking your compliance posture…</div>;
  if (!d) return <div className="bg-[var(--c-surface)] rounded-card border border-[var(--c-border)] p-8 text-[13px] text-[var(--c-label2)]">Compliance data isn&rsquo;t available.</div>;

  const cards = [
    { icon: <IconMessageCheck size={18} />, label: 'SMS consents on file', value: d.tcpa.consentsOnFile, hint: 'Borrowers who affirmatively opted in (TCPA)' },
    { icon: <IconBan size={18} />, label: 'Opt-outs honored', value: d.tcpa.optOutsHonored, hint: 'STOP requests — auto-suppressed from all sends' },
    { icon: <IconClockCheck size={18} />, label: 'TRID on-time', value: d.trid.onTimePct == null ? '—' : `${d.trid.onTimePct}%`, hint: `${d.trid.compliant}/${d.trid.total} disclosures delivered on time` },
    { icon: <IconCertificate size={18} />, label: 'NMLS disclosure', value: 'Enforced', hint: 'Required on every client-facing material, never omittable' },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-card bg-[#0F0D0B] p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#C9A95C] flex items-center justify-center flex-shrink-0"><IconShieldCheck size={26} color="#5A3E15" /></div>
        <div>
          <p className="text-[15px] font-semibold text-[#F5F3F0]">Compliance Shield active</p>
          <p className="text-[12.5px] text-white/55 mt-0.5">{d.tcpa.consentEvents30d} consent events logged in the last 30 days{d.trid.breaches > 0 ? ` · ${d.trid.breaches} TRID item${d.trid.breaches === 1 ? '' : 's'} need attention` : ' · no TRID breaches'}.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-[var(--c-surface)] rounded-card border border-[var(--c-border)] p-4">
            <div className="flex items-center justify-between text-[var(--c-gold-deep)]">{c.icon}<span className="text-[20px] font-semibold text-[var(--c-text)] font-mono">{c.value}</span></div>
            <p className="text-[12.5px] font-medium text-[var(--c-text)] mt-2">{c.label}</p>
            <p className="text-[11px] text-[var(--c-label2)] mt-0.5">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="bg-[var(--c-surface)] rounded-card border border-[var(--c-border)] p-5">
        <div className="flex items-center gap-2 mb-3"><IconHistory size={16} className="text-[var(--c-gold-deep)]" /><p className="text-[13px] font-semibold text-[var(--c-text)]">Audit trail</p><span className="text-[11px] text-[var(--c-label3)] ml-auto">Immutable · insert-only</span></div>
        {d.trail.length === 0 ? (
          <p className="text-[12.5px] text-[var(--c-label2)]">No recorded events yet. Consent changes and admin actions will appear here.</p>
        ) : (
          <div className="divide-y divide-[var(--c-border)]">
            {d.trail.map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2">
                <span className="text-[12.5px] text-[var(--c-text)] capitalize">{t.label.replace(/_/g, ' ')}</span>
                <span className="text-[11px] text-[var(--c-label2)] flex-shrink-0">{new Date(t.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
