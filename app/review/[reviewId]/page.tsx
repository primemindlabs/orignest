import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your Homeownership Review', robots: { index: false, follow: false } };

const money = (n: number | null) => (n == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n)));

export default async function ReviewPage({ params }: { params: { reviewId: string } }) {
  const sb = createAdminClient();
  const { data: review } = await sb
    .from('annual_reviews')
    .select('id, org_id, relationship_id, review_year, original_purchase_price, current_avm, value_increase, original_balance, current_balance, principal_paid, total_equity, ai_narrative')
    .eq('id', params.reviewId)
    .maybeSingle();
  if (!review) notFound();

  const [{ data: rel }, { data: org }] = await Promise.all([
    sb.from('borrower_relationships').select('full_name').eq('id', review.relationship_id).maybeSingle(),
    sb.from('organizations').select('name').eq('id', review.org_id).maybeSingle(),
  ]);

  // Log the open (INSERT-only retention event).
  await sb.from('retention_events').insert({ relationship_id: review.relationship_id, org_id: review.org_id, event_type: 'annual_review_opened' });

  const principalPct = review.original_balance && review.principal_paid ? Math.min(100, Math.round((Number(review.principal_paid) / Number(review.original_balance)) * 100)) : 0;
  const firstName = (rel?.full_name ?? 'there').split(' ')[0];

  return (
    <div className="min-h-screen bg-[#F2F2F7] py-10 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-[16px] shadow-[0_20px_60px_rgba(0,0,0,0.12)] overflow-hidden">
        <div className="h-1.5 bg-[var(--c-gold)]" />
        <div className="bg-[var(--c-text)] px-8 py-6">
          <p className="text-[12px] uppercase tracking-widest text-[var(--c-gold)] font-semibold">Homeownership Anniversary</p>
          <h1 className="text-[24px] font-bold text-white mt-1">Congratulations, {firstName}</h1>
          <p className="text-[13px] text-white/70 mt-1">Your {review.review_year} wealth review · {org?.name ?? ''}</p>
        </div>

        <div className="px-8 py-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)] font-semibold mb-2">When you bought</p>
              <Row label="Purchase price" value={money(review.original_purchase_price)} />
              <Row label="Loan balance" value={money(review.original_balance)} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)] font-semibold mb-2">Today</p>
              <Row label="Estimated value" value={money(review.current_avm)} />
              <Row label="Loan balance" value={money(review.current_balance)} />
            </div>
          </div>

          <div className="text-center py-4 border-y border-[var(--c-border)]">
            <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)] font-semibold">Equity you&apos;ve built</p>
            <p className="text-[40px] font-bold font-mono tabular-nums text-[var(--c-gold-deep)] leading-tight">{money(review.total_equity)}</p>
          </div>

          {principalPct > 0 && (
            <div>
              <p className="text-[12px] text-[var(--c-label2)] mb-1.5">You&apos;ve paid down {principalPct}% of your original loan.</p>
              <div className="h-3 w-full rounded-full bg-[var(--c-fill)] overflow-hidden">
                <div className="h-full bg-[var(--c-text)]" style={{ width: `${principalPct}%` }} />
              </div>
            </div>
          )}

          {review.ai_narrative && (
            <div className="text-[14px] leading-relaxed text-[var(--c-text)] whitespace-pre-line">{review.ai_narrative}</div>
          )}
        </div>
        <div className="px-8 py-4 bg-[var(--c-surface2)] border-t border-[var(--c-border)] text-[12px] text-[var(--c-label2)]">
          If you have questions or want to explore your options, I&apos;m always a call away.
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[13px] py-0.5">
      <span className="text-[var(--c-label2)]">{label}</span>
      <span className="font-mono tabular-nums text-[var(--c-text)]">{value}</span>
    </div>
  );
}
