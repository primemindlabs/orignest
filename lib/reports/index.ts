// Mortgage call reports — computed directly from base tables (no DB views, so
// it works without an applied migration). Adapted to the real schema:
// leads.stage (not status), lead_source, loan_purpose values
// (rate_term_refinance/cash_out_refinance), referral_partner_id.

import type { SupabaseClient } from '@supabase/supabase-js';

type SB = SupabaseClient<any, any, any>;
export type ReportType = 'production' | 'pl' | 'hmda' | 'velocity' | 'compliance' | 'referral' | 'scorecard' | 'fallout';
export const ALLOWED_REPORT_TYPES: ReportType[] = ['production', 'pl', 'hmda', 'velocity', 'compliance', 'referral', 'scorecard', 'fallout'];

const REFI = ['rate_term_refinance', 'cash_out_refinance'];

interface LeadRow {
  id: string; assigned_to: string | null; stage: string; loan_type: string | null;
  loan_purpose: string | null; loan_amount: number | null; estimated_value: number | null;
  closed_date: string | null; created_at: string; application_submitted_at: string | null;
  first_contacted_at: string | null; lead_source: string | null; referral_partner_id: string | null;
  property_state: string | null; sms_consent: boolean | null; first_name: string; last_name: string;
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return (new Date(a).getTime() - new Date(b).getTime()) / 86400000;
}
function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function loanVal(l: LeadRow): number {
  return Number(l.loan_amount ?? l.estimated_value ?? 0);
}

async function fetchLeads(sb: SB, orgId: string): Promise<{ leads: LeadRow[]; nameById: Record<string, string> }> {
  const { data: leads } = await sb
    .from('leads')
    .select('id, assigned_to, stage, loan_type, loan_purpose, loan_amount, estimated_value, closed_date, created_at, application_submitted_at, first_contacted_at, lead_source, referral_partner_id, property_state, sms_consent, first_name, last_name')
    .eq('org_id', orgId);
  const { data: profiles } = await sb.from('profiles').select('id, first_name, last_name').eq('org_id', orgId);
  const nameById: Record<string, string> = {};
  for (const p of profiles ?? []) nameById[p.id as string] = `${p.first_name as string} ${p.last_name as string}`.trim();
  return { leads: (leads ?? []) as LeadRow[], nameById };
}

function inClosedRange(l: LeadRow, start: string, end: string): boolean {
  return l.stage === 'closed' && !!l.closed_date && l.closed_date >= start && l.closed_date <= end;
}
function inCreatedRange(l: LeadRow, start: string, end: string): boolean {
  const d = l.created_at.slice(0, 10);
  return d >= start && d <= end;
}

export async function runReport(sb: SB, type: ReportType, orgId: string, start: string, end: string, loId: string | null) {
  const { leads, nameById } = await fetchLeads(sb, orgId);
  const scoped = loId ? leads.filter((l) => l.assigned_to === loId) : leads;

  switch (type) {
    case 'production': {
      const closed = scoped.filter((l) => inClosedRange(l, start, end));
      const byLo: Record<string, { name: string; units: number; volume: number }> = {};
      const byType: Record<string, { units: number; volume: number }> = {};
      for (const l of closed) {
        const lo = l.assigned_to ?? 'unassigned';
        byLo[lo] ??= { name: nameById[lo] ?? 'Unassigned', units: 0, volume: 0 };
        byLo[lo].units++; byLo[lo].volume += loanVal(l);
        const t = l.loan_type ?? 'other';
        byType[t] ??= { units: 0, volume: 0 };
        byType[t].units++; byType[t].volume += loanVal(l);
      }
      const volume = closed.reduce((s, l) => s + loanVal(l), 0);
      const purchaseUnits = closed.filter((l) => l.loan_purpose === 'purchase').length;
      const refiUnits = closed.filter((l) => l.loan_purpose && REFI.includes(l.loan_purpose)).length;
      return {
        totals: { units: closed.length, volume, avgLoanSize: closed.length ? Math.round(volume / closed.length) : 0, purchaseUnits, refiUnits },
        byLo: Object.values(byLo).sort((a, b) => b.volume - a.volume),
        byType: Object.entries(byType).map(([loan_type, v]) => ({ loan_type, ...v })).sort((a, b) => b.volume - a.volume),
      };
    }

    case 'velocity': {
      const closed = scoped.filter((l) => inClosedRange(l, start, end));
      const toClose = closed.map((l) => daysBetween(l.closed_date, l.created_at)).filter((n): n is number => n != null);
      const leadToApp = closed.map((l) => daysBetween(l.application_submitted_at, l.created_at)).filter((n): n is number => n != null);
      const appToClose = closed.map((l) => daysBetween(l.closed_date, l.application_submitted_at)).filter((n): n is number => n != null);
      const avg = (a: number[]) => (a.length ? Math.round((a.reduce((s, n) => s + n, 0) / a.length) * 10) / 10 : 0);
      return {
        sample: closed.length,
        avgDaysToClose: avg(toClose),
        medianDaysToClose: Math.round(median(toClose) * 10) / 10,
        avgDaysLeadToApp: avg(leadToApp),
        avgDaysAppToClose: avg(appToClose),
      };
    }

    case 'referral': {
      const inPeriod = leads.filter((l) => inCreatedRange(l, start, end));
      const { data: partners } = await sb.from('referral_partners').select('id, first_name, last_name, company_name').eq('org_id', orgId);
      const partnerName: Record<string, string> = {};
      for (const p of partners ?? []) partnerName[p.id as string] = (`${p.first_name as string} ${p.last_name as string}`.trim() || (p.company_name as string));
      const bySource: Record<string, { source: string; received: number; closed: number; volume: number }> = {};
      for (const l of inPeriod) {
        const src = l.referral_partner_id ? `Partner: ${partnerName[l.referral_partner_id] ?? 'Unknown'}` : (l.lead_source ?? 'unknown');
        bySource[src] ??= { source: src, received: 0, closed: 0, volume: 0 };
        bySource[src].received++;
        if (l.stage === 'closed') { bySource[src].closed++; bySource[src].volume += loanVal(l); }
      }
      return {
        rows: Object.values(bySource)
          .map((r) => ({ ...r, conversionRate: r.received ? Math.round((r.closed / r.received) * 100) : 0 }))
          .sort((a, b) => b.volume - a.volume || b.closed - a.closed),
      };
    }

    case 'compliance': {
      const inPeriod = leads.filter((l) => inCreatedRange(l, start, end));
      const flags: Array<{ severity: string; type: string; description: string; lead_id?: string }> = [];
      for (const l of inPeriod) {
        if (!l.sms_consent) flags.push({ severity: 'high', type: 'tcpa_missing', description: `No SMS/TCPA consent on file: ${l.first_name} ${l.last_name}`, lead_id: l.id });
      }
      return {
        flags: flags.slice(0, 200),
        flagCount: flags.length,
        highSeverity: flags.filter((f) => f.severity === 'high').length,
        mediumSeverity: flags.filter((f) => f.severity === 'medium').length,
        period: { start, end },
        notes: ['RESPA LE-deadline and CROA checks activate once those modules track issuance dates.'],
      };
    }

    case 'scorecard': {
      // Per-LO performance. If loId set, just that LO.
      const los = loId ? [loId] : Array.from(new Set(leads.map((l) => l.assigned_to).filter((x): x is string => !!x)));
      let conditionsByLead: Record<string, number> = {};
      try {
        const { data: conds } = await sb.from('loan_conditions').select('lead_id, status').eq('org_id', orgId).neq('status', 'cleared');
        for (const c of conds ?? []) conditionsByLead[c.lead_id as string] = (conditionsByLead[c.lead_id as string] ?? 0) + 1;
      } catch { conditionsByLead = {}; }

      const rows = los.map((lo) => {
        const mine = leads.filter((l) => l.assigned_to === lo);
        const appsReceived = mine.filter((l) => inCreatedRange(l, start, end)).length;
        const closed = mine.filter((l) => inClosedRange(l, start, end));
        const respTimes = mine.map((l) => daysBetween(l.first_contacted_at, l.created_at)).filter((n): n is number => n != null && n >= 0);
        const avgResponseMin = respTimes.length ? Math.round((respTimes.reduce((s, n) => s + n, 0) / respTimes.length) * 24 * 60) : null;
        const toClose = closed.map((l) => daysBetween(l.closed_date, l.created_at)).filter((n): n is number => n != null);
        const outstanding = mine.reduce((s, l) => s + (conditionsByLead[l.id] ?? 0), 0);
        return {
          lo_id: lo, lo_name: nameById[lo] ?? 'Unknown',
          appsReceived, loansClosed: closed.length,
          closingRate: appsReceived ? Math.round((closed.length / appsReceived) * 100) : 0,
          avgDaysToClose: toClose.length ? Math.round((toClose.reduce((s, n) => s + n, 0) / toClose.length) * 10) / 10 : 0,
          avgResponseMinutes: avgResponseMin,
          outstandingConditions: outstanding,
        };
      }).sort((a, b) => b.loansClosed - a.loansClosed);
      return { rows };
    }

    case 'fallout': {
      // Cohort = leads created in the period. Measure how they resolved, the
      // fallout rate (declined+withdrawn), and the pull-through rate (funded /
      // decisioned). Pull-through is a core call-report KPI.
      const cohort = scoped.filter((l) => inCreatedRange(l, start, end));
      const closed = cohort.filter((l) => l.stage === 'closed');
      const declined = cohort.filter((l) => l.stage === 'declined');
      const withdrawn = cohort.filter((l) => l.stage === 'withdrawn');
      const active = cohort.filter((l) => !['closed', 'declined', 'withdrawn'].includes(l.stage));
      const decisioned = closed.length + declined.length + withdrawn.length;
      const lostUnits = declined.length + withdrawn.length;

      // Fallout grouped by loan type (where loans are dying).
      const byType: Record<string, { loan_type: string; closed: number; lost: number; lostVolume: number }> = {};
      for (const l of cohort) {
        const t = l.loan_type ?? 'other';
        byType[t] ??= { loan_type: t, closed: 0, lost: 0, lostVolume: 0 };
        if (l.stage === 'closed') byType[t].closed++;
        if (l.stage === 'declined' || l.stage === 'withdrawn') { byType[t].lost++; byType[t].lostVolume += loanVal(l); }
      }

      // Fallout grouped by lead source.
      const bySource: Record<string, { source: string; lost: number; closed: number }> = {};
      for (const l of cohort) {
        const src = l.lead_source ?? 'unknown';
        bySource[src] ??= { source: src, lost: 0, closed: 0 };
        if (l.stage === 'closed') bySource[src].closed++;
        if (l.stage === 'declined' || l.stage === 'withdrawn') bySource[src].lost++;
      }

      return {
        totals: {
          cohort: cohort.length,
          closed: closed.length,
          declined: declined.length,
          withdrawn: withdrawn.length,
          active: active.length,
          lostVolume: lostUnits ? (declined.concat(withdrawn)).reduce((s, l) => s + loanVal(l), 0) : 0,
          falloutRate: decisioned ? Math.round((lostUnits / decisioned) * 100) : 0,
          pullThroughRate: decisioned ? Math.round((closed.length / decisioned) * 100) : 0,
        },
        byType: Object.values(byType)
          .map((r) => ({ ...r, falloutRate: r.closed + r.lost ? Math.round((r.lost / (r.closed + r.lost)) * 100) : 0 }))
          .sort((a, b) => b.lost - a.lost),
        bySource: Object.values(bySource).sort((a, b) => b.lost - a.lost),
      };
    }

    case 'pl': {
      // Depends on Payroll (pay_run_items). Degrade gracefully if not present/empty.
      try {
        const { data: items, error } = await sb
          .from('pay_run_items')
          .select('loan_amount, gross_comp, net_comp, close_date')
          .eq('org_id', orgId)
          .gte('close_date', start).lte('close_date', end);
        if (error) throw error;
        const rows = (items ?? []).map((i) => ({ gross: Number(i.gross_comp ?? 0), lo: Number(i.net_comp ?? 0) }));
        const gross = rows.reduce((s, r) => s + r.gross, 0);
        const loComp = rows.reduce((s, r) => s + r.lo, 0);
        return { available: true, totals: { grossRevenue: gross, totalLoComp: loComp, branchProfit: gross - loComp, marginPct: gross ? Math.round(((gross - loComp) / gross) * 100) : 0 }, count: rows.length };
      } catch {
        return { available: false, note: 'P&L requires the Payroll module. Once pay runs are recorded, branch revenue and margin appear here.' };
      }
    }

    case 'hmda': {
      // Depends on POS applications. Degrade gracefully if not present.
      try {
        const { data, error } = await sb
          .from('pos_applications')
          .select('id, app_reference, loan_amount, loan_purpose, property_type, property_state, demographics, submitted_at, status')
          .eq('org_id', orgId)
          .gte('submitted_at', start).lte('submitted_at', `${end}T23:59:59`)
          .order('submitted_at');
        if (error) throw error;
        const issues: string[] = [];
        for (const a of data ?? []) {
          const ref = (a.app_reference as string) ?? (a.id as string);
          if (!a.loan_amount) issues.push(`${ref}: missing loan amount`);
          if (!a.property_state) issues.push(`${ref}: missing property state`);
          const demo = a.demographics as Record<string, unknown> | null;
          if (!demo?.race && !demo?.ethnicity) issues.push(`${ref}: demographic info not collected (HMDA required)`);
        }
        return { available: true, applications: data ?? [], total: (data ?? []).length, hmdaIssues: issues, readyForFiling: issues.length === 0 };
      } catch {
        return { available: false, note: 'HMDA pre-report requires the POS module (application demographics). It activates once applications are submitted.' };
      }
    }
  }
}
