import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { DSCRAnalyzer } from '@/components/tools/DSCRAnalyzer';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'DSCR Investment Analyzer' };

// Distinct from the residential /dscr + /dscr-calculator tools: this analyzer adds
// 5–9 unit small-commercial support (unit-count thresholds + capex), saved analyses,
// and DSCR lender comparison.
export default async function DSCRAnalyzerPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-5xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">DSCR Investment Analyzer</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Residential (1–4 unit) and small-commercial (5–9 unit) DSCR with full NOI breakdown and lender fit.
        </p>
      </div>
      <DSCRAnalyzer />
    </div>
  );
}
