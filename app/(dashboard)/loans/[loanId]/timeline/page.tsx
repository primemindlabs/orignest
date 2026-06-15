import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type EventKind = 'stage' | 'email' | 'sms' | 'call' | 'note';

interface TimelineEvent {
  id: string;
  kind: EventKind;
  at: string; // ISO timestamp
  title: string;
  detail: string | null;
  actor: string | null;
  inbound: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New Inquiry',
  pre_qual: 'Pre-Qualified',
  application: 'Application',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Conditional Approval',
  clear_to_close: 'Clear to Close',
  closed: 'Closed / Funded',
  denied: 'Denied',
  withdrawn: 'Withdrawn',
};

function stageLabel(stage: string | null | undefined): string {
  if (!stage) return 'Created';
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmt(at: string): { date: string; time: string } {
  const d = new Date(at);
  if (isNaN(d.getTime())) return { date: '—', time: '' };
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

const ICONS: Record<EventKind, { glyph: string; tone: string; bg: string }> = {
  stage: { glyph: '◆', tone: 'var(--c-gold-deep)', bg: 'color-mix(in srgb, var(--c-gold-deep) 12%, transparent)' },
  email: { glyph: '✉', tone: 'var(--c-text)', bg: 'var(--c-fill)' },
  sms: { glyph: '💬', tone: 'var(--c-text)', bg: 'var(--c-fill)' },
  call: { glyph: '☎', tone: 'var(--c-text)', bg: 'var(--c-fill)' },
  note: { glyph: '✎', tone: 'var(--c-label2)', bg: 'var(--c-fill)' },
};

export default async function Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('*')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  const events: TimelineEvent[] = [];

  // --- Stage transitions (Phase 99) ---
  try {
    const { data: transitions } = await sb
      .from('stage_transitions')
      .select('id, from_stage, to_stage, days_in_prior_stage, transitioned_at')
      .eq('lead_id', params.loanId)
      .order('transitioned_at', { ascending: false });

    for (const t of transitions ?? []) {
      const row = t as {
        id: string;
        from_stage?: string | null;
        to_stage?: string | null;
        days_in_prior_stage?: number | null;
        transitioned_at: string;
      };
      const from = row.from_stage ?? null;
      const days = row.days_in_prior_stage ?? null;
      const detail = from
        ? `Moved from ${stageLabel(from)}${days != null ? ` after ${days} day${days === 1 ? '' : 's'}` : ''}`
        : 'Loan entered the pipeline';
      events.push({
        id: `stage-${row.id}`,
        kind: 'stage',
        at: row.transitioned_at,
        title: `Stage → ${stageLabel(row.to_stage ?? null)}`,
        detail,
        actor: null,
        inbound: false,
      });
    }
  } catch {
    /* table may not exist — skip silently */
  }

  // --- Communications ---
  const senderIds = new Set<string>();
  let comms: Array<{
    id: string;
    channel: string;
    direction: string;
    subject: string | null;
    body: string | null;
    sender_id: string | null;
    sent_at: string | null;
    created_at: string | null;
  }> = [];
  try {
    const { data } = await sb
      .from('communications')
      .select('id, channel, direction, subject, body, sender_id, sent_at, created_at')
      .eq('lead_id', params.loanId)
      .order('created_at', { ascending: false });
    comms = (data ?? []) as typeof comms;
    for (const c of comms) if (c.sender_id) senderIds.add(c.sender_id);
  } catch {
    /* table may not exist — skip silently */
  }

  // Resolve sender names (best-effort)
  const senderNames = new Map<string, string>();
  if (senderIds.size > 0) {
    try {
      const { data: people } = await sb
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', Array.from(senderIds));
      for (const p of people ?? []) {
        const row = p as { id: string; first_name?: string | null; last_name?: string | null; email?: string | null };
        const name = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || (row.email ?? '');
        if (name) senderNames.set(row.id, name);
      }
    } catch {
      /* skip */
    }
  }

  for (const c of comms) {
    const inbound = c.direction === 'inbound';
    const kind: EventKind =
      c.channel === 'email' ? 'email' : c.channel === 'sms' ? 'sms' : c.channel === 'call' ? 'call' : 'note';
    const channelLabel =
      kind === 'email' ? 'Email' : kind === 'sms' ? 'Text message' : kind === 'call' ? 'Phone call' : 'Note';
    const actor = c.sender_id ? senderNames.get(c.sender_id) ?? null : null;
    const title = kind === 'note' ? 'Note logged' : `${channelLabel} ${inbound ? 'received' : 'sent'}`;
    const detail = (c.subject && c.subject.trim()) || (c.body && c.body.trim().slice(0, 180)) || null;
    events.push({
      id: `comm-${c.id}`,
      kind,
      at: c.sent_at || c.created_at || new Date().toISOString(),
      title,
      detail,
      actor,
      inbound,
    });
  }

  // Anchor the feed with loan creation
  const createdAt = (lead as { created_at?: string | null }).created_at;
  if (createdAt) {
    events.push({
      id: 'lead-created',
      kind: 'stage',
      at: createdAt,
      title: 'Loan file created',
      detail: 'Added to the pipeline',
      actor: null,
      inbound: false,
    });
  }

  // Merge + reverse-chronological sort, dedupe by id
  const seen = new Set<string>();
  const merged = events
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Timeline</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Every stage change and communication on this loan, newest first.
        </p>
      </div>

      {merged.length === 0 ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-8 text-center">
          <div className="text-[28px] leading-none mb-2" style={{ color: 'var(--c-label3)' }}>
            ◷
          </div>
          <p className="text-[15px] font-semibold text-[var(--c-text)]">No activity yet</p>
          <p className="text-[13px] text-[var(--c-label2)] mt-1 max-w-sm mx-auto">
            Stage changes and logged emails, texts, calls, and notes will appear here automatically as the file moves
            through the pipeline.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
          <ol className="relative">
            <span
              className="absolute left-[15px] top-1 bottom-1 w-px"
              style={{ background: 'var(--c-border)' }}
              aria-hidden
            />
            {merged.map((e) => {
              const icon = ICONS[e.kind];
              const { date, time } = fmt(e.at);
              return (
                <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                  <span
                    className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] border"
                    style={{ background: icon.bg, color: icon.tone, borderColor: 'var(--c-border)' }}
                    aria-hidden
                  >
                    {icon.glyph}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[14px] font-semibold text-[var(--c-text)] truncate">{e.title}</p>
                      <span className="text-[11px] text-[var(--c-label3)] whitespace-nowrap tabular-nums">
                        {date}
                        {time ? ` · ${time}` : ''}
                      </span>
                    </div>
                    {e.detail && (
                      <p className="text-[13px] text-[var(--c-label2)] mt-0.5 leading-relaxed break-words">
                        {e.detail}
                      </p>
                    )}
                    {(e.actor || e.inbound) && (
                      <p className="text-[11px] text-[var(--c-label3)] mt-1">
                        {e.actor ? `by ${e.actor}` : ''}
                        {e.actor && e.inbound ? ' · ' : ''}
                        {e.inbound ? 'from borrower' : ''}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
