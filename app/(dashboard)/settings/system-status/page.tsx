// System Status — one place to see which integrations are LIVE vs not configured, so
// the team always knows whether automations and sends actually fire (kills the silent
// "looks live but no-ops" gap). Admin-only. Pure server-side env detection.
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { IconCircleCheckFilled, IconAlertTriangleFilled, IconInfoCircleFilled } from '@tabler/icons-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'System Status' };

type State = 'live' | 'off' | 'record';
interface Row { name: string; state: State; unlocks: string; enable: string }

function pill(state: State) {
  if (state === 'live') return { label: 'Live', cls: 'bg-[#3FB68B]/12 text-[#2e8c6a]', icon: <IconCircleCheckFilled size={13} /> };
  if (state === 'record') return { label: 'Record-only', cls: 'bg-blue-50 text-blue-600', icon: <IconInfoCircleFilled size={13} /> };
  return { label: 'Not configured', cls: 'bg-amber-50 text-amber-600', icon: <IconAlertTriangleFilled size={13} /> };
}

export default async function SystemStatusPage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  if (!['admin', 'branch_manager'].includes(role)) redirect('/settings');

  const has = (k: string) => !!process.env[k] && process.env[k] !== '';
  const flag = (k: string) => process.env[k] === 'true';

  const twilio = has('TWILIO_ACCOUNT_SID') && has('TWILIO_AUTH_TOKEN') && has('TWILIO_PHONE_NUMBER');
  const resend = has('RESEND_API_KEY');
  const canSpamReady = has('COMPANY_PHYSICAL_ADDRESS');

  const core: Row[] = [
    { name: 'AI — Ashley', state: has('ANTHROPIC_API_KEY') ? 'live' : 'off', unlocks: 'Ask Ashley, AI proposals, message drafting, financial concierge', enable: 'Set ANTHROPIC_API_KEY' },
    { name: 'Email (Resend)', state: resend ? (canSpamReady ? 'live' : 'record') : 'off', unlocks: 'Portal updates, proposals, annual reviews, partner emails', enable: resend && !canSpamReady ? 'Set COMPANY_PHYSICAL_ADDRESS (CAN-SPAM) — sends are blocked without it' : 'Set RESEND_API_KEY' },
    { name: 'SMS (Twilio)', state: twilio ? 'live' : 'off', unlocks: 'Milestone texts, portal link by SMS, power dialer', enable: 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER' },
    { name: 'Scheduled automations (Cron)', state: has('CRON_SECRET') ? 'live' : 'off', unlocks: 'Heat scores, annual reviews, post-close outreach, campaign steps, ROI/funnel', enable: 'Set CRON_SECRET (+ deploy vercel.json crons)' },
  ];

  const sendModes: Row[] = [
    { name: 'Campaign live send', state: flag('CAMPAIGNS_LIVE_SEND') ? 'live' : 'record', unlocks: 'Campaigns actually deliver email/SMS (otherwise recorded only)', enable: 'Set CAMPAIGNS_LIVE_SEND=true' },
    { name: 'Portal link SMS', state: flag('PORTAL_LINK_LIVE') ? 'live' : 'record', unlocks: 'Borrower portal links text to the borrower (otherwise copy-only)', enable: 'Set PORTAL_LINK_LIVE=true' },
  ];

  const enrichment: Row[] = [
    { name: 'Property data (ATTOM)', state: has('ATTOM_API_KEY') ? 'live' : 'off', unlocks: 'Live home values in Wealth dashboard, realtor market discovery', enable: 'Set ATTOM_API_KEY' },
    { name: 'Bank verification (Plaid)', state: has('PLAID_CLIENT_ID') ? 'live' : 'off', unlocks: 'Borrower asset/account verification', enable: 'Set PLAID_CLIENT_ID + PLAID_SECRET' },
    { name: 'Billing (Stripe)', state: has('STRIPE_SECRET_KEY') ? 'live' : 'off', unlocks: 'Subscriptions, plan gating, credit-repair checkout', enable: 'Set STRIPE_SECRET_KEY' },
  ];

  const Section = ({ title, rows, note }: { title: string; rows: Row[]; note?: string }) => (
    <div>
      <h2 className="text-[15px] font-bold text-[var(--c-text)] tracking-tight">{title}</h2>
      {note && <p className="text-[12px] text-[var(--c-label2)] mt-0.5 mb-2">{note}</p>}
      <div className="mt-2 rounded-card border border-[var(--c-border)] divide-y divide-[var(--c-border)] overflow-hidden bg-[var(--c-surface)]">
        {rows.map((r) => {
          const p = pill(r.state);
          return (
            <div key={r.name} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-[var(--c-text)]">{r.name}</p>
                <p className="text-[12px] text-[var(--c-label2)] mt-0.5">{r.unlocks}</p>
                {r.state !== 'live' && <p className="text-[11.5px] text-[var(--c-label3)] mt-1 font-mono">{r.enable}</p>}
              </div>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${p.cls}`}>{p.icon} {p.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const liveCount = [...core, ...enrichment].filter((r) => r.state === 'live').length;
  const total = core.length + enrichment.length;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3"><ArrowLeft size={14} /> Settings</Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">System Status</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          What&rsquo;s live right now. Anything marked <span className="font-medium text-amber-600">Not configured</span> or <span className="font-medium text-blue-600">Record-only</span> looks active in the app but won&rsquo;t actually send or fetch until enabled. <span className="font-medium text-[var(--c-text)]">{liveCount}/{total}</span> core integrations live.
        </p>
      </div>

      <Section title="Core" rows={core} note="The engines behind the product's daily promises." />
      <Section title="Send modes" rows={sendModes} note="Safety flags — keep record-only in staging, flip live in production." />
      <Section title="Enrichment" rows={enrichment} note="Optional data sources that deepen specific features." />

      <p className="text-[12px] text-[var(--c-label2)]">
        Your LOS connection is configured per organization in <Link href="/settings/integrations" className="text-[var(--c-gold-deep)] font-medium">Integrations</Link>.
      </p>
    </div>
  );
}
