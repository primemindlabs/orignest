import { redirect } from 'next/navigation';
import { getOrgContext } from '@/lib/auth/orgContext';
import { AutomationsClient } from '@/components/automations/AutomationsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Automations — AshleyIQ' };

/**
 * Stage C — the /automations page now renders the real, DB-backed milestone
 * automations UI (the same component used by /settings/automations), replacing the
 * former MOCK_AUTOMATIONS demo. It reads/writes milestone_automation_rules via
 * /api/automations/rules with rules / approval-queue / history tabs.
 */
export default async function AutomationsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  return <AutomationsClient />;
}
