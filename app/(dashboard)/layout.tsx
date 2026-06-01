import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth();

  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createClient();
  const [{ data: profile }, { data: org }] = await Promise.all([
    sb.from('profiles').select('*').eq('clerk_user_id', userId).maybeSingle(),
    sb.from('organizations').select('*').eq('clerk_org_id', orgId).maybeSingle(),
  ]);

  const userRole = (profile?.role as string | undefined) ?? 'loan_officer';

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar userRole={userRole} orgName={org?.name ?? undefined} />
      <div className="flex-1 flex flex-col min-w-0 ml-[220px]">
        <Topbar />
        <main className="flex-1 overflow-auto pt-14 p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
