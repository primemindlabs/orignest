'use client';

/** Phase 42.6 — phone pipeline: a filterable list (kanban is desktop-only). */
import { useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';

interface Lead { id: string; first_name: string; last_name: string; stage: string; loan_amount: number | null; data_ownership?: string }

const STAGES: { key: string; label: string }[] = [
  { key: 'new_inquiry', label: 'New' }, { key: 'pre_qual', label: 'Pre-Qual' }, { key: 'application', label: 'Application' },
  { key: 'processing', label: 'Processing' }, { key: 'underwriting', label: 'Underwriting' },
  { key: 'conditional_approval', label: 'Cond. Approval' }, { key: 'clear_to_close', label: 'Clear to Close' },
];
const LABEL = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));

export function MobilePipelineView({ leads, className = '' }: { leads: Lead[]; className?: string }) {
  const [stage, setStage] = useState<string | null>(null);
  const shown = stage ? leads.filter((l) => l.stage === stage) : leads;

  return (
    <div className={className}>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        <Pill active={!stage} onClick={() => setStage(null)} label="All" count={leads.length} />
        {STAGES.map((s) => {
          const c = leads.filter((l) => l.stage === s.key).length;
          if (!c) return null;
          return <Pill key={s.key} active={stage === s.key} onClick={() => setStage(s.key)} label={s.label} count={c} />;
        })}
      </div>

      <div className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] overflow-hidden divide-y divide-[var(--c-border)] mt-2">
        {shown.map((l) => (
          <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-[var(--c-fill)]">
            <div className="h-9 w-9 rounded-full bg-[var(--c-gold-light)] flex items-center justify-center flex-shrink-0">
              <span className="text-[12px] font-semibold text-[var(--c-gold-deep)]">{(l.first_name?.[0] ?? '') + (l.last_name?.[0] ?? '')}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[var(--c-text)] truncate flex items-center gap-1.5">{l.first_name} {l.last_name}{l.data_ownership === 'lo_personal' && <Lock size={10} className="text-[var(--c-gold-deep)]" />}</p>
              <p className="text-[11px] text-[var(--c-label2)]">{l.loan_amount ? `$${(l.loan_amount / 1000).toFixed(0)}k · ` : ''}{LABEL[l.stage] ?? l.stage}</p>
            </div>
          </Link>
        ))}
        {shown.length === 0 && <p className="text-[12px] text-[var(--c-label2)] px-4 py-4 text-center">No loans in this stage.</p>}
      </div>
    </div>
  );
}

function Pill({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick} className={`flex-shrink-0 inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full border ${active ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]' : 'border-[var(--c-border)] text-[var(--c-label2)]'}`}>
      {label} <span className="font-mono tabular-nums opacity-70">{count}</span>
    </button>
  );
}
