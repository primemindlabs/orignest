import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { isTextractConfigured } from '@/lib/ai/textract';
import { DocExtractionPanel, type ExtractionRow } from './DocExtractionPanel';

export const dynamic = 'force-dynamic';

export default async function AutoExtractPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();

  const { data: extractions } = await sb
    .from('document_extractions')
    .select('id, document_type, extracted_fields, confidence, discrepancies, lo_confirmed, fields_applied, created_at')
    .eq('lead_id', params.loanId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Document Auto-Population</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          AI reads pay stubs, W-2s, and bank statements and pre-fills the 1003 — you confirm before anything is written.
        </p>
      </div>
      <DocExtractionPanel
        loanId={params.loanId}
        initial={(extractions ?? []) as ExtractionRow[]}
        textractConfigured={isTextractConfigured()}
      />
    </div>
  );
}
