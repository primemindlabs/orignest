import { createAdminClient } from '@/lib/supabase/admin';
import { PLANS } from '@/lib/stripe/plans';

export const dynamic = 'force-dynamic';

export default async function PlatformTenantsPage() {
  const sb = createAdminClient();
  const { data: orgs } = await sb
    .from('organizations')
    .select('id, name, subscription_plan, subscription_status, trial_ends_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  // Lead counts per org.
  const ids = (orgs ?? []).map((o) => o.id);
  const { data: leadRows } = ids.length ? await sb.from('leads').select('org_id').in('org_id', ids) : { data: [] };
  const leadCount = new Map<string, number>();
  for (const l of leadRows ?? []) leadCount.set(l.org_id, (leadCount.get(l.org_id) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <h1 className="text-[20px] font-bold text-[#0F1D2E]">Tenants ({orgs?.length ?? 0})</h1>
      <div className="bg-white border border-black/[0.06] rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-[13px]">
          <thead><tr className="text-[10px] uppercase text-[#8A8A8E] border-b border-black/[0.06]">
            <th className="text-left px-4 py-2">Company</th><th className="text-left px-4 py-2">Plan</th>
            <th className="text-right px-4 py-2">MRR</th><th className="text-right px-4 py-2">Leads</th>
            <th className="text-left px-4 py-2">Status</th><th className="text-left px-4 py-2">Joined</th>
          </tr></thead>
          <tbody>
            {(orgs ?? []).map((o) => {
              const mrr = PLANS[(o.subscription_plan ?? '') as keyof typeof PLANS]?.price ?? 0;
              const paid = o.subscription_status === 'active';
              return (
                <tr key={o.id} className="border-b border-black/[0.04] last:border-0">
                  <td className="px-4 py-2.5 text-[#1C1C1E]">{o.name}</td>
                  <td className="px-4 py-2.5 text-[#8A8A8E]">{o.subscription_plan ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[#1C1C1E]">{paid && mrr ? `$${mrr}` : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[#8A8A8E]">{leadCount.get(o.id) ?? 0}</td>
                  <td className="px-4 py-2.5 text-[#8A8A8E]">{o.subscription_status ?? '—'}</td>
                  <td className="px-4 py-2.5 text-[#8A8A8E]">{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
