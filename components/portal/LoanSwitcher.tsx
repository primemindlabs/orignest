'use client';

// Phase 111 — borrower multi-loan switcher for the token portal. Self-contained:
// fetches the borrower's loans for this token and links to each loan's /status/[token].
// Hidden entirely for single-loan borrowers. Gold accent (no navy).
import { useEffect, useRef, useState } from 'react';
import { IconChevronDown, IconCheck } from '@tabler/icons-react';

interface PortalLoan {
  lead_id: string;
  token: string;
  property_address: string | null;
  loan_type: string | null;
  stage: string | null;
  is_current: boolean;
}

const stageLabel = (s: string | null) => (s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function LoanSwitcher({ token }: { token: string }) {
  const [loans, setLoans] = useState<PortalLoan[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/borrower-portal/${token}/loans`)
      .then((r) => (r.ok ? r.json() : { loans: [] }))
      .then((d) => setLoans(d.loans ?? []))
      .catch(() => setLoans([]));
  }, [token]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // No switcher for single-loan borrowers — no UI clutter.
  if (loans.length <= 1) return null;

  const active = loans.find((l) => l.is_current) ?? loans[0];
  const labelFor = (l: PortalLoan) => l.property_address || stageLabel(l.loan_type) || 'Your loan';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#F4F2EF] rounded-lg text-[12px] font-medium text-gray-700 hover:bg-[#ECE9E4] transition-colors max-w-[260px]"
      >
        <span className="w-2 h-2 rounded-full bg-[#C9A95C] shrink-0" />
        <span className="truncate">{labelFor(active)}</span>
        <IconChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-[280px] z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1">
          <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-400">Your loans</p>
          {loans.map((l) => (
            <a
              key={l.lead_id}
              href={`/status/${l.token}`}
              className="flex items-center gap-2 px-3 py-2 text-[13px] text-gray-700 hover:bg-[#F4F2EF] transition-colors"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${l.is_current ? 'bg-[#C9A95C]' : 'bg-gray-300'}`} />
              <span className="flex-1 min-w-0">
                <span className="block truncate">{labelFor(l)}</span>
                {l.stage && <span className="block text-[11px] text-gray-400">{stageLabel(l.stage)}</span>}
              </span>
              {l.is_current && <IconCheck size={14} className="text-[#C9A95C] shrink-0" />}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
