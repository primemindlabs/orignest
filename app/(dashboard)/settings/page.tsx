import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { CreditCard, Users, Building2, Shield, Bell, ChevronRight, Sparkles, Plug, UserCircle, Percent, Lock } from 'lucide-react';
import { CreditRepairSettingsCard } from './CreditRepairSettingsCard';
import { ensureApplicationSlug } from '@/lib/auth/slug';
import { ApplicationLink } from '@/components/settings/ApplicationLink';
import { GateReadinessCard } from '@/components/settings/GateReadinessCard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Settings' };

const SETTINGS_SECTIONS = [
  {
    href: '/settings/profile',
    icon: UserCircle,
    label: 'Profile',
    description: 'Your name, NMLS #, photo, volume goal, and commission rate',
  },
  {
    href: '/settings/compensation',
    icon: Percent,
    label: 'Compensation',
    description: 'Commission rate for dashboard math and your company comp plans',
  },
  {
    href: '/settings/billing',
    icon: CreditCard,
    label: 'Billing',
    description: 'Manage your subscription, seats, and payment method',
  },
  {
    href: '/settings/team',
    icon: Users,
    label: 'Team',
    description: 'Invite loan officers, manage roles and seats',
  },
  {
    href: '/settings/organization',
    icon: Building2,
    label: 'Organization',
    description: 'Company name, NMLS ID, licensed states',
  },
  {
    href: '/settings/compliance',
    icon: Shield,
    label: 'Compliance',
    description: 'TRID settings, TCPA templates, audit log retention',
  },
  {
    href: '/settings/notifications',
    icon: Bell,
    label: 'Notifications',
    description: 'TRID alerts, speed-to-contact alerts, team updates',
  },
  {
    href: '/settings/ai-intelligence',
    icon: Sparkles,
    label: 'AI Intelligence',
    description: 'Underwriting pattern model status and learning history',
  },
  {
    href: '/settings/integrations',
    icon: Plug,
    label: 'Integrations',
    description: 'Connect your LOS (LendingPad, Arive) for loan status sync',
  },
  {
    href: '/settings/privacy',
    icon: Lock,
    label: 'Privacy & Data',
    description: 'Download your data, opt out of analytics, or request account deletion',
  },
] as const;

export default async function SettingsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: profile } = await sb
    .from('profiles')
    .select('id, first_name, last_name, email, role, nmls_id, application_slug, avatar_url')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  // Phase 90 — lazily mint the LO's shareable application slug on first settings view.
  const applicationSlug = profile
    ? await ensureApplicationSlug(sb, {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        nmls_id: profile.nmls_id,
        application_slug: profile.application_slug,
      })
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-black tracking-tight">Settings</h1>
        <p className="text-label-2 text-sm mt-0.5">
          Manage your account and organization preferences
        </p>
      </div>

      {/* Profile card — links to the editable profile page */}
      <Link
        href="/settings/profile"
        className="block bg-surface rounded-card shadow-card border border-border p-5 hover:bg-fill transition-colors"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide">Your Profile</h3>
          <span className="text-xs font-semibold" style={{ color: '#876830' }}>Edit →</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-fill flex items-center justify-center flex-shrink-0 overflow-hidden">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[16px] font-semibold text-label-2">
                {profile?.first_name?.[0]}{profile?.last_name?.[0]}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-black">
              {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-xs text-label-2">{profile?.email}</p>
            <p className="text-xs text-label-3 mt-0.5">
              {profile?.role?.replace('_', ' ')} {profile?.nmls_id ? `· NMLS #${profile.nmls_id}` : ''}
            </p>
          </div>
        </div>
      </Link>

      <GateReadinessCard />

      {applicationSlug && <ApplicationLink slug={applicationSlug} />}

      {/* Settings sections */}
      <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden divide-y divide-border">
        {SETTINGS_SECTIONS.map(({ href, icon: Icon, label, description }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 px-5 py-4 hover:bg-fill transition-colors"
          >
            <div className="w-9 h-9 rounded-[10px] bg-fill flex items-center justify-center flex-shrink-0">
              <Icon size={16} className="text-label-2" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-black">{label}</p>
              <p className="text-xs text-label-2 mt-0.5">{description}</p>
            </div>
            <ChevronRight size={16} className="text-label-3" />
          </Link>
        ))}
      </div>

      <CreditRepairSettingsCard />
    </div>
  );
}