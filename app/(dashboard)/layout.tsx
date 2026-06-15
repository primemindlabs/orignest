import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getOrgContext } from '@/lib/auth/orgContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { createAdminClient } from '@/lib/supabase/admin';
import { CommandPaletteProvider } from '@/components/providers/CommandPaletteProvider';
import { NavDrawerProvider } from '@/components/layout/NavDrawerContext';
import { SpeedTicker } from '@/components/dashboard/SpeedTicker';
import { ClosingCelebrationListener } from '@/components/ui/ClosingCelebrationListener';
import { AskAshleyWidget } from '@/components/dashboard/AskAshleyWidget';
import { TrialBanner } from '@/components/billing/TrialBanner';
import { ActionRail } from '@/components/dashboard/ActionRail';
import { NotificationToaster } from '@/components/notifications/NotificationToaster';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // getOrgContext resolves the org from membership (reliable on a Clerk dev
  // instance, unlike the active-org session claim), auto-provisions the Supabase
  // org/profile rows, and returns orgId as the Supabase uuid every query needs.
  const { userId, orgId, role } = await getOrgContext();

  if (!userId) redirect('/sign-in');

  if (!orgId) {
    // No primary org. Processors may operate cross-org via assignments.
    const sbAdmin = createAdminClient();
    const { data: processorAssignment } = await sbAdmin
      .from('processor_assignments')
      .select('id')
      .eq('processor_clerk_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (!processorAssignment) {
      redirect('/onboarding');
    }
    // Processor with no primary org — fall through with limited context.
  }

  const sb = createAdminClient();
  const [{ data: profile }, { data: org }] = await Promise.all([
    sb.from('profiles').select('*').eq('clerk_user_id', userId).maybeSingle(),
    orgId
      ? sb.from('organizations').select('*').eq('id', orgId).maybeSingle()
      : (Promise.resolve({ data: null, error: null }) as Promise<{ data: null; error: null }>),
  ]);

  const userRole = (profile?.role as string | undefined) ?? role ?? 'loan_officer';
  const loName = profile
    ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
    : undefined;

  // Read persisted sidebar state server-side so the first paint already has the
  // correct width + expanded groups — no post-hydration snap ("jumping").
  let sidebarCollapsed = false;
  let sidebarExpanded: string[] | undefined;
  try {
    const raw = cookies().get('ashley_sidebar')?.value;
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (typeof parsed.collapsed === 'boolean') sidebarCollapsed = parsed.collapsed;
      if (Array.isArray(parsed.expanded)) sidebarExpanded = parsed.expanded;
    }
  } catch {
    /* default to expanded */
  }
  const sidebarW = sidebarCollapsed ? '64px' : '220px';

  return (
    <CommandPaletteProvider>
      <NavDrawerProvider>
        <div id="app-shell" className="flex h-screen overflow-hidden bg-bg" style={{ '--sidebar-w': sidebarW } as React.CSSProperties}>
          <Sidebar userRole={userRole} orgName={org?.name ?? undefined} initialCollapsed={sidebarCollapsed} initialExpanded={sidebarExpanded} />
          <div className="flex-1 flex flex-col min-w-0 transition-[margin] duration-150 lg:ml-[var(--sidebar-w)]">
            <Topbar role={userRole} />
            <main className="flex-1 overflow-auto pt-14 animate-fade-in">
              <TrialBanner />
              <ActionRail />
              <div className="p-4 sm:p-6">{children}</div>
            </main>
          </div>
        </div>
        {/* Global UX layer */}
        <NotificationToaster userId={(profile?.id as string | undefined) ?? null} />
        <SpeedTicker />
        <ClosingCelebrationListener loName={loName} />
        {/* One Ashley brain — the single floating AI. Absorbs the former LOA launcher
            (business intelligence, now auto-routed inside Ashley) and the Quick Actions bar. */}
        <AskAshleyWidget />
      </NavDrawerProvider>
    </CommandPaletteProvider>
  );
}
