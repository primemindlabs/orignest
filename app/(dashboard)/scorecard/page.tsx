import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { buildLOScorecard } from '@/lib/lo/scorecard';
import { channelConfig } from '@/lib/tenant/channelConfig';
import { LicenseManager } from './LicenseManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My Scorecard' };

const fmtM = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`);
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function ScorecardPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const [{ data: profile }, { data: org }] = await Promise.all([
    sb.from('profiles').select('id, first_name, last_name').eq('clerk_user_id', userId).maybeSingle(),
    sb.from('organizations').select('channel').eq('id', orgId).maybeSingle(),
  ]);
  const ytd = new Date(new Date().getFullYear(), 0, 1).toISOString();
  const [card, { data: licenses }] = await Promise.all([
    profile ? buildLOScorecard(orgId, profile.id, ytd) : Promise.resolve(null),
    profile ? sb.from('lo_licenses').select('id, state, nmls_id, status, expiry_date').eq('org_id', orgId).eq('user_id', profile.id).order('expiry_date') : Promise.resolve({ data: [] }),
  ]);

  const cfg = channelConfig(org?.channel);
  const maxFunnel = card ? Math.max(1, card.funnel.apps) : 1;
  const FUNNEL = card ? [['Apps', card.funnel.apps], ['Submitted', card.funnel.submitted], ['Clear to Close', card.funnel.ctc], ['Closed', card.funnel.closed]] as const : [];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">My Scorecard</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Year-to-date production · {cfg.label}</p>
      </div>

      {card && (
        <>
          <div className="grid grid-cols-4 gap-3">
            {[['Volume funded', fmtM(card.volume_funded)], ['Pull-through', pct(card.pull_through_rate)], ['Avg cycle', card.avg_app_to_close_days != null ? `${card.avg_app_to_close_days}d` : '—'], ['Loans closed', String(card.loans_closed)]].map(([l, v]) => (
              <div key={String(l)} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] px-4 py-3.5"><p className="text-[10px] uppercase tracking-wide text-[var(--c-label2)] mb-1">{l}</p><p className="text-[19px] font-bold font-mono tabular-nums text-[var(--c-text)]">{v}</p></div>
            ))}
          </div>

          <div>
            <h2 className="text-[14px] font-semibold text-[var(--c-text)] mb-2">Deal funnel</h2>
            <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-2">
              {FUNNEL.map(([label, n]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-[12px] text-[var(--c-label2)] w-24">{label}</span>
                  <div className="h-5 rounded-md bg-[var(--c-fill)] flex-1 overflow-hidden"><div className="h-full rounded-md" style={{ width: `${(Number(n) / maxFunnel) * 100}%`, background: 'var(--c-gold)' }} /></div>
                  <span className="text-[12px] font-mono tabular-nums text-[var(--c-text)] w-8 text-right">{n}</span>
                </div>
              ))}
              <p className="text-[11px] text-[var(--c-label2)] pt-1">CTC rate {pct(card.ctc_rate)} · active pipeline {card.pipeline_active} ({fmtM(card.pipeline_value)})</p>
            </div>
          </div>

          {Object.keys(card.deal_types).length > 0 && (
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--c-text)] mb-2">Closed loan mix</h2>
              <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 flex flex-wrap gap-2">
                {Object.entries(card.deal_types).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                  <span key={t} className="text-[12px] px-2.5 py-1 rounded-full bg-[var(--c-fill)] text-[var(--c-text)]">{t} · {n}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <LicenseManager initial={(licenses ?? []) as never} />
    </div>
  );
}
