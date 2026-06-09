import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { TasksClient, type TaskRow } from './TasksClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Tasks' };

export default async function TasksPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: tasks } = await sb
    .from('lead_tasks')
    .select('id, title, description, due_date, completed, priority, lead_id, leads(first_name, last_name)')
    .eq('org_id', orgId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(500);

  const rows: TaskRow[] = (tasks ?? []).map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    due_date: t.due_date,
    completed: t.completed,
    priority: t.priority,
    lead_id: t.lead_id,
    lead_name: t.leads ? `${t.leads.first_name ?? ''} ${t.leads.last_name ?? ''}`.trim() : null,
  }));

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-black tracking-tight">Tasks</h1>
        <p className="text-label-2 text-sm mt-0.5">
          Every open task across your pipeline, grouped by when it&apos;s due.
        </p>
      </div>
      <TasksClient initial={rows} />
    </div>
  );
}
