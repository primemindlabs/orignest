// Phase 121 — PUBLIC partner referral landing. No auth: referral_code is the credential.
// Allowlisted via /refer/(.*). Shows the LO's intro and a simple lead-capture form.
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { ReferralForm } from '@/components/referral-partners/ReferralForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Refer a client', robots: 'noindex' };

export default async function ReferralPage({ params }: { params: { code: string } }) {
  const sb = createAdminClient();
  const { data: partner } = await sb
    .from('referral_partners')
    .select('id, org_id, added_by, first_name, last_name, company_name')
    .eq('referral_code', params.code)
    .eq('active', true)
    .maybeSingle();
  if (!partner) notFound();

  const { data: lo } = await sb
    .from('profiles')
    .select('first_name, last_name, nmls_id, avatar_url, title')
    .eq('id', partner.added_by as string)
    .maybeSingle();

  const loName = lo ? [lo.first_name, lo.last_name].filter(Boolean).join(' ') || 'Your loan officer' : 'Your loan officer';
  const initials = loName.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center mb-5">
          {lo?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lo.avatar_url as string} alt={loName} className="w-16 h-16 rounded-full object-cover mx-auto mb-3" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#C9A95C]/15 text-[#C9A95C] flex items-center justify-center text-lg font-semibold mx-auto mb-3">{initials}</div>
          )}
          <p className="font-semibold text-gray-900">{loName}</p>
          {lo?.title && <p className="text-xs text-gray-400">{lo.title as string}</p>}
          <p className="text-sm text-gray-500 mt-3 leading-relaxed">
            {partner.first_name} {partner.last_name} trusts me with their clients&apos; financing.
            Share your client&apos;s details below and I&apos;ll reach out personally to help them get started.
          </p>
        </div>

        <ReferralForm code={params.code} loName={loName} />

        <p className="text-[11px] text-gray-400 text-center mt-5 leading-relaxed">
          {lo?.nmls_id ? `${loName}, NMLS# ${lo.nmls_id}. ` : ''}This is not a loan application or a commitment to lend.
          Equal Housing Lender. Submitting this form authorizes {loName} to contact your referred client.
        </p>
      </div>
    </div>
  );
}
