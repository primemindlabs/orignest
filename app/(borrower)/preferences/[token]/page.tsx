// Phase 116 — borrower communication-preferences page (token-gated, no login; covered
// by the /(borrower)(.*) middleware allowlist).
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { BorrowerPreferences } from '@/components/portal/BorrowerPreferences';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Communication Preferences', robots: 'noindex' };

export default async function BorrowerPreferencesPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const sb = createAdminClient();
  const { data: portal } = await sb.from('borrower_portal_tokens').select('id, expires_at').eq('token', token).maybeSingle();
  if (!portal) notFound();
  if (portal.expires_at && new Date(portal.expires_at as string) < new Date()) notFound();

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <p className="font-semibold text-gray-900 text-sm">Communication Preferences</p>
          <p className="text-xs text-gray-400">Choose how and when we contact you</p>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 py-6">
        <BorrowerPreferences token={token} />
      </div>
    </div>
  );
}
