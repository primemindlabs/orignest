import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { CommandPaletteProvider } from '@/components/providers/CommandPaletteProvider';
import { SpeedTicker } from '@/components/dashboard/SpeedTicker';
import { ClosingCelebrationListener } from '@/components/ui/ClosingCelebrationListener';
import { AskAshleyWidget } from '@/components/dashboard/AskAshleyWidget';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth();

  if (!userId) redirect('/sign-in');

  // ── Processor cross-org check ─────────────────────────────────────────────
  // Processors may not have a primary Clerk org but still have active assignments.
  // We allow them into the dashboard using the processor context.
  if (!orgId) {
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
    // Processor with no primary org — fall through with limited context
  }

  const sb = createClient();
  const [{ data: profile }, { data: org }] = await Promise.all([
    sb.from('profiles').select('*').eq('clerk_user_id', userId).maybeSingle(),
    orgId
      ? sb.from('organizations').select('*').eq('clerk_org_id', orgId).maybeSingle()
      : (Promise.resolve({ data: null, error: null }) as Promise<{ data: null; error: null }>),
  ]);

  const userRole = (profile?.role as string | undefined) ?? 'loan_officer';
  const loName = profile
    ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
    : undefined;

  return (
    <CommandPaletteProvider>
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar userRole={userRole} orgName={org?.name ?? undefined} />
        <div className="flex-1 flex flex-col min-w-0 ml-[220px]">
          <Topbar />
          <main className="flex-1 overflow-auto pt-14 p-6 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
      {/* Global UX layer */}
      <SpeedTicker />
      <ClosingCelebrationListener loName={loName} />
      <AskAshleyWidget />
    </CommandPaletteProvider>
  );
}
