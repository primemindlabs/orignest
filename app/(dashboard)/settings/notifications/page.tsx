import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert, Zap, Clock, ChevronRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Notifications' };

const ALERTS = [
  {
    icon: ShieldAlert,
    title: 'TRID deadline alerts',
    description:
      'Loan Estimate and Closing Disclosure timing is tracked per loan. Overdue and due-today items surface on the pipeline and in your daily briefing.',
    configHref: '/settings/compliance',
    configLabel: 'Compliance settings',
  },
  {
    icon: Zap,
    title: 'Speed-to-contact alerts',
    description:
      'New leads that have not been contacted within your response window are flagged on the dashboard so they can be routed before they go cold.',
    configHref: '/today',
    configLabel: 'View today',
  },
  {
    icon: Clock,
    title: 'Pipeline SLA / stalled-loan alerts',
    description:
      'Loans that sit in a stage past your SLA threshold appear in the pipeline banner. Tune the warning and critical day counts per stage.',
    configHref: '/settings/compliance',
    configLabel: 'Edit SLA thresholds',
  },
];

export default async function NotificationsSettingsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-[13px] text-label-2 hover:text-black transition-colors"
        >
          <ArrowLeft size={14} />
          Settings
        </Link>
        <h1 className="text-[22px] font-bold text-black tracking-tight mt-2">Notifications</h1>
        <p className="text-label-2 text-sm mt-0.5">
          The alerts AshleyIQ raises across your pipeline and where each is configured.
        </p>
      </div>

      <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden divide-y divide-border">
        {ALERTS.map(({ icon: Icon, title, description, configHref, configLabel }) => (
          <div key={title} className="flex items-start gap-4 px-5 py-4">
            <div className="w-9 h-9 rounded-[10px] bg-fill flex items-center justify-center flex-shrink-0">
              <Icon size={16} className="text-label-2" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-black">{title}</p>
              <p className="text-xs text-label-2 mt-1 leading-relaxed">{description}</p>
              <Link
                href={configHref}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-gold-700 hover:text-gold-600 transition-colors mt-2"
              >
                {configLabel}
                <ChevronRight size={13} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
