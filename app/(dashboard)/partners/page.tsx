import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/Badge';
import { Plus, Network } from 'lucide-react';
import { format } from 'date-fns';

export const metadata: Metadata = { title: 'Partners' };

const PARTNER_TYPE_LABELS: Record<string, string> = {
  realtor: 'Realtor',
  builder: 'Builder',
  cpa: 'CPA',
  attorney: 'Attorney',
  financial_advisor: 'Financial Advisor',
  other: 'Other',
};

export default async function PartnersPage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect('/sign-in');

  const sb = createClient();
  const { data: org } = await sb
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', orgId)
    .maybeSingle();

  const { data: partners } = await sb
    .from('referral_partners')
    .select('*')
    .eq('org_id', org?.id ?? '')
    .order('total_volume', { ascending: false });

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black tracking-tight">Partners</h1>
          <p className="text-label-2 text-sm mt-0.5">
            {(partners ?? []).length} referral partners · Manage your network
          </p>
        </div>
        <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-sm font-medium bg-blue text-white hover:bg-blue/90 transition-colors shadow-sm">
          <Plus size={14} />
          Add Partner
        </button>
      </div>

      {(partners ?? []).length === 0 ? (
        <div className="bg-surface rounded-card shadow-card border border-border p-10 text-center">
          <Network size={32} className="text-label-3 mx-auto mb-3" />
          <p className="text-sm font-medium text-black mb-1">No partners yet</p>
          <p className="text-xs text-label-2 mb-4">
            Add realtors, builders, and other referral sources to track volume and ROI
          </p>
          <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-sm font-medium bg-blue text-white hover:bg-blue/90 transition-colors">
            <Plus size={14} />
            Add Your First Partner
          </button>
        </div>
      ) : (
        <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-5 py-3">Partner</th>
                <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">Type</th>
                <th className="text-right text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">Referrals</th>
                <th className="text-right text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">Closed</th>
                <th className="text-right text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">Volume</th>
                <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(partners ?? []).map((partner) => (
                <tr key={partner.id} className="hover:bg-fill transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-black">
                      {partner.first_name} {partner.last_name}
                    </p>
                    <p className="text-xs text-label-2">{partner.company_name}</p>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="neutral" size="sm">
                      {PARTNER_TYPE_LABELS[partner.type] ?? partner.type}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-mono tabular-nums text-black">
                    {partner.referral_count}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-mono tabular-nums text-green">
                    {partner.closed_count}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-mono tabular-nums text-black">
                    {partner.total_volume > 0
                      ? `$${(partner.total_volume / 1_000_000).toFixed(1)}M`
                      : '—'}
                  </td>
                  <td className="px-3 py-3 text-xs text-label-2">
                    {format(new Date(partner.created_at), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
