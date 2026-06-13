// Phase 119 — LO identity verification panel for a loan.
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { IdentityVerifyAdmin } from '@/components/loan/IdentityVerifyAdmin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Identity Verification' };

export default async function IdentityPage({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id').eq('id', loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) redirect('/pipeline');

  const { data: ver } = await sb.from('identity_verifications').select('status').eq('org_id', orgId).eq('lead_id', loanId).maybeSingle();

  // Resolve (or mint) the borrower portal token for the verify link.
  let token: string | null = null;
  const { data: tok } = await sb.from('borrower_portal_tokens').select('token').eq('org_id', orgId).eq('lead_id', loanId).maybeSingle();
  token = (tok?.token as string | null) ?? null;
  if (!token) {
    const { data: minted } = await sb.from('borrower_portal_tokens').insert({ org_id: orgId, lead_id: loanId }).select('token').maybeSingle();
    token = (minted?.token as string | null) ?? null;
  }
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `https://${h.get('host') ?? 'app.ashleyiq.com'}`;
  const verifyUrl = token ? `${origin}/verify/${token}` : '';

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Identity Verification</h1>
      <IdentityVerifyAdmin loanId={loanId} verifyUrl={verifyUrl} initialStatus={ver?.status ?? 'pending'} />
    </div>
  );
}
