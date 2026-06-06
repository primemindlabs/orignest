import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { CreditCard, Users, Building2, Shield, Bell, ChevronRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Settings' };

const SETTINGS_SECTIONS = [
  {
    href: '/settings/billing',
    icon: CreditCard,
    label: 'Billing',
    description: 'Manage your subscription, seats, and payment method',
  },
  {
    href: '/team',
    icon: Users,
    label: 'Team',
    description: 'Invite and manage your loan officers and staff',
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
] as const;

export default async function SettingsPage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect('/sign-in');

  const sb = createClient();
  const { data: profile } = await sb
    .from('profiles')
    .select('first_name, last_name, email, role, nmls_id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-black tracking-tight">Settings</h1>
        <p className="text-label-2 text-sm mt-0.5">
          Manage your account and organization preferences
        </p>
      </div>

      {/* Profile card */}
      <div className="bg-surface rounded-card shadow-card border border-border p-5">
        <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide mb-4">
          Your Profile
        </h3>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue/10 flex items-center justify-center flex-shrink-0">
            <span className="text-[16px] font-semibold text-blue">
              {profile?.first_name?.[0]}{profile?.last_name?.[0]}
            </span>
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
      </div>

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
    </div>
  );
}
