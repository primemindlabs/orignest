'use client';

/** Phase 43.11 — non-intrusive nudge to Scenario AI when a deal needs a non-agency lender match. */
import Link from 'next/link';
import { Target, ArrowRight } from 'lucide-react';

const MESSAGES: Record<string, string> = {
  dscr_below_1: 'DSCR is below 1.0 — standard DSCR lenders will decline. There may still be options.',
  non_warrantable: "This condo is non-warrantable. Fannie/Freddie won't touch it, but portfolio lenders might.",
  non_qm_scenario: 'This is a Non-QM scenario. Let Scenario AI match you to the right wholesale lender.',
  commercial: 'Commercial loans take a different path. Scenario AI can identify the right capital source.',
};

export function ScenarioAIPrompt({ trigger }: { trigger: keyof typeof MESSAGES }) {
  return (
    <div className="rounded-[14px] border border-[var(--c-gold)]/40 bg-[var(--c-gold-light)] p-4">
      <div className="flex items-start gap-3">
        <Target size={18} className="text-[var(--c-gold-deep)] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-semibold text-[var(--c-text)]">{MESSAGES[trigger]}</p>
          <p className="text-[12px] text-[var(--c-label2)] mt-0.5">Scenario AI analyzes the borrower&apos;s actual numbers and matches them to lenders whose overlays fit this deal.</p>
          <Link href="/scenarios" className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--c-gold-deep)] hover:underline">Open Scenario AI <ArrowRight size={13} /></Link>
        </div>
      </div>
    </div>
  );
}
