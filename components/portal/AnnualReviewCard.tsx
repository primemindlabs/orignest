'use client';

// Phase 123 — Annual Mortgage Review preview. The full review fires via pg_cron on the
// closing anniversary; this card sets the expectation in-portal.
import { IconCalendarStats } from '@tabler/icons-react';

export function AnnualReviewCard({ closingDate }: { closingDate: string | null }) {
  const next = closingDate ? new Date(closingDate) : null;
  if (next) {
    const now = new Date();
    next.setFullYear(now.getFullYear());
    if (next < now) next.setFullYear(now.getFullYear() + 1);
  }
  return (
    <div className="bg-white rounded-2xl border border-[#EDEAE4] p-5 flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-[#FBF5E6] flex items-center justify-center flex-shrink-0"><IconCalendarStats size={17} className="text-[#C9A95C]" /></div>
      <div>
        <p className="text-[13px] font-medium text-[#1A1816]">Annual Mortgage Review</p>
        <p className="text-[12px] text-[#6B6560] mt-0.5 leading-relaxed">
          Every year on your closing anniversary, Ashley prepares a personalized review — equity gained, your home’s value, and whether refinancing could save you money.
        </p>
        {next && <p className="text-[11px] text-[#9B9590] mt-1.5">Next review: {next.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>}
      </div>
    </div>
  );
}
