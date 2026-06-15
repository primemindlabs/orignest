import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import type { Application } from '@/types/apply';
import { DeclarationsView } from './DeclarationsView';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  // Most recent application for this loan (table/columns may be absent in older DBs — stay defensive).
  let application: Partial<Application> | null = null;
  try {
    const { data } = await sb
      .from('applications')
      .select(
        'id, status, submitted_at, created_at, declaration_bankruptcy, declaration_foreclosure, declaration_lawsuit, declaration_delinquent, declaration_alimony, declaration_borrowed_down, declaration_us_citizen, declaration_primary_res',
      )
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    application = (data as Partial<Application>) ?? null;
  } catch {
    application = null;
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Declarations (1003)</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          URLA declarations answered by the borrower on the digital application.
        </p>
      </div>

      {application ? (
        <DeclarationsView application={application} loanId={params.loanId} />
      ) : (
        <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] p-8 text-center">
          <p className="text-[14px] font-medium text-[var(--c-text)]">No application on file yet</p>
          <p className="text-[13px] text-[var(--c-label2)] mt-1">
            Declarations appear here once the borrower starts the digital 1003.
          </p>
          <Link
            href={`/loans/${params.loanId}/apply-1003`}
            className="inline-flex items-center justify-center mt-4 rounded-md bg-[var(--c-gold-deep)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition"
          >
            Start the 1003 application →
          </Link>
        </div>
      )}
    </div>
  );
}
