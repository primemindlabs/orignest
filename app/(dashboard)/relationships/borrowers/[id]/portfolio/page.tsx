import { getBorrowerRecord } from '@/lib/relationships/getBorrowerRecord';
import { notFound } from 'next/navigation';
import { PortfolioPanel } from '@/components/relationships/PortfolioPanel';

export const dynamic = 'force-dynamic';

export default async function BorrowerPortfolioPage({ params }: { params: { id: string } }) {
  const rec = await getBorrowerRecord(params.id);
  if (!rec) notFound();
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Portfolio</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">The full real-estate picture for this borrower — what you see before a refinance call.</p>
      </div>
      <PortfolioPanel properties={rec.properties} totals={rec.totals} />
    </div>
  );
}
