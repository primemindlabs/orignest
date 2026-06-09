import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ad Attribution' };

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default async function AttributionPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const [{ data: attr }, { data: stats }] = await Promise.all([
    sb.from('lead_ad_attribution').select('campaign_id, utm_campaign, utm_source, platform, funded_loan_amount_cents, lead_id').eq('org_id', orgId),
    sb.from('ad_campaign_stats').select('campaign_id, campaign_name, spend_cents, leads_count').eq('org_id', orgId),
  ]);

  // Aggregate per campaign key (campaign_id || utm_campaign || source).
  type Row = { key: string; label: string; leads: number; funded_cents: number; spend_cents: number };
  const byKey = new Map<string, Row>();
  for (const a of attr ?? []) {
    const key = a.campaign_id || a.utm_campaign || a.utm_source || 'unattributed';
    const r = byKey.get(key) ?? { key, label: a.utm_campaign || a.campaign_id || a.utm_source || 'Unattributed', leads: 0, funded_cents: 0, spend_cents: 0 };
    r.leads += 1;
    r.funded_cents += Number(a.funded_loan_amount_cents ?? 0);
    byKey.set(key, r);
  }
  for (const s of stats ?? []) {
    const r = byKey.get(s.campaign_id) ?? { key: s.campaign_id, label: s.campaign_name, leads: 0, funded_cents: 0, spend_cents: 0 };
    r.spend_cents += Number(s.spend_cents ?? 0);
    if (s.campaign_name) r.label = s.campaign_name;
    byKey.set(s.campaign_id, r);
  }
  const rows = Array.from(byKey.values()).sort((a, b) => b.leads - a.leads);

  const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
  const totalSpend = rows.reduce((s, r) => s + r.spend_cents, 0);

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/ads" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3">
          <ArrowLeft size={14} /> Ad Center
        </Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Ad Attribution</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Which campaigns produce leads — and which leads fund. Spend data syncs once a Meta/Google account is connected.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Attributed leads" value={String(totalLeads)} />
        <Stat label="Tracked spend" value={dollars(totalSpend)} />
        <Stat label="Campaigns" value={String(rows.length)} />
      </div>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--c-border)] flex items-center gap-2">
          <TrendingUp size={15} className="text-[var(--c-gold-deep)]" />
          <p className="text-[13px] font-semibold text-[var(--c-text)]">By campaign</p>
        </div>
        {rows.length === 0 ? (
          <p className="text-[13px] text-[var(--c-label2)] p-6 text-center">No attributed leads yet. Tag your landing-page URLs with <code className="font-mono">utm_source</code>/<code className="font-mono">utm_campaign</code> to attribute leads here.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-[var(--c-label2)] border-b border-[var(--c-border)]">
                <th className="text-left font-semibold px-4 py-2">Campaign</th>
                <th className="text-right font-semibold px-4 py-2">Leads</th>
                <th className="text-right font-semibold px-4 py-2">Cost/Lead</th>
                <th className="text-right font-semibold px-4 py-2">Funded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-[var(--c-border)] last:border-0">
                  <td className="px-4 py-2.5 text-[var(--c-text)] truncate max-w-[200px]">{r.label}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[var(--c-text)]">{r.leads}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[var(--c-label2)]">{r.spend_cents > 0 && r.leads > 0 ? dollars(Math.round(r.spend_cents / r.leads)) : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[var(--c-gold-deep)]">{r.funded_cents > 0 ? dollars(r.funded_cents) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] px-4 py-3.5">
      <p className="text-[11px] font-semibold text-[var(--c-label2)] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-[20px] font-bold text-[var(--c-text)] font-mono tabular-nums leading-none">{value}</p>
    </div>
  );
}
