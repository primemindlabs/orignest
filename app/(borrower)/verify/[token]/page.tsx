// Phase 119 — borrower identity verification page (token-gated; /(borrower)(.*) allowlist).
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { BorrowerIdentityVerify } from '@/components/portal/BorrowerIdentityVerify';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Verify Your Identity', robots: 'noindex' };

export default async function VerifyPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const sb = createAdminClient();
  const { data: portal } = await sb.from('borrower_portal_tokens').select('lead_id, org_id, expires_at').eq('token', token).maybeSingle();
  if (!portal) notFound();
  if (portal.expires_at && new Date(portal.expires_at as string) < new Date()) notFound();

  const { data: ver } = await sb
    .from('identity_verifications')
    .select('status')
    .eq('org_id', portal.org_id)
    .eq('lead_id', portal.lead_id)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <p className="font-semibold text-gray-900 text-sm">Identity Verification</p>
          <p className="text-xs text-gray-400">A quick, secure step to protect your loan</p>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 py-6">
        <BorrowerIdentityVerify token={token} alreadyVerified={ver?.status === 'verified'} />
      </div>
    </div>
  );
}
