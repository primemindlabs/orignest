import { createAdminClient } from '@/lib/supabase/admin';
import { PLANS } from '@/lib/stripe/plans';

export const dynamic = 'force-dynamic';

const PAID = ['starter', 'growth', 'team'];

export default async function PlatformAdminDashboard() {
  const sb = createAdminClient();
  const [{ count: totalTenants }, { data: paidOrgs }, { count: trials }, { count: churned }, { data: recent }] = await Promise.all([
    sb.from('organizations').select('id', { count: 'exact', head: true }),
    sb.from('organizations').select('subscription_plan').in('subscription_plan', PAID).eq('subscription_status', 'active'),
    sb.from('organizations').select('id', { count: 'exact', head: true }).eq('subscription_status', 'trialing'),
    sb.from('organizations').select('id', { count: 'exact', head: true }).in('subscription_status', ['canceled', 'cancelled']),
    sb.from('organizations').select('id, name, subscription_plan, subscription_status, created_at').order('created_at', { ascending: false }).limit(8),
  ]);

  const mrr = (paidOrgs ?? []).reduce((s, o) => s + (PLANS[(o.subscription_plan ?? '') as keyof typeof PLANS]?.price ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-[20px] font-bold text-[#0F1D2E]">Overview</h1>
      <div className="grid grid-cols-4 gap-4">
        {[
          ['MRR', `$${mrr.toLocaleString()}`, false],
          ['Active subs', String((paidOrgs ?? []).length), false],
          ['Trials', String(trials ?? 0), false],
          ['Churned', String(churned ?? 0), true],
        ].map(([label, val, danger]) => (
          <div key={String(label)} className="bg-white border border-black/[0.06] rounded-2xl px-4 py-3.5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8A8E] mb-1">{label}</p>
            <p className={`text-[22px] font-bold leading-none ${danger ? 'text-red-500' : 'text-[#0F1D2E]'}`}>{val}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-black/[0.06] rounded-2xl overflow-hidden shadow-sm">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8A8A8E] px-4 py-3 border-b border-black/[0.06]">Total tenants: {totalTenants ?? 0} · Recent signups</p>
        <table className="w-full text-[13px]">
          <thead><tr className="text-[10px] uppercase text-[#8A8A8E] border-b border-black/[0.06]"><th className="text-left px-4 py-2">Company</th><th className="text-left px-4 py-2">Plan</th><th className="text-left px-4 py-2">Status</th><th className="text-left px-4 py-2">Joined</th></tr></thead>
          <tbody>
            {(recent ?? []).map((o) => (
              <tr key={o.id} className="border-b border-black/[0.04] last:border-0">
                <td className="px-4 py-2.5 text-[#1C1C1E]">{o.name}</td>
                <td className="px-4 py-2.5 text-[#8A8A8E]">{o.subscription_plan ?? '—'}</td>
                <td className="px-4 py-2.5 text-[#8A8A8E]">{o.subscription_status ?? '—'}</td>
                <td className="px-4 py-2.5 text-[#8A8A8E]">{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
