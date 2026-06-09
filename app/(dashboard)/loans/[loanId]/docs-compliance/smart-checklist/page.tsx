import { getOrgContext } from '@/lib/auth/orgContext';
import { getLoanSummary } from '@/lib/loans/getLoanSummary';
import { redirect, notFound } from 'next/navigation';
import { generateChecklist, type ChecklistItem } from '@/lib/ai/smartChecklist';
import { SmartChecklist } from './SmartChecklist';

export const dynamic = 'force-dynamic';

export default async function SmartChecklistPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const loan = await getLoanSummary(params.loanId);
  if (!loan) notFound();

  let items: ChecklistItem[] = [];
  try {
    const r = await generateChecklist(loan.id, loan.context);
    items = r.items;
  } catch {
    items = [];
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Smart Document Checklist</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Only what this specific loan needs — prioritized, with a note on why each item is required.
        </p>
      </div>
      <SmartChecklist loanId={params.loanId} initial={items} />
    </div>
  );
}
