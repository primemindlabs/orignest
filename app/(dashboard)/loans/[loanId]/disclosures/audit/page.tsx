import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { ExportAuditButton } from './ExportAuditButton';

export const dynamic = 'force-dynamic';

type AuditEvent = {
  id: string;
  at: string;
  kind: string;
  detail: string;
  channel: string | null;
  source: string;
};

/** Best-effort fetch: returns [] if the table is missing or the query errors. */
async function safe<T = Record<string, unknown>>(
  p: PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  try {
    const { data, error } = await p;
    return error ? [] : (data ?? []);
  } catch {
    return [];
  }
}

const CONSENT_LABELS: Record<string, string> = {
  initial_tcpa_consent: 'Initial TCPA consent captured',
  sms_opt_in: 'SMS opt-in',
  sms_opt_out: 'SMS opt-out (STOP)',
  email_opt_in: 'Email opt-in',
  email_opt_out: 'Email opt-out',
  preference_update: 'Communication preference updated',
  consent_form_signed: 'Consent form signed',
  lo_manual_update: 'Manual consent update by LO',
};

function fmt(ts: string | null | undefined): string {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

export default async function Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  // ── Gather compliance events from every available source (best-effort) ──────
  const consentLog = await safe<{
    id: string;
    event_type: string | null;
    channel: string | null;
    source: string | null;
    old_value: string | null;
    new_value: string | null;
    occurred_at: string | null;
  }>(
    sb
      .from('consent_audit_log')
      .select('id, event_type, channel, source, old_value, new_value, occurred_at')
      .eq('org_id', orgId)
      .eq('lead_id', params.loanId)
      .order('occurred_at', { ascending: false })
      .limit(100),
  );

  const tcpaLog = await safe<{
    id: string;
    channel: string | null;
    consent_given: boolean | null;
    consent_method: string | null;
    created_at: string | null;
  }>(
    sb
      .from('tcpa_consent_log')
      .select('id, channel, consent_given, consent_method, created_at')
      .eq('org_id', orgId)
      .eq('lead_id', params.loanId)
      .order('created_at', { ascending: false })
      .limit(100),
  );

  const comms = await safe<{
    id: string;
    channel: string | null;
    direction: string | null;
    subject: string | null;
    delivered_at: string | null;
    created_at: string | null;
  }>(
    sb
      .from('communications')
      .select('id, channel, direction, subject, delivered_at, created_at')
      .eq('org_id', orgId)
      .eq('lead_id', params.loanId)
      .order('created_at', { ascending: false })
      .limit(50),
  );

  const events: AuditEvent[] = [];

  for (const r of consentLog) {
    const label = CONSENT_LABELS[r.event_type ?? ''] ?? (r.event_type ?? 'Consent event');
    const change =
      r.old_value || r.new_value
        ? ` (${r.old_value ?? '—'} → ${r.new_value ?? '—'})`
        : '';
    events.push({
      id: `consent-${r.id}`,
      at: r.occurred_at ?? '',
      kind: 'Consent',
      detail: `${label}${change}`,
      channel: r.channel,
      source: r.source ?? 'consent_audit_log',
    });
  }

  for (const r of tcpaLog) {
    events.push({
      id: `tcpa-${r.id}`,
      at: r.created_at ?? '',
      kind: 'TCPA',
      detail: `${r.consent_given ? 'Consent granted' : 'Consent revoked'} for ${
        r.channel ?? 'all channels'
      } via ${r.consent_method ?? 'unspecified'}`,
      channel: r.channel,
      source: 'tcpa_consent_log',
    });
  }

  for (const r of comms) {
    events.push({
      id: `comm-${r.id}`,
      at: r.created_at ?? '',
      kind: 'Outreach',
      detail: `${r.direction ?? 'outbound'} ${r.channel ?? 'message'}${
        r.delivered_at ? ' — delivered' : ''
      }${r.subject ? `: ${r.subject}` : ''}`,
      channel: r.channel,
      source: 'communications',
    });
  }

  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  const borrowerName =
    [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'this borrower';

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Audit Export</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Immutable compliance trail for this loan — consent, TCPA, and outreach events.
        </p>
      </div>

      {/* Export action */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold text-[var(--c-text)]">CCPA / audit data export</p>
          <p className="text-[12px] text-[var(--c-label2)] mt-0.5 max-w-md leading-relaxed">
            Downloads a signed JSON bundle of your book (borrower records, communications, and
            consent logs). One export per 24 hours.
          </p>
        </div>
        <ExportAuditButton />
      </div>

      {/* Event list */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--c-border)] flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[var(--c-text)]">Recent compliance events</p>
          <span className="text-[11px] text-[var(--c-label3)] tabular-nums">
            {events.length} record{events.length === 1 ? '' : 's'}
          </span>
        </div>

        {events.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[13px] font-medium text-[var(--c-text)]">No compliance events recorded yet</p>
            <p className="text-[12px] text-[var(--c-label2)] mt-1 max-w-sm mx-auto leading-relaxed">
              Consent captures, TCPA acknowledgements, and outreach for {borrowerName} will appear
              here automatically as they happen. You can still export the full audit bundle above.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--c-border)]">
            {events.slice(0, 100).map((e) => (
              <li key={e.id} className="px-5 py-3 flex items-start gap-3">
                <span
                  className="mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{
                    color: 'var(--c-gold-deep)',
                    background: 'var(--c-fill)',
                  }}
                >
                  {e.kind}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-[var(--c-text)] leading-snug">{e.detail}</p>
                  <p className="text-[11px] text-[var(--c-label3)] mt-0.5">
                    {fmt(e.at)} · {e.source}
                    {e.channel ? ` · ${e.channel}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[12px] text-[var(--c-label3)]">
        Audit records are insert-only and cannot be edited or deleted, preserving an immutable
        record for TRID, TCPA, and CCPA review.
      </p>
    </div>
  );
}
