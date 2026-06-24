/**
 * Phase 149 — Mortgage Call Report (MCR) computation. SERVER-ONLY.
 *
 * Aggregates the NMLS MCR "Residential Mortgage Loan Activity" (RMLA, Section AC1)
 * figures for a quarter from the leads/loans table: applications received, approved/
 * closed, denied, withdrawn, and still in process — each as a count + dollar volume,
 * broken down by state (MCR is filed per licensed state) and by loan type. This is a
 * filing WORKSHEET to assist the NMLS submission, not an auto-filed report.
 *
 * Attribution: applications by application date (application_submitted_at ?? created_at);
 * closed loans by closed_date. Denied/withdrawn are attributed by application date
 * (we don't capture a separate decision date yet) — noted in the export header.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

type Admin = SupabaseClient<any, any, any>;

export type LoanTypeBucket = 'Conventional' | 'FHA' | 'VA' | 'USDA' | 'Other';

export interface McrCell { received: number; received_amount: number; closed: number; closed_amount: number; denied: number; withdrawn: number; in_process: number }
export interface McrBreakdown extends McrCell { key: string }
export interface McrReport {
  year: number; quarter: number; period: { start: string; end: string };
  totals: McrCell;
  byState: McrBreakdown[];
  byLoanType: McrBreakdown[];
  note: string;
}

function bucket(loanType: string | null): LoanTypeBucket {
  const s = (loanType ?? '').toLowerCase();
  if (s.includes('fha')) return 'FHA';
  if (s.includes('va')) return 'VA';
  if (s.includes('usda') || s.includes('rhs') || s.includes('rural')) return 'USDA';
  if (!s) return 'Other';
  return 'Conventional';
}

function quarterBounds(year: number, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3; // 0,3,6,9
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0)); // last day of the quarter
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const emptyCell = (): McrCell => ({ received: 0, received_amount: 0, closed: 0, closed_amount: 0, denied: 0, withdrawn: 0, in_process: 0 });

export async function computeMcr(sb: Admin, orgId: string, year: number, quarter: number): Promise<McrReport> {
  const { start, end } = quarterBounds(year, quarter);

  const { data: leads } = await sb
    .from('leads')
    .select('stage, loan_type, loan_amount, property_state, created_at, closed_date, application_submitted_at')
    .eq('org_id', orgId);

  const totals = emptyCell();
  const stateMap = new Map<string, McrCell>();
  const typeMap = new Map<string, McrCell>();
  const bump = (map: Map<string, McrCell>, key: string): McrCell => {
    let c = map.get(key); if (!c) { c = emptyCell(); map.set(key, c); } return c;
  };

  for (const l of (leads ?? []) as Record<string, any>[]) {
    const appDate = ((l.application_submitted_at as string | null) ?? (l.created_at as string) ?? '').slice(0, 10);
    const closeDate = ((l.closed_date as string | null) ?? '').slice(0, 10);
    const amount = Number(l.loan_amount) || 0;
    const state = (l.property_state as string | null)?.toUpperCase() || 'Unknown';
    const lt = bucket(l.loan_type as string | null);
    const stage = String(l.stage ?? '');

    const receivedThisQ = appDate >= start && appDate <= end;
    const closedThisQ = stage === 'closed' && closeDate >= start && closeDate <= end;
    const inProcessAtEnd = !['closed', 'declined', 'withdrawn'].includes(stage) && appDate <= end && appDate >= '0001-01-01';

    const apply = (cell: McrCell) => {
      if (receivedThisQ) { cell.received++; cell.received_amount += amount; }
      if (closedThisQ) { cell.closed++; cell.closed_amount += amount; }
      if (receivedThisQ && stage === 'declined') cell.denied++;
      if (receivedThisQ && stage === 'withdrawn') cell.withdrawn++;
      if (inProcessAtEnd) cell.in_process++;
    };
    apply(totals);
    apply(bump(stateMap, state));
    apply(bump(typeMap, lt));
  }

  const toRows = (m: Map<string, McrCell>): McrBreakdown[] =>
    [...m.entries()].map(([key, c]) => ({ key, ...c })).sort((a, b) => (b.received + b.closed) - (a.received + a.closed));

  return {
    year, quarter, period: { start, end }, totals,
    byState: toRows(stateMap), byLoanType: toRows(typeMap),
    note: 'Worksheet to assist NMLS MCR (RMLA) filing — not auto-filed. Applications attributed by application date; closed loans by close date; denied/withdrawn by application date (no separate decision date captured).',
  };
}

export function mcrToCsv(r: McrReport, orgName: string): string {
  const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const cols = ['Breakdown', 'Apps received', 'Apps received $', 'Loans closed', 'Loans closed $', 'Denied', 'Withdrawn', 'In process (period end)'];
  const lines = [`# ${orgName} — MCR RMLA worksheet — Q${r.quarter} ${r.year} (${r.period.start} to ${r.period.end})`, `# ${r.note}`, cols.map(esc).join(',')];
  const row = (label: string, c: McrCell) => [label, c.received, Math.round(c.received_amount), c.closed, Math.round(c.closed_amount), c.denied, c.withdrawn, c.in_process].map(esc).join(',');
  lines.push(row('TOTAL', r.totals));
  lines.push('');
  lines.push('# By state'); for (const s of r.byState) lines.push(row(s.key, s));
  lines.push('');
  lines.push('# By loan type'); for (const t of r.byLoanType) lines.push(row(t.key, t));
  return lines.join('\n') + '\n';
}
