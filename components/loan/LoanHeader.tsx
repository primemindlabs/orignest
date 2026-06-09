'use client';

/**
 * Phase 28.2 — Sticky loan header. 64px, always visible in file mode.
 * Four KPI pills (DTI · Risk · Lock · Conditions) refresh in real time via a
 * Supabase Realtime subscription on the loan's underwriting tables.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { LoanSummary } from '@/lib/loans/getLoanSummary';

interface Kpis {
  stage: string;
  dti: number | null;
  riskScore: number | null;
  lockExpiresAt: string | null;
  lockStatus: string | null;
  openConditions: number;
}

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New', pre_qual: 'Pre-Qual', application: 'Application', processing: 'Processing',
  underwriting: 'UW', conditional_approval: 'Cond. Approval', clear_to_close: 'CTC',
  closed: 'Closed', declined: 'Declined', withdrawn: 'Withdrawn',
};

function dollars(n: number | null): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

type PillTone = 'green' | 'amber' | 'orange' | 'red' | 'gray';
// All tones sourced from CSS vars (no hardcoded hex). 'orange' is a lighter
// weight of the danger hue, 'red' a stronger one — gradation without a new color.
const TONE_CLASS: Record<PillTone, string> = {
  green: 'bg-[var(--c-success)]/12 text-[var(--c-success)]',
  amber: 'bg-[var(--c-warning)]/12 text-[var(--c-warning)]',
  orange: 'bg-[var(--c-danger)]/10 text-[var(--c-danger)]',
  red: 'bg-[var(--c-danger)]/20 text-[var(--c-danger)] font-bold',
  gray: 'bg-[var(--c-fill)] text-[var(--c-label2)]',
};

function Pill({ href, label, tone }: { href: string; label: string; tone: PillTone }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-opacity hover:opacity-80 ${TONE_CLASS[tone]}`}>
      {label}
    </Link>
  );
}

export function LoanHeader({ loan }: { loan: LoanSummary }) {
  const base = `/loans/${loan.id}`;
  const [kpis, setKpis] = useState<Kpis>({
    stage: loan.stage,
    dti: loan.dti,
    riskScore: loan.riskScore,
    lockExpiresAt: loan.lockExpiresAt,
    lockStatus: loan.lockStatus,
    openConditions: loan.openConditions,
  });

  useEffect(() => {
    const supabase = createClient();
    async function refresh() {
      try {
        const res = await fetch(`/api/loans/${loan.id}/kpis`);
        if (res.ok) setKpis(await res.json());
      } catch {
        /* keep last values */
      }
    }
    const channel = supabase.channel(`loan-kpis-${loan.id}`);
    for (const table of ['leads', 'dti_worksheets', 'uw_files', 'rate_lock_expirations', 'loan_conditions']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `lead_id=eq.${loan.id}` }, refresh);
    }
    // leads filters on id, not lead_id
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `id=eq.${loan.id}` }, refresh);
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loan.id]);

  // ── Pill tone logic ──
  const dtiTone: PillTone = kpis.dti == null ? 'gray' : kpis.dti <= 43 ? 'green' : kpis.dti <= 50 ? 'amber' : 'red';
  const riskTone: PillTone = kpis.riskScore == null ? 'gray' : kpis.riskScore <= 25 ? 'green' : kpis.riskScore <= 50 ? 'amber' : kpis.riskScore <= 75 ? 'orange' : 'red';
  const lockDays = daysUntil(kpis.lockExpiresAt);
  const lockTone: PillTone = lockDays == null || kpis.lockStatus === 'floating' ? 'gray' : lockDays > 10 ? 'green' : lockDays >= 5 ? 'amber' : 'red';
  const condTone: PillTone = kpis.openConditions === 0 ? 'green' : kpis.openConditions <= 3 ? 'amber' : 'red';

  return (
    <header className="flex-shrink-0 bg-[var(--c-surface)] border-b border-[var(--c-border)] px-5 h-16 flex items-center gap-4">
      <Link href="/pipeline" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] transition-colors flex-shrink-0">
        <ArrowLeft size={15} /> Pipeline
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className="text-[15px] font-semibold text-[var(--c-text)] truncate">{loan.borrowerName || 'Borrower'}</span>
          <span className="text-[12px] text-[var(--c-label2)] font-mono tabular-nums truncate">
            {dollars(loan.loanAmount)} · {loan.programLabel} · {loan.transactionLabel}
          </span>
        </div>
        {loan.propertyAddress && (
          <p className="text-[11px] text-[var(--c-label3)] truncate">{loan.propertyAddress}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Pill href={`${base}/underwriting/dti`} label={`DTI ${kpis.dti != null ? kpis.dti + '%' : '—'}`} tone={dtiTone} />
        <Pill href={`${base}/underwriting/risk`} label={`Risk ${kpis.riskScore ?? '—'}`} tone={riskTone} />
        <Pill href={`${base}/disclosures`} label={`Lock ${lockDays != null && kpis.lockStatus !== 'floating' ? lockDays + 'd' : '—'}`} tone={lockTone} />
        <Pill href={`${base}/conditions`} label={`Conditions ${kpis.openConditions}`} tone={condTone} />
        <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]">
          {STAGE_LABELS[kpis.stage] ?? kpis.stage}
        </span>
      </div>
    </header>
  );
}
