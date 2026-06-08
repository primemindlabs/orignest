import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/Badge';
import { Plus, Mail, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Campaigns' };

export default async function CampaignsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: campaigns } = await sb
    .from('campaigns')
    .select('*')
    .eq('org_id', (
      await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle()
        .then(({ data }) => data?.id ?? '')
    ))
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black tracking-tight">Campaigns</h1>
          <p className="text-label-2 text-sm mt-0.5">Automate your lead follow-up sequences</p>
        </div>
        <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-sm font-medium bg-blue text-white hover:bg-blue/90 transition-colors shadow-sm">
          <Plus size={14} />
          New Campaign
        </button>
      </div>

      {(campaigns ?? []).length === 0 ? (
        <div className="bg-surface rounded-card shadow-card border border-border p-10 text-center">
          <Mail size={32} className="text-label-3 mx-auto mb-3" />
          <p className="text-sm font-medium text-black mb-1">No campaigns yet</p>
          <p className="text-xs text-label-2 mb-4">
            Create drip sequences to automatically follow up with leads
          </p>
          <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-sm font-medium bg-blue text-white hover:bg-blue/90 transition-colors">
            <Plus size={14} />
            Create Your First Campaign
          </button>
        </div>
      ) : (
        <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {(campaigns ?? []).map((campaign) => (
              <div key={campaign.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-[10px] bg-fill flex items-center justify-center">
                  {campaign.type === 'drip' ? (
                    <Mail size={16} className="text-label-2" />
                  ) : (
                    <MessageSquare size={16} className="text-label-2" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-black">{campaign.name}</p>
                  <p className="text-xs text-label-2">
                    {campaign.total_steps} steps · {campaign.enrolled_count} enrolled
                  </p>
                </div>
                <Badge
                  variant={
                    campaign.status === 'active'
                      ? 'success'
                      : campaign.status === 'paused'
                      ? 'warning'
                      : 'neutral'
                  }
                  size="sm"
                >
                  {campaign.status}
                </Badge>
                <span className="text-[11px] text-label-3">
                  {format(new Date(campaign.created_at), 'MMM d')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}