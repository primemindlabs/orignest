/**
 * Phase 97 — public resume landing for a recovery deep link (/apply/resume/<token>).
 * No login: the unguessable token is the credential (route is allowlisted via the
 * existing /apply(.*) public matcher). On load it records borrower activity and
 * marks the latest recovery SMS as opened, then shows saved progress.
 *
 * The Smart 1003 form (Phase 59) is deferred, so this confirms the saved state and
 * hands off; once the form lands it mounts here, pre-scrolled to last_section.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ResumeApplicationPage({ params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const { data: session } = await sb
    .from('application_sessions')
    .select('id, lead_id, completion_pct, last_section_completed, completed_at, org_id')
    .eq('token', params.token)
    .maybeSingle();
  if (!session) notFound();

  const now = new Date().toISOString();
  // Record the resume touch + mark the most recent un-opened recovery SMS opened.
  if (!session.completed_at) {
    await sb.from('application_sessions').update({ last_activity_at: now }).eq('id', session.id);
    const { data: lastMsg } = await sb
      .from('abandon_recovery_messages')
      .select('id')
      .eq('session_id', session.id)
      .is('opened_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastMsg) await sb.from('abandon_recovery_messages').update({ opened_at: now }).eq('id', lastMsg.id);
  }

  const { data: org } = await sb.from('organizations').select('name').eq('id', session.org_id).maybeSingle();
  const pct = session.completion_pct ?? 0;
  const done = !!session.completed_at;

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[#C9A95C]/15 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🏡</span>
        </div>
        {done ? (
          <>
            <h1 className="text-xl font-semibold text-gray-900">Your application is submitted</h1>
            <p className="text-sm text-gray-500 mt-2">Thanks! {org?.name ?? 'Your loan team'} has everything they need and will be in touch.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-gray-900">Welcome back!</h1>
            <p className="text-sm text-gray-500 mt-2">
              Your mortgage application is saved{session.last_section_completed ? ` at the ${session.last_section_completed.replace(/_/g, ' ')} step` : ''}. Pick up right where you left off.
            </p>
            <div className="mt-5">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{pct}% complete</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#C9A95C] transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <a
              href="/apply"
              className="inline-flex items-center justify-center w-full mt-6 py-3 rounded-xl bg-[#C9A95C] text-white font-semibold text-sm hover:bg-[#b8953f] transition-colors"
            >
              Continue my application
            </a>
            <p className="text-xs text-gray-400 mt-4">{org?.name ?? 'Your loan team'} · Reply STOP to any text to unsubscribe.</p>
          </>
        )}
      </div>
    </div>
  );
}
