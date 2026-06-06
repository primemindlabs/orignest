import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PostCloseClient } from './PostCloseClient';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Post-Close Nurture — Orignest' };

// Indicative market rate — in production this comes from the Pricing Engine
const CURRENT_MARKET_RATE = 6.875;

export default async function PostClosePage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect('/sign-in');

  const sb = createClient();

  const [{ data: closedLeads }, { data: sequences }] = await Promise.all([
    sb
      .from('leads')
      .select('id, first_name, last_name, email, loan_amount, loan_type, closing_date, last_contacted_at, created_at')
      .eq('stage', 'closed')
      .order('closing_date', { ascending: false })
      .limit(100),
    sb
      .from('nurture_sequences')
      .select('id, lead_id, sequence_type, scheduled_date, status')
      .order('scheduled_date', { ascending: true })
      .limit(200),
  ]);

  const borrowers = (closedLeads ?? []).map(l => ({
    ...l,
    // In production, original rate would be stored on the lead or loan record
    original_rate: null as number | null,
  }));

  const totalClosed = borrowers.length;
  const scheduled = (sequences ?? []).filter(s => s.status === 'scheduled').length;
  const sent = (sequences ?? []).filter(s => s.status === 'sent').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-xl bg-[#FF2D55]/15 flex items-center justify-center">
            <Heart size={18} className="text-[#FF2D55]" />
          </div>
          <h1 className="text-[22px] font-bold text-[#1C1C1E] tracking-tight">Post-Close Nurture</h1>
        </div>
        <p className="text-[14px] text-[#8A8A8E] ml-11">
          Retain closed borrowers, detect refi opportunities, and generate referrals.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Closed Borrowers', value: String(totalClosed), sub: 'In database' },
          { label: 'Scheduled Touches', value: String(scheduled), sub: 'Upcoming sequences' },
          { label: 'Touches Sent', value: String(sent), sub: 'Lifetime' },
          { label: 'Market Rate', value: `${CURRENT_MARKET_RATE}%`, sub: 'Indicative 30-yr' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-black/[0.06] shadow-sm rounded-2xl px-4 py-3.5">
            <p className="text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wide mb-1">{stat.label}</p>
            <p className="text-[22px] font-bold text-[#1C1C1E] leading-none">{stat.value}</p>
            <p className="text-[11px] text-[#C7C7CC] mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-6">
        <PostCloseClient
          borrowers={borrowers}
          sequences={sequences ?? []}
          currentMarketRate={CURRENT_MARKET_RATE}
        />
      </div>

      <p className="text-[11px] text-[#C7C7CC] text-center pb-2">
        All outreach requires valid TCPA consent and borrower opt-in. Rate estimates are indicative only. Not a commitment to lend.
      </p>
    </div>
  );
}
