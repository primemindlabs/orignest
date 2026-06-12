'use client';

// Phase 86 — Rate-trigger blast workflow (4 steps): select candidates → preview (with the
// locked RESPA disclaimer) → confirm → sent. Additive panel on /refi-watch; self-fetches
// eligible candidates. The server appends the RESPA disclaimer + logs refi_blast_jobs.

import { useEffect, useState } from 'react';
import {
  IconRadar2, IconArrowRight, IconChevronDown, IconChevronRight, IconCheck, IconLoader2, IconMailForward,
} from '@tabler/icons-react';
import { RespaDisclaimerBlock } from './RespaDisclaimerBlock';

type Candidate = {
  id: string;
  lead_id: string;
  original_rate: number;
  current_market_rate: number;
  rate_spread: number;
  monthly_savings: number;
  outreach_status: string;
  leads: { first_name: string | null; email: string | null; loan_type: string | null; unsubscribed_email: boolean | null } | null;
};

const DEFAULT_TEMPLATE =
  "Hi {first_name}, rates have dropped and you may be able to save {rate_savings}/mo on your mortgage. I'd be glad to run the numbers with you — reply anytime.";

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function RefiBlastPanel() {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ recipient_count: number; transmitted: number; reason: string | null } | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    fetch('/api/refi-blast')
      .then((r) => r.json())
      .then((d) => setCandidates(d.candidates ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [open, loaded]);

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = candidates.length > 0 && selected.size === candidates.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(candidates.map((c) => c.id)));

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/refi-blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_ids: [...selected], message_template: template }),
      });
      const d = await res.json();
      if (res.ok) {
        setResult({ recipient_count: d.recipient_count, transmitted: d.transmitted, reason: d.reason });
        setStep(4);
      }
    } finally {
      setSending(false);
    }
  };

  const selectedCount = selected.size;

  return (
    <section className="bg-white border border-[var(--color-border-tertiary)] rounded-[12px] overflow-hidden mb-4">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-[#fdfbf7] transition-colors text-left">
        <IconRadar2 size={16} className="text-[var(--c-gold-deep)]" />
        <span className="text-[13px] font-semibold text-black">Rate-trigger blast</span>
        <span className="text-[11px] text-[var(--color-text-secondary)]">Reviewed outreach with the required RESPA disclaimer</span>
        {open ? <IconChevronDown size={15} className="ml-auto text-[var(--color-text-secondary)]" /> : <IconChevronRight size={15} className="ml-auto text-[var(--color-text-secondary)]" />}
      </button>

      {open && (
        <div className="border-t border-[var(--color-border-tertiary)] p-4">
          {!loaded ? (
            <div className="h-16 rounded-[10px] bg-[rgba(60,60,67,0.04)] animate-pulse" />
          ) : step === 4 && result ? (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-10 h-10 rounded-full bg-[rgba(45,122,79,0.12)] grid place-items-center mb-3">
                <IconCheck size={20} className="text-[var(--c-green)]" />
              </div>
              <p className="text-[14px] font-semibold text-black">Blast complete</p>
              <p className="text-[12px] text-[var(--color-text-secondary)] mt-1">
                {result.transmitted > 0 ? `${result.transmitted} of ${result.recipient_count} emails sent.` : `Recorded ${result.recipient_count} recipient(s).`}
              </p>
              {result.reason && <p className="text-[11px] text-[var(--c-warning)] mt-1 max-w-sm">{result.reason}</p>}
            </div>
          ) : candidates.length === 0 ? (
            <p className="text-[12px] text-[var(--color-text-secondary)] text-center py-6">No refi candidates ready for outreach. Run a scan from Refi Watch first.</p>
          ) : (
            <>
              {/* Step indicator */}
              <div className="flex items-center gap-2 mb-3 text-[11px] text-[var(--color-text-secondary)]">
                {['Select', 'Preview', 'Confirm'].map((label, i) => (
                  <span key={label} className={`inline-flex items-center gap-1 ${step === i + 1 ? 'text-[var(--c-gold-deep)] font-semibold' : ''}`}>
                    {i > 0 && <IconArrowRight size={11} />}{label}
                  </span>
                ))}
              </div>

              {step === 1 && (
                <>
                  <div className="border border-[var(--color-border-tertiary)] rounded-[10px] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-background-secondary)] text-[11px] font-medium text-[var(--color-text-secondary)]">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-[var(--c-gold)]" />
                      <span>Borrower</span><span className="ml-auto">Rate → market</span><span className="w-24 text-right">Est. savings</span>
                    </div>
                    {candidates.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 px-3 py-2 border-t border-[var(--color-border-tertiary)] text-[12px] cursor-pointer hover:bg-[#fdfbf7]">
                        <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="accent-[var(--c-gold)]" />
                        <span className="font-medium text-black">{c.leads?.first_name ?? 'Borrower'}</span>
                        {!c.leads?.email && <span className="text-[10px] text-[var(--c-warning)]">no email</span>}
                        <span className="ml-auto tabular-nums text-[var(--color-text-secondary)]">
                          {Number(c.original_rate).toFixed(3)}% <span className="text-[var(--c-green)]">→ {Number(c.current_market_rate).toFixed(3)}%</span>
                        </span>
                        <span className="w-24 text-right font-medium text-[#8A6310] tabular-nums">{usd(c.monthly_savings)}/mo</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end mt-3">
                    <button onClick={() => setStep(2)} disabled={selectedCount === 0} className="h-9 px-4 rounded-[10px] text-[13px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-40">
                      Next · {selectedCount} selected
                    </button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mb-1.5">Merge fields: <code>{'{first_name}'}</code> · <code>{'{rate_savings}'}</code></p>
                  <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={5}
                    className="w-full resize-none text-[13px] text-black bg-[var(--color-background-secondary)] border border-[var(--color-border-tertiary)] rounded-[10px] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--c-gold)]" />
                  <RespaDisclaimerBlock />
                  <div className="flex justify-between mt-3">
                    <button onClick={() => setStep(1)} className="h-9 px-4 rounded-[10px] text-[13px] text-[var(--color-text-secondary)] hover:bg-[rgba(60,60,67,0.06)]">Back</button>
                    <button onClick={() => setStep(3)} disabled={!template.trim()} className="h-9 px-4 rounded-[10px] text-[13px] font-medium bg-[var(--c-gold)] text-white disabled:opacity-40">Review</button>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="rounded-[10px] border border-[var(--color-border-tertiary)] p-4 text-center">
                    <p className="text-[14px] font-semibold text-black">Send refi outreach to {selectedCount} borrower{selectedCount === 1 ? '' : 's'}?</p>
                    <p className="text-[12px] text-[var(--color-text-secondary)] mt-1">The RESPA disclaimer is appended automatically to every message.</p>
                  </div>
                  <div className="flex justify-between mt-3">
                    <button onClick={() => setStep(2)} className="h-9 px-4 rounded-[10px] text-[13px] text-[var(--color-text-secondary)] hover:bg-[rgba(60,60,67,0.06)]">Back</button>
                    <button onClick={send} disabled={sending} className="h-9 px-4 rounded-[10px] text-[13px] font-medium bg-[var(--c-gold)] text-white inline-flex items-center gap-1.5 disabled:opacity-50">
                      {sending ? <IconLoader2 size={14} className="animate-spin" /> : <IconMailForward size={14} />} Send blast
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
