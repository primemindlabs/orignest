import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { FUNNEL_STAGE_LABELS } from '@/lib/funnel/stages';
import { resolveLoId } from '@/lib/automations/loId';

export const dynamic = 'force-dynamic';

type LogRow = {
  id: string;
  rule_id: string | null;
  triggered_at: string | null;
  action_type: string | null;
  rendered_message: string | null;
  recipient_type: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  approval_status: string | null;
  sent_at: string | null;
  failed_reason: string | null;
};

type RuleRow = {
  id: string;
  rule_name: string | null;
  trigger_stage: string | null;
  action_type: string | null;
  active: boolean | null;
  requires_approval: boolean | null;
  auto_send_email: boolean | null;
};

const ACTION_LABELS: Record<string, string> = {
  sms_borrower: 'SMS → Borrower',
  sms_realtor: 'SMS → Realtor',
  email_borrower: 'Email → Borrower',
  email_realtor: 'Email → Realtor',
  internal_note: 'Internal note',
};

const STATUS_STYLE: Record<string, { label: string; tone: string }> = {
  pending: { label: 'Pending approval', tone: 'var(--c-warning)' },
  approved: { label: 'Approved', tone: 'var(--c-success)' },
  auto_sent: { label: 'Auto-sent', tone: 'var(--c-success)' },
  skipped: { label: 'Skipped', tone: 'var(--c-label3)' },
  failed: { label: 'Failed', tone: 'var(--c-danger)' },
};

function stageLabel(stage: string | null | undefined): string {
  if (!stage) return '—';
  return (FUNNEL_STAGE_LABELS as Record<string, string>)[stage] ?? stage;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default async function Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name, stage')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  const borrowerName = `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || 'this borrower';

  // History for THIS loan (defensive: table may not exist in some envs).
  let history: LogRow[] = [];
  try {
    const { data } = await sb
      .from('milestone_automation_log')
      .select(
        'id, rule_id, triggered_at, action_type, rendered_message, recipient_type, recipient_phone, recipient_email, approval_status, sent_at, failed_reason',
      )
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .order('triggered_at', { ascending: false })
      .limit(50);
    history = (data ?? []) as LogRow[];
  } catch {
    history = [];
  }

  // Active rules configured for this LO — show which future milestones will fire.
  // rules.user_id references profiles.id, so map the Clerk user id first.
  let rules: RuleRow[] = [];
  try {
    const loId = await resolveLoId(sb, userId);
    if (loId) {
      const { data } = await sb
        .from('milestone_automation_rules')
        .select('id, rule_name, trigger_stage, action_type, active, requires_approval, auto_send_email')
        .eq('org_id', orgId)
        .eq('user_id', loId)
        .eq('active', true)
        .order('trigger_stage', { ascending: true });
      rules = (data ?? []) as RuleRow[];
    }
  } catch {
    rules = [];
  }

  const currentStage = lead.stage as string | null;
  // Rules whose trigger stage has not yet been logged for this loan = "upcoming".
  const firedRuleIds = new Set(history.map((h) => h.rule_id).filter(Boolean));
  const upcoming = rules.filter((r) => !firedRuleIds.has(r.id) && r.trigger_stage !== currentStage);
  const pendingCount = history.filter((h) => h.approval_status === 'pending').length;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Milestone Communications</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Automated touches fired for {borrowerName} as this loan hits each milestone. Configure rules in{' '}
          <Link href="/settings/automations" className="text-[var(--c-gold-deep)] font-medium hover:underline">
            Automations
          </Link>
          .
        </p>
      </div>

      {pendingCount > 0 && (
        <div className="bg-[var(--c-fill)] border border-[var(--c-border)] rounded-[12px] px-4 py-3 text-[13px] text-[var(--c-text)]">
          <span className="font-semibold" style={{ color: 'var(--c-warning)' }}>
            {pendingCount} message{pendingCount === 1 ? '' : 's'}
          </span>{' '}
          awaiting your approval.{' '}
          <Link href="/settings/automations" className="text-[var(--c-gold-deep)] font-medium hover:underline">
            Review queue →
          </Link>
        </div>
      )}

      {/* HISTORY */}
      <section className="space-y-2">
        <h2 className="text-[13px] font-semibold text-[var(--c-label2)] uppercase tracking-wide">Communication history</h2>
        {history.length === 0 ? (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-6 text-center">
            <p className="text-[14px] font-medium text-[var(--c-text)]">No milestone messages yet</p>
            <p className="text-[13px] text-[var(--c-label2)] mt-1 max-w-md mx-auto leading-relaxed">
              When this loan advances through stages, your active automation rules generate borrower and realtor touches
              here. SMS requires your approval before sending.
            </p>
            <Link
              href="/settings/automations"
              className="inline-block mt-3 text-[13px] font-medium px-3 py-1.5 rounded-[10px] bg-[var(--c-fill)] border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-surface)]"
            >
              Set up automation rules
            </Link>
          </div>
        ) : (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] divide-y divide-[var(--c-border)] overflow-hidden">
            {history.map((row) => {
              const status = STATUS_STYLE[row.approval_status ?? 'pending'] ?? {
                label: row.approval_status ?? 'Unknown',
                tone: 'var(--c-label3)',
              };
              const recipient = row.recipient_email || row.recipient_phone || row.recipient_type || '—';
              return (
                <div key={row.id} className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-semibold text-[var(--c-text)]">
                      {ACTION_LABELS[row.action_type ?? ''] ?? row.action_type ?? 'Communication'}
                    </span>
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
                      style={{ color: status.tone, backgroundColor: 'var(--c-fill)' }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="text-[13px] text-[var(--c-label2)] leading-relaxed whitespace-pre-wrap">
                    {row.rendered_message || '—'}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--c-label3)]">
                    <span>To: {recipient}</span>
                    <span>•</span>
                    <span>Triggered {fmtDate(row.triggered_at)}</span>
                    {row.sent_at && (
                      <>
                        <span>•</span>
                        <span>Sent {fmtDate(row.sent_at)}</span>
                      </>
                    )}
                    {row.failed_reason && (
                      <>
                        <span>•</span>
                        <span style={{ color: 'var(--c-danger)' }}>{row.failed_reason}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* UPCOMING / CONFIGURED RULES */}
      <section className="space-y-2">
        <h2 className="text-[13px] font-semibold text-[var(--c-label2)] uppercase tracking-wide">
          Upcoming automations
        </h2>
        {rules.length === 0 ? (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 text-center">
            <p className="text-[13px] text-[var(--c-label2)] leading-relaxed max-w-md mx-auto">
              You have no active milestone rules. Create rules like &ldquo;When a loan reaches Underwriting, text the
              borrower&rdquo; to keep everyone updated automatically.
            </p>
            <Link
              href="/settings/automations"
              className="inline-block mt-3 text-[13px] font-medium px-3 py-1.5 rounded-[10px] bg-[var(--c-gold-deep)] text-white hover:opacity-90"
            >
              Create a rule
            </Link>
          </div>
        ) : upcoming.length === 0 ? (
          <p className="text-[13px] text-[var(--c-label3)] px-1">
            All {rules.length} active rule{rules.length === 1 ? ' has' : 's have'} already fired or matches the current
            stage. New touches appear as this loan advances.
          </p>
        ) : (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] divide-y divide-[var(--c-border)] overflow-hidden">
            {upcoming.map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--c-text)] truncate">
                    {r.rule_name || ACTION_LABELS[r.action_type ?? ''] || 'Milestone rule'}
                  </p>
                  <p className="text-[11px] text-[var(--c-label3)] mt-0.5">
                    Fires at <span className="text-[var(--c-label2)]">{stageLabel(r.trigger_stage)}</span> ·{' '}
                    {ACTION_LABELS[r.action_type ?? ''] ?? r.action_type ?? '—'}
                  </p>
                </div>
                <span className="text-[11px] text-[var(--c-label3)] shrink-0">
                  {r.action_type?.startsWith('sms') || r.requires_approval
                    ? 'Needs approval'
                    : r.auto_send_email
                      ? 'Auto-sends'
                      : 'Needs approval'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
