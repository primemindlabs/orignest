// Phase 120 — AE Deal Desk hub: pipeline of scenario pricing requests to lender AEs.
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { DealDeskBoard } from '@/components/dealDesk/DealDeskBoard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'AE Deal Desk' };

export default async function DealDeskPage({ searchParams }: { searchParams: { lead?: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const [{ data: requests }, { data: aes }, { data: leads }] = await Promise.all([
    sb.from('ae_deal_desk_requests').select('*, lead:leads(id, first_name, last_name)').eq('org_id', orgId).order('updated_at', { ascending: false }),
    sb.from('lender_ae_connections').select('id, lender_name, ae_name, ae_email').eq('org_id', orgId).eq('is_active', true).order('preferred', { ascending: false }),
    sb.from('leads').select('id, first_name, last_name, loan_amount').eq('org_id', orgId).order('created_at', { ascending: false }).limit(200),
  ]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">AE Deal Desk</h1>
        <p className="text-sm text-gray-400">Request scenario pricing from your lender account executives and track responses.</p>
      </div>
      <DealDeskBoard
        initialRequests={requests ?? []}
        aes={(aes ?? []) as { id: string; lender_name: string | null; ae_name: string | null; ae_email: string | null }[]}
        leads={(leads ?? []) as { id: string; first_name: string | null; last_name: string | null; loan_amount: number | null }[]}
        presetLeadId={searchParams.lead ?? null}
      />
    </div>
  );
}
