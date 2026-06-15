import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Standard mortgage validity windows (calendar days) used when a row has a
// known issue/pull date but no explicit expiry on file.
const DEFAULT_VALIDITY_DAYS = {
  credit: 120, // Fannie/Freddie credit report validity
  appraisal: 120, // appraisal report validity (conventional)
} as const;

type Severity = 'expired' | 'critical' | 'warning' | 'ok' | 'unknown';

type ExpiryItem = {
  key: string;
  category: 'Rate Lock' | 'Credit' | 'Appraisal' | 'Documents';
  label: string;
  detail: string | null;
  asOf: Date | null; // the source/issue date, if known
  expiry: Date | null; // the computed or explicit expiry date
};

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function daysUntil(target: Date | null): number | null {
  if (!target) return null;
  const now = new Date();
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86400000);
}

function severityFor(days: number | null): Severity {
  if (days == null) return 'unknown';
  if (days < 0) return 'expired';
  if (days <= 3) return 'critical';
  if (days <= 14) return 'warning';
  return 'ok';
}

const SEV_STYLE: Record<Severity, { label: string; bg: string; fg: string }> = {
  expired: { label: 'Expired', bg: 'rgba(220,38,38,0.12)', fg: 'var(--c-danger)' },
  critical: { label: 'Expiring', bg: 'rgba(220,38,38,0.10)', fg: 'var(--c-danger)' },
  warning: { label: 'Due soon', bg: 'rgba(217,119,6,0.12)', fg: 'var(--c-warning)' },
  ok: { label: 'Current', bg: 'rgba(22,163,74,0.10)', fg: 'var(--c-success)' },
  unknown: { label: 'No date', bg: 'var(--c-fill)', fg: 'var(--c-label3)' },
};

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtCountdown(days: number | null): string {
  if (days == null) return 'No expiry on file';
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  if (days === 0) return 'Expires today';
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export default async function ExpirationsPage({ params }: { params: { loanId: string } }) {
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

  const items: ExpiryItem[] = [];

  // ── Rate lock ──────────────────────────────────────────────────────────────
  try {
    const { data: lock } = await sb
      .from('rate_lock_expirations')
      .select('rate, locked_at, lock_period_days, lock_expires_at, status')
      .eq('lead_id', params.loanId)
      .maybeSingle();
    if (lock && (lock.status === 'locked' || lock.status === 'extended' || lock.lock_expires_at)) {
      const lockedAt = parseDate(lock.locked_at);
      let expiry = parseDate(lock.lock_expires_at);
      if (!expiry && lockedAt && lock.lock_period_days) {
        expiry = addDays(lockedAt, Number(lock.lock_period_days));
      }
      const rate = lock.rate != null ? `${Number(lock.rate).toFixed(3)}%` : null;
      items.push({
        key: 'rate-lock',
        category: 'Rate Lock',
        label: rate ? `Rate lock @ ${rate}` : 'Rate lock',
        detail: lock.lock_period_days ? `${lock.lock_period_days}-day lock` : null,
        asOf: lockedAt,
        expiry,
      });
    }
  } catch {
    /* table optional — skip */
  }

  // Also surface any pending lock-extension request expiry as a forward-looking item.
  try {
    const { data: req } = await sb
      .from('rate_lock_requests')
      .select('request_type, requested_lock_expiration, original_lock_expiration, status, created_at')
      .eq('lead_id', params.loanId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (req && req.status === 'pending') {
      const expiry = parseDate(req.original_lock_expiration) || parseDate(req.requested_lock_expiration);
      if (expiry) {
        items.push({
          key: 'rate-lock-request',
          category: 'Rate Lock',
          label: `Pending ${String(req.request_type || 'lock').replace(/_/g, ' ')}`,
          detail: 'Lock-desk decision pending',
          asOf: parseDate(req.created_at),
          expiry,
        });
      }
    }
  } catch {
    /* optional */
  }

  // ── Credit ─────────────────────────────────────────────────────────────────
  // credit_pulls keys on loan_id (== lead id here).
  try {
    const { data: pull } = await sb
      .from('credit_pulls')
      .select('pull_type, pulled_at, expires_at, bureau, credit_score')
      .eq('loan_id', params.loanId)
      .order('pulled_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pull) {
      const pulledAt = parseDate(pull.pulled_at);
      let expiry = parseDate(pull.expires_at);
      if (!expiry && pulledAt) expiry = addDays(pulledAt, DEFAULT_VALIDITY_DAYS.credit);
      const bits: string[] = [];
      if (pull.bureau) bits.push(String(pull.bureau).toUpperCase());
      if (pull.pull_type) bits.push(String(pull.pull_type).replace(/_/g, ' '));
      if (pull.credit_score != null) bits.push(`mid ${pull.credit_score}`);
      items.push({
        key: 'credit-pull',
        category: 'Credit',
        label: 'Credit report',
        detail: bits.length ? bits.join(' · ') : null,
        asOf: pulledAt,
        expiry,
      });
    }
  } catch {
    /* optional */
  }

  // Fallback / supplemental: uploaded credit report freshness.
  try {
    const { data: up } = await sb
      .from('credit_report_uploads')
      .select('report_date, source_bureau, created_at')
      .eq('lead_id', params.loanId)
      .order('report_date', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (up && !items.some((i) => i.key === 'credit-pull')) {
      const reportDate = parseDate(up.report_date) || parseDate(up.created_at);
      const expiry = reportDate ? addDays(reportDate, DEFAULT_VALIDITY_DAYS.credit) : null;
      items.push({
        key: 'credit-upload',
        category: 'Credit',
        label: 'Credit report (uploaded)',
        detail: up.source_bureau ? String(up.source_bureau).toUpperCase() : null,
        asOf: reportDate,
        expiry,
      });
    }
  } catch {
    /* optional */
  }

  // ── Appraisal ────────────────────────────────────────────────────────────────
  try {
    const { data: appr } = await sb
      .from('appraisal_orders')
      .select('status, report_delivered_at, ordered_at, appraisal_type, appraised_value')
      .eq('lead_id', params.loanId)
      .order('ordered_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (appr) {
      const delivered = parseDate(appr.report_delivered_at);
      const expiry = delivered ? addDays(delivered, DEFAULT_VALIDITY_DAYS.appraisal) : null;
      const bits: string[] = [];
      if (appr.appraisal_type) bits.push(String(appr.appraisal_type).replace(/_/g, ' '));
      if (appr.status) bits.push(String(appr.status).replace(/_/g, ' '));
      items.push({
        key: 'appraisal',
        category: 'Appraisal',
        label: 'Appraisal report',
        detail: bits.length ? bits.join(' · ') : null,
        asOf: delivered || parseDate(appr.ordered_at),
        expiry,
      });
    }
  } catch {
    /* optional */
  }

  // ── Document requests with due dates (asset docs etc.) ───────────────────────
  try {
    const { data: docs } = await sb
      .from('document_requests')
      .select('display_name, doc_type, status, due_date')
      .eq('lead_id', params.loanId)
      .not('due_date', 'is', null)
      .neq('status', 'received')
      .order('due_date', { ascending: true })
      .limit(25);
    for (const d of docs ?? []) {
      const due = parseDate(d.due_date);
      if (!due) continue;
      items.push({
        key: `doc-${d.doc_type ?? d.display_name ?? Math.random().toString(36).slice(2)}`,
        category: 'Documents',
        label: d.display_name || String(d.doc_type || 'Requested document').replace(/_/g, ' '),
        detail: d.status ? `Status: ${String(d.status).replace(/_/g, ' ')}` : null,
        asOf: null,
        expiry: due,
      });
    }
  } catch {
    /* optional */
  }

  // Enrich + sort: soonest/expired first, unknowns last.
  const enriched = items
    .map((it) => {
      const days = daysUntil(it.expiry);
      return { ...it, days, sev: severityFor(days) };
    })
    .sort((a, b) => {
      if (a.days == null && b.days == null) return 0;
      if (a.days == null) return 1;
      if (b.days == null) return -1;
      return a.days - b.days;
    });

  const counts = {
    expired: enriched.filter((e) => e.sev === 'expired').length,
    soon: enriched.filter((e) => e.sev === 'critical' || e.sev === 'warning').length,
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Expirations</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Time-sensitive items on this file — rate lock, credit, appraisal, and dated document requests.
        </p>
      </div>

      {enriched.length === 0 ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-8 text-center">
          <p className="text-[14px] font-semibold text-[var(--c-text)]">Nothing dated on this file yet</p>
          <p className="text-[13px] text-[var(--c-label2)] mt-1.5 max-w-md mx-auto leading-relaxed">
            Once a rate lock is set, credit is pulled, an appraisal is delivered, or a document is requested
            with a due date, its expiration countdown will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          {(counts.expired > 0 || counts.soon > 0) && (
            <div className="flex flex-wrap gap-2">
              {counts.expired > 0 && (
                <span
                  className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(220,38,38,0.12)', color: 'var(--c-danger)' }}
                >
                  {counts.expired} expired
                </span>
              )}
              {counts.soon > 0 && (
                <span
                  className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(217,119,6,0.12)', color: 'var(--c-warning)' }}
                >
                  {counts.soon} expiring within 14 days
                </span>
              )}
            </div>
          )}

          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden divide-y divide-[var(--c-border)]">
            {enriched.map((it) => {
              const sty = SEV_STYLE[it.sev];
              return (
                <div key={it.key} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] uppercase tracking-wide text-[var(--c-label3)]">
                      {it.category}
                    </span>
                    <p className="text-[14px] font-semibold text-[var(--c-text)] truncate mt-0.5">
                      {it.label}
                    </p>
                    {it.detail && (
                      <p className="text-[12px] text-[var(--c-label2)] truncate mt-0.5">{it.detail}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className="text-[13px] font-semibold tabular-nums"
                      style={{ color: it.sev === 'ok' || it.sev === 'unknown' ? 'var(--c-text)' : sty.fg }}
                    >
                      {fmtDate(it.expiry)}
                    </p>
                    <p className="text-[11px] text-[var(--c-label3)] tabular-nums mt-0.5">
                      {fmtCountdown(it.days)}
                    </p>
                  </div>

                  <span
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 w-[78px] text-center"
                    style={{ background: sty.bg, color: sty.fg }}
                  >
                    {sty.label}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[12px] text-[var(--c-label3)] leading-relaxed">
            Where an item has no explicit expiry on file, the countdown uses standard validity windows
            (credit &amp; appraisal {DEFAULT_VALIDITY_DAYS.credit} days from issue). Confirm investor-specific
            requirements before relying on these dates.
          </p>
        </>
      )}
    </div>
  );
}
