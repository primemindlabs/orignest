// Phase 81 — Morning Priority Brief generation (server-only).
//
// Pipeline: gather signals from the REAL schema (leads / loan_conditions / loan_tasks /
// inbound_messages / refi_opportunities) -> build deterministic candidate BriefItems with
// stable ids + verified action routes -> optionally rewrite the copy with Haiku (graceful
// fallback to templates) -> return the top 5 by priority.
//
// Routes are computed in code (never emitted by the model) so action_payload is always a
// real Next.js href — no dead links.

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BriefItem, BriefItemActionType } from './types';

const DAY = 24 * 60 * 60 * 1000;

// action_type -> href builder. Only verified routes are referenced here.
export const ACTION_ROUTES: Record<BriefItemActionType, (leadId?: string) => string | null> = {
  view_loan: (leadId) => (leadId ? `/loans/${leadId}?focus=ai` : '/pipeline'),
  view_pipeline: () => '/pipeline',
  view_tasks: () => '/my-tasks',
  view_refi: () => '/refi-watch',
  view_inbox: () => '/inbox',
  dismiss: () => null,
};

type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  stage: string | null;
  loan_amount: number | null;
  closing_date: string | null;
  last_contacted_at: string | null;
  stage_changed_at: string | null;
};

const ACTIVE_STAGES = [
  'new_inquiry',
  'pre_qual',
  'application',
  'processing',
  'underwriting',
  'conditional_approval',
  'clear_to_close',
];

function fullName(l: { first_name: string | null; last_name: string | null }): string {
  return `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || 'Borrower';
}

function money(n: number | null | undefined): string {
  if (!n) return '';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function daysBetween(from: number, toISO: string | null): number | null {
  if (!toISO) return null;
  return Math.round((new Date(toISO).getTime() - from) / DAY);
}

/** Build deterministic candidate items from live signals. Stable ids; template copy. */
async function gatherCandidates(
  sb: SupabaseClient<any, any, any>,
  orgId: string,
  loId: string,
): Promise<BriefItem[]> {
  const now = Date.now();

  const leadsQ = sb
    .from('leads')
    .select('id, first_name, last_name, stage, loan_amount, closing_date, last_contacted_at, stage_changed_at')
    .eq('org_id', orgId)
    .eq('assigned_to', loId)
    .in('stage', ACTIVE_STAGES);

  const tasksQ = sb
    .from('loan_tasks')
    .select('id, due_date, status')
    .eq('org_id', orgId)
    .eq('assigned_to', loId)
    .in('status', ['open', 'in_progress', 'waiting_on_borrower']);

  const refiQ = sb
    .from('refi_opportunities')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('outreach_status', 'pending');

  const [{ data: leadRows }, { data: taskRows }, { count: refiCount }] = await Promise.all([
    leadsQ,
    tasksQ,
    refiQ,
  ]);

  const leads = (leadRows ?? []) as LeadRow[];
  const leadIds = leads.map((l) => l.id);

  // Uncleared conditions per lead.
  const condByLead: Record<string, number> = {};
  if (leadIds.length) {
    const { data: condRows } = await sb
      .from('loan_conditions')
      .select('lead_id, status')
      .in('lead_id', leadIds)
      .neq('status', 'cleared');
    for (const c of (condRows ?? []) as { lead_id: string; status: string }[]) {
      condByLead[c.lead_id] = (condByLead[c.lead_id] ?? 0) + 1;
    }
  }

  // Unread inbound messages on this LO's leads.
  let unreadInbox = 0;
  if (leadIds.length) {
    const { count } = await sb
      .from('inbound_messages')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('read_at', null)
      .in('lead_id', leadIds);
    unreadInbox = count ?? 0;
  }

  // ── Per-lead signals: keep the single highest-priority signal per lead ──────────
  const perLead = new Map<string, BriefItem>();
  const consider = (item: BriefItem) => {
    const existing = perLead.get(item.lead_id!);
    if (!existing || item.priority < existing.priority) perLead.set(item.lead_id!, item);
  };

  for (const l of leads) {
    const name = fullName(l);
    const amt = money(l.loan_amount);
    const closeIn = daysBetween(now, l.closing_date);
    const stalledDays = l.stage_changed_at ? Math.round((now - new Date(l.stage_changed_at).getTime()) / DAY) : null;
    const noContactDays = l.last_contacted_at ? Math.round((now - new Date(l.last_contacted_at).getTime()) / DAY) : null;
    const conds = condByLead[l.id] ?? 0;

    // 1) Closing approaching (<= 5 days)
    if (closeIn !== null && closeIn >= 0 && closeIn <= 5) {
      const urgent = closeIn <= 3;
      consider({
        id: `closing:${l.id}`,
        category: urgent ? 'urgent' : 'follow_up',
        priority: closeIn <= 2 ? 1 : closeIn <= 3 ? 2 : 3,
        headline: `${name} closes in ${closeIn === 0 ? 'today' : `${closeIn}d`}`,
        body: [amt && `${amt} loan`, `closing ${l.closing_date}`, 'confirm docs & funding'].filter(Boolean).join(' · '),
        action_label: 'Open loan',
        action_type: 'view_loan',
        action_payload: ACTION_ROUTES.view_loan(l.id),
        lead_id: l.id,
        borrower_name: name,
        loan_amount: l.loan_amount ?? undefined,
        days_until_deadline: closeIn,
      });
    }

    // 2) Many open conditions (>= 3)
    if (conds >= 3) {
      consider({
        id: `conditions:${l.id}`,
        category: 'urgent',
        priority: 2,
        headline: `${name} has ${conds} open conditions`,
        body: [amt && `${amt} loan`, `${conds} conditions outstanding`, 'clear to keep on track'].filter(Boolean).join(' · '),
        action_label: 'Review file',
        action_type: 'view_loan',
        action_payload: ACTION_ROUTES.view_loan(l.id),
        lead_id: l.id,
        borrower_name: name,
        loan_amount: l.loan_amount ?? undefined,
      });
    }

    // 3) Ghost / no contact (>= 7 days; >= 14 = urgent)
    if (noContactDays !== null && noContactDays >= 7) {
      const urgent = noContactDays >= 14;
      consider({
        id: `nocontact:${l.id}`,
        category: urgent ? 'urgent' : 'follow_up',
        priority: urgent ? 2 : 4,
        headline: `Reconnect with ${name}`,
        body: [`no contact in ${noContactDays}d`, amt && `${amt} loan`, `stage ${l.stage}`].filter(Boolean).join(' · '),
        action_label: 'Open loan',
        action_type: 'view_loan',
        action_payload: ACTION_ROUTES.view_loan(l.id),
        lead_id: l.id,
        borrower_name: name,
        loan_amount: l.loan_amount ?? undefined,
        days_until_deadline: -noContactDays,
      });
    }

    // 4) Stalled in stage (>= 7 days)
    if (stalledDays !== null && stalledDays >= 7) {
      consider({
        id: `stalled:${l.id}`,
        category: 'follow_up',
        priority: 4,
        headline: `${name} stalled ${stalledDays}d in ${l.stage}`,
        body: [amt && `${amt} loan`, `no stage movement in ${stalledDays}d`, 'nudge to next step'].filter(Boolean).join(' · '),
        action_label: 'Open loan',
        action_type: 'view_loan',
        action_payload: ACTION_ROUTES.view_loan(l.id),
        lead_id: l.id,
        borrower_name: name,
        loan_amount: l.loan_amount ?? undefined,
      });
    }
  }

  const items: BriefItem[] = [...perLead.values()];

  // ── Aggregate signals (not lead-specific) ──────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const dueTasks = (taskRows ?? []).filter(
    (t: { due_date: string | null }) => t.due_date && t.due_date <= today,
  ).length;
  if (dueTasks > 0) {
    items.push({
      id: 'tasks-due',
      category: 'follow_up',
      priority: 2,
      headline: `${dueTasks} task${dueTasks === 1 ? '' : 's'} due today`,
      body: 'Work your task queue to keep files moving',
      action_label: 'View tasks',
      action_type: 'view_tasks',
      action_payload: ACTION_ROUTES.view_tasks(),
    });
  }

  if (unreadInbox > 0) {
    items.push({
      id: 'inbox-unread',
      category: 'follow_up',
      priority: 2,
      headline: `${unreadInbox} unread borrower message${unreadInbox === 1 ? '' : 's'}`,
      body: 'Reply quickly — speed-to-response drives pull-through',
      action_label: 'Open inbox',
      action_type: 'view_inbox',
      action_payload: ACTION_ROUTES.view_inbox(),
    });
  }

  if ((refiCount ?? 0) > 0) {
    items.push({
      id: 'refi-pending',
      category: 'opportunity',
      priority: 3,
      headline: `${refiCount} refi opportunit${refiCount === 1 ? 'y' : 'ies'} to work`,
      body: 'Past clients who could lower their rate — reach out today',
      action_label: 'View refi',
      action_type: 'view_refi',
      action_payload: ACTION_ROUTES.view_refi(),
    });
  }

  return items;
}

/** Optionally rewrite headline/body with Haiku. Falls back to template copy on any error. */
async function enhanceCopy(items: BriefItem[]): Promise<BriefItem[]> {
  if (!items.length || !process.env.ANTHROPIC_API_KEY) return items;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const payload = items.map((i) => ({
      id: i.id,
      category: i.category,
      borrower: i.borrower_name ?? null,
      loan_amount: i.loan_amount ?? null,
      days: i.days_until_deadline ?? null,
      current_headline: i.headline,
      current_body: i.body,
    }));

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 700,
      system:
        'You are Ashley IQ, an assistant for mortgage loan officers. Rewrite each brief item to be punchy and action-oriented. ' +
        'Rules: headline <= 60 chars and starts with a verb where natural; body <= 120 chars with specific context; ' +
        'never invent facts not present in the input; keep the borrower name if given. ' +
        'Return ONLY a JSON array of {"id","headline","body"} — no prose, no markdown.',
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    });

    const block = msg.content[0];
    const raw = block.type === 'text' ? block.text : '';
    const json = raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1);
    const rewritten = JSON.parse(json) as { id: string; headline?: string; body?: string }[];
    const byId = new Map(rewritten.map((r) => [r.id, r]));

    return items.map((i) => {
      const r = byId.get(i.id);
      return {
        ...i,
        headline: (r?.headline || i.headline).slice(0, 60),
        body: (r?.body || i.body).slice(0, 120),
      };
    });
  } catch {
    return items; // AI unavailable -> ship the deterministic template copy
  }
}

/** Generate today's brief items for one LO (top 5 by priority). */
export async function generateBriefItems(
  sb: SupabaseClient<any, any, any>,
  orgId: string,
  loId: string,
): Promise<BriefItem[]> {
  const candidates = await gatherCandidates(sb, orgId, loId);
  candidates.sort((a, b) => a.priority - b.priority || (a.days_until_deadline ?? 99) - (b.days_until_deadline ?? 99));
  const top = candidates.slice(0, 5);
  return enhanceCopy(top);
}
