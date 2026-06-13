'use client';

/**
 * Phase 73 (Fix 1) — consolidates the per-loan tool links into one "Tools" dropdown,
 * resolving the long-flagged header overflow (was 14 inline buttons). Uses the app's
 * real design system (--c-* tokens + lucide). Closes on outside-click / Escape.
 */
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Wrench, ChevronDown, FileText, PenLine, FileCheck, ShieldCheck, Building2, ScrollText, Calculator, HardHat, PartyPopper, ClipboardList, MessagesSquare, GitCompare, UserCheck, Landmark, FileBadge } from 'lucide-react';

interface Tool { href: string; label: string; icon: React.ReactNode }

export function LeadToolsMenu({ loanId, isConstruction, isClosed }: { loanId: string; isConstruction?: boolean; isClosed?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const tools: Tool[] = [
    { href: `/loans/${loanId}/internal-chat`, label: 'Team Chat', icon: <MessagesSquare size={15} /> },
    { href: `/loans/${loanId}/apply-1003`, label: 'Digital 1003', icon: <ClipboardList size={15} /> },
    { href: `/loans/${loanId}/scenarios`, label: 'Scenario Builder', icon: <GitCompare size={15} /> },
    { href: `/loans/${loanId}/proposal`, label: 'Loan Proposal', icon: <FileBadge size={15} /> },
    { href: `/deal-desk?lead=${loanId}`, label: 'AE Deal Desk', icon: <Landmark size={15} /> },
    { href: `/loans/${loanId}/income`, label: 'Income', icon: <Calculator size={15} /> },
    { href: `/loans/${loanId}/loe`, label: 'Letter of Explanation', icon: <ScrollText size={15} /> },
    { href: `/loans/${loanId}/waiver-check`, label: 'Appraisal Waiver', icon: <FileCheck size={15} /> },
    { href: `/loans/${loanId}/hoa`, label: 'HOA Warrantability', icon: <Building2 size={15} /> },
    { href: `/loans/${loanId}/title`, label: 'Title & Closing', icon: <ShieldCheck size={15} /> },
    { href: `/loans/${loanId}/identity`, label: 'Identity Verification', icon: <UserCheck size={15} /> },
    { href: `/loans/${loanId}/signatures`, label: 'Signatures', icon: <PenLine size={15} /> },
    ...(isConstruction ? [{ href: `/loans/${loanId}/construction`, label: 'Construction', icon: <HardHat size={15} /> }] : []),
    ...(isClosed ? [{ href: `/loans/${loanId}/closing-post`, label: 'Closing Celebration', icon: <PartyPopper size={15} /> }] : []),
  ];

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-[13px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)] transition-colors">
        <Wrench size={14} className="text-[var(--c-gold-deep)]" /> Tools <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-56 z-40 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] shadow-lg py-1">
          {tools.map((t) => (
            <Link key={t.href} href={t.href} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--c-text)] hover:bg-[var(--c-fill)] transition-colors">
              <span className="text-[var(--c-gold-deep)]">{t.icon}</span> {t.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
