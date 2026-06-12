'use client';

// Phase 93 — client-facing readiness card. Surfaces the NMLS + AE gates so an LO can see
// (and fix) what's blocking borrower-facing features. Hides itself once fully ready.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Circle, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Status { nmls_set: boolean; ae_passed: boolean; ready: boolean; blocking: string[] }

const STEPS = [
  { key: 'nmls', label: 'NMLS number on file', hint: 'Required on every borrower communication (RESPA/TRID).', href: '/settings/profile', required: true },
  { key: 'ae', label: 'At least one lender AE', hint: 'Build your AE directory so you can place loans.', href: '/ae-connect', required: false },
] as const;

export function GateReadinessCard() {
  const [s, setS] = useState<Status | null>(null);

  useEffect(() => {
    fetch('/api/settings/gates').then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {});
  }, []);

  if (!s || s.ready) return null;

  const done = (key: string) => (key === 'nmls' ? s.nmls_set : s.ae_passed);
  const nmlsBlocking = !s.nmls_set;

  return (
    <div className="bg-surface rounded-card shadow-card border border-border p-5">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={16} className="text-[var(--c-gold-deep)]" />
        <h3 className="text-sm font-semibold text-black">Client-facing readiness</h3>
      </div>
      {nmlsBlocking && (
        <p className="text-[12px] text-[var(--c-danger)] flex items-center gap-1.5 mb-3">
          <AlertTriangle size={13} /> Borrower communications are blocked until your NMLS number is set.
        </p>
      )}
      <div className="space-y-2 mt-2">
        {STEPS.map((step) => {
          const isDone = done(step.key);
          return (
            <Link key={step.key} href={step.href} className="flex items-start gap-2.5 group">
              {isDone ? <CheckCircle2 size={16} className="text-[#3FB68B] flex-shrink-0 mt-0.5" /> : <Circle size={16} className="text-label-3 flex-shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-black group-hover:text-[var(--c-gold-deep)] transition-colors">
                  {step.label}
                  {step.required && !isDone && <span className="ml-1.5 text-[10px] font-semibold text-[var(--c-danger)] uppercase">Required</span>}
                </p>
                <p className="text-[11px] text-label-2">{step.hint}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
