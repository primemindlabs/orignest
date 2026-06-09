import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { DscrCalculatorClient } from './DscrCalculatorClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'DSCR Calculator' };

export default async function DscrCalculatorPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">DSCR Calculator</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Qualify an investment property on its rental income. DSCR = net operating income ÷ annual debt service. Most lenders want ≥ 1.0; ≥ 1.25 is strong.
        </p>
      </div>
      <DscrCalculatorClient />
    </div>
  );
}
