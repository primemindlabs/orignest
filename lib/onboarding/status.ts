/**
 * Phase 36 — Getting Started status: auto-detect each setup step from real data,
 * merged with any manual marks in onboarding_progress.steps.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export type StepKey = 'company_profile' | 'phone_number' | 'first_lead' | 'first_message' | 'import_contacts';

export interface OnboardingStep {
  key: StepKey;
  label: string;
  description: string;
  href: string;
  done: boolean;
}

export interface OnboardingStatus {
  steps: OnboardingStep[];
  completedCount: number;
  total: number;
  dismissed: boolean;
  allDone: boolean;
}

export async function getOnboardingStatus(orgId: string, clerkUserId: string): Promise<OnboardingStatus> {
  const sb = createAdminClient();

  const [{ data: org }, { data: profile }, { count: leadCount }, prog] = await Promise.all([
    sb.from('organizations').select('name, nmls_company_id, licensed_states').eq('id', orgId).maybeSingle(),
    sb.from('profiles').select('phone').eq('clerk_user_id', clerkUserId).maybeSingle(),
    sb.from('leads').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    sb.from('onboarding_progress').select('steps, dismissed_at').eq('org_id', orgId).maybeSingle(),
  ]);

  // Any borrower message/chat/campaign send counts as "first message sent".
  const [{ count: portalMsgs }, { count: chatMsgs }] = await Promise.all([
    sb.from('portal_messages').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('sender_type', 'lo'),
    sb.from('chat_messages').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('sender_type', 'lo'),
  ]);

  const manual = (prog.data?.steps ?? {}) as Partial<Record<StepKey, boolean>>;
  const m = (k: StepKey) => manual[k] === true;

  const companyDone = m('company_profile') || Boolean(org?.name && (org?.nmls_company_id || (Array.isArray(org?.licensed_states) && org.licensed_states.length)));
  const phoneDone = m('phone_number') || Boolean(profile?.phone);
  const leadDone = m('first_lead') || (leadCount ?? 0) > 0;
  const messageDone = m('first_message') || (portalMsgs ?? 0) > 0 || (chatMsgs ?? 0) > 0;
  const importDone = m('import_contacts') || (leadCount ?? 0) >= 3;

  const steps: OnboardingStep[] = [
    { key: 'company_profile', label: 'Complete your company profile', description: 'Name, NMLS#, and licensed states — these appear in every borrower email.', href: '/settings/organization', done: companyDone },
    { key: 'phone_number', label: 'Add your direct phone', description: 'Used for portal communications and the dialer.', href: '/settings/organization', done: phoneDone },
    { key: 'first_lead', label: 'Add your first lead', description: 'Start your pipeline — add manually or import a CSV.', href: '/leads/new', done: leadDone },
    { key: 'first_message', label: 'Send your first message', description: 'Reach a borrower through the portal or loan chat.', href: '/pipeline', done: messageDone },
    { key: 'import_contacts', label: 'Build your pipeline', description: 'Add a few more leads so your AI features have data to work with.', href: '/leads', done: importDone },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  return {
    steps,
    completedCount,
    total: steps.length,
    dismissed: Boolean(prog.data?.dismissed_at),
    allDone: completedCount === steps.length,
  };
}
