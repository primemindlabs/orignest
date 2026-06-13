// Phase 108 — compute the branch dashboard LIVE from profiles / leads / trid_events.
// No snapshot tables, no cron. Org-scoped; "team" = all LOs in the org.
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BranchDashboardData,
  LOProfileSummary,
  TRIDAlertItem,
  ProductionTrendPoint,
} from '@/types/branch-manager';

type Admin = SupabaseClient<any, any, any>;
const DAY = 86_400_000;

const ACTIVE = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];
const PIPELINE = ['application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];

const dateStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function mondayOf(d: Date): string {
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  return m.toISOString().slice(0, 10);
}

export async function computeBranchData(sb: Admin, orgId: string): Promise<BranchDashboardData> {
  const now = Date.now();
  const cut30 = dateStr(now - 30 * DAY);
  const cut90 = dateStr(now - 90 * DAY);
  const cut84 = dateStr(now - 84 * DAY);

  const [{ data: profiles }, { data: leads }, { data: tridOpen }] = await Promise.all([
    sb.from('profiles').select('id, first_name, last_name, email, avatar_url, nmls_id').eq('org_id', orgId),
    sb.from('leads').select('id, assigned_to, stage, loan_amount, closed_date, created_at, last_name').eq('org_id', orgId).is('archived_at', null),
    sb.from('trid_events').select('id, lead_id, user_id, event_type, deadline_date, is_compliant').eq('org_id', orgId).eq('is_compliant', false),
  ]);

  const profById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const nameOf = (id: string | null) => {
    const p = id ? profById.get(id) : null;
    return p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unassigned' : 'Unassigned';
  };

  // ── Per-LO accumulator ──────────────────────────────────────────────────────
  type Acc = {
    leads_active: number; loans_in_pipeline: number; loans_funded_30d: number;
    pipeline_value: number; trid_alerts_open: number;
    closeDays: number[]; created90: number; funded90: number;
  };
  const acc = new Map<string, Acc>();
  const ensure = (id: string): Acc => {
    let a = acc.get(id);
    if (!a) { a = { leads_active: 0, loans_in_pipeline: 0, loans_funded_30d: 0, pipeline_value: 0, trid_alerts_open: 0, closeDays: [], created90: 0, funded90: 0 }; acc.set(id, a); }
    return a;
  };

  // Seed every org LO so 0-lead LOs still show.
  for (const p of profiles ?? []) ensure(p.id as string);

  for (const l of leads ?? []) {
    const id = (l.assigned_to as string | null) ?? null;
    if (!id || !profById.has(id)) continue; // only org LOs
    const a = ensure(id);
    const stage = l.stage as string;
    const amt = Number(l.loan_amount ?? 0);
    if (ACTIVE.includes(stage)) { a.leads_active++; a.pipeline_value += amt; }
    if (PIPELINE.includes(stage)) a.loans_in_pipeline++;
    const closed = (l.closed_date as string | null) ?? null;
    if (l.created_at && (l.created_at as string).slice(0, 10) >= cut90) a.created90++;
    if (stage === 'closed' && closed) {
      if (closed >= cut30) a.loans_funded_30d++;
      if (closed >= cut90) {
        a.funded90++;
        if (l.created_at) {
          const d = Math.round((new Date(closed).getTime() - new Date(l.created_at as string).getTime()) / DAY);
          if (Number.isFinite(d) && d >= 0) a.closeDays.push(d);
        }
      }
    }
  }

  // TRID open counts per LO.
  for (const t of tridOpen ?? []) {
    const id = (t.user_id as string | null) ?? null;
    if (id && acc.has(id)) ensure(id).trid_alerts_open++;
  }

  const team: LOProfileSummary[] = (profiles ?? [])
    .map((p) => {
      const a = ensure(p.id as string);
      return {
        lo_id: p.id as string,
        name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unnamed',
        email: (p.email as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
        nmls_id: (p.nmls_id as string | null) ?? null,
        metrics: {
          leads_active: a.leads_active,
          loans_in_pipeline: a.loans_in_pipeline,
          loans_funded_30d: a.loans_funded_30d,
          pipeline_value: a.pipeline_value,
          trid_alerts_open: a.trid_alerts_open,
          avg_days_to_close: a.closeDays.length ? Math.round((a.closeDays.reduce((s, x) => s + x, 0) / a.closeDays.length) * 10) / 10 : null,
          conversion_rate: a.created90 > 0 ? Math.round((a.funded90 / a.created90) * 10000) / 10000 : null,
        },
      };
    })
    .filter((lo) => lo.metrics.leads_active > 0 || lo.metrics.loans_funded_30d > 0 || lo.metrics.pipeline_value > 0)
    .sort((x, y) => y.metrics.pipeline_value - x.metrics.pipeline_value);

  // ── Aggregate ───────────────────────────────────────────────────────────────
  const aggregate = {
    total_active_leads: team.reduce((s, t) => s + t.metrics.leads_active, 0),
    total_pipeline_value: team.reduce((s, t) => s + t.metrics.pipeline_value, 0),
    total_funded_30d: team.reduce((s, t) => s + t.metrics.loans_funded_30d, 0),
    total_trid_alerts: (tridOpen ?? []).length,
    lo_count: team.length,
  };

  // ── TRID alerts (team-wide) ─────────────────────────────────────────────────
  const leadById = new Map((leads ?? []).map((l) => [l.id as string, l]));
  const alerts: TRIDAlertItem[] = (tridOpen ?? [])
    .map((t) => {
      const lead = leadById.get(t.lead_id as string);
      const due = (t.deadline_date as string | null) ?? null;
      return {
        id: t.id as string,
        lead_id: t.lead_id as string,
        lo_name: nameOf((t.user_id as string | null) ?? (lead?.assigned_to as string | null) ?? null),
        borrower_last_name: (lead?.last_name as string | null) ?? '—',
        alert_type: (t.event_type as string | null) ?? 'trid',
        due_date: due,
        days_overdue: due ? Math.floor((now - new Date(due).getTime()) / DAY) : 0,
      };
    })
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
    .slice(0, 50);

  // ── 12-week production trend (from closed_date) ─────────────────────────────
  const weekMap = new Map<string, { funded: number; pipeline_value: number }>();
  for (const l of leads ?? []) {
    const closed = (l.closed_date as string | null) ?? null;
    if (l.stage !== 'closed' || !closed || closed < cut84) continue;
    const wk = mondayOf(new Date(closed + 'T00:00:00Z'));
    const e = weekMap.get(wk) ?? { funded: 0, pipeline_value: 0 };
    e.funded++;
    e.pipeline_value += Number(l.loan_amount ?? 0);
    weekMap.set(wk, e);
  }
  const trend: ProductionTrendPoint[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([week, d]) => ({ week, funded: d.funded, pipeline_value: d.pipeline_value }));

  return { aggregate, team, alerts, trend };
}
