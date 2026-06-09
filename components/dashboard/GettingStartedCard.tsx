/**
 * Phase 36 — compact "finish setup" nudge on the dashboard. Renders nothing once
 * the checklist is dismissed or fully complete.
 */
import { getOnboardingStatus } from '@/lib/onboarding/status';
import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';

export async function GettingStartedCard({ orgId, clerkUserId }: { orgId: string; clerkUserId: string }) {
  const status = await getOnboardingStatus(orgId, clerkUserId);
  if (status.dismissed || status.allDone) return null;
  const pct = Math.round((status.completedCount / status.total) * 100);

  return (
    <Link href="/getting-started" className="block bg-[var(--c-surface)] border border-[var(--c-gold)]/40 rounded-[14px] px-4 py-3 mb-5 hover:bg-[var(--c-gold-light)] transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-[var(--c-gold-light)] flex items-center justify-center flex-shrink-0">
          <Sparkles size={17} className="text-[var(--c-gold-deep)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[var(--c-text)]">Finish setting up Ashley IQ</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-1.5 rounded-full bg-[var(--c-fill)] flex-1 max-w-[160px] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--c-gold)' }} /></div>
            <span className="text-[11px] text-[var(--c-label2)] font-mono">{status.completedCount}/{status.total}</span>
          </div>
        </div>
        <ArrowRight size={16} className="text-[var(--c-gold-deep)] flex-shrink-0" />
      </div>
    </Link>
  );
}
