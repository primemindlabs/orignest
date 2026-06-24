/**
 * Phase 144 — Concierge agent tools + executors. SERVER-ONLY.
 *
 * Four narrow tools. Each executor only ever writes safe, reversible things (lead
 * fields, an LO task, an activity row); none sends anything to the borrower — the
 * engine owns sending so the TCPA gate + compliance guard always run first.
 */
import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConciergeContext } from '@/lib/concierge/types';

export const CONCIERGE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'qualify',
    description: "Save qualifying facts the borrower shares about their loan. Call whenever you learn any of these. Don't ask for all at once.",
    input_schema: {
      type: 'object' as const,
      properties: {
        loan_purpose: { type: 'string', enum: ['purchase', 'refinance', 'cash_out', 'heloc', 'other'], description: 'What the borrower wants to do' },
        timeline: { type: 'string', description: "The borrower's stated timeline, e.g. 'ASAP', 'in 3 months', 'just looking'" },
        property_state: { type: 'string', description: 'Two-letter state of the property, if mentioned' },
        loan_amount: { type: 'number', description: "A loan/purchase amount the borrower themselves states (we store it; do not quote it back as an offer)" },
        notes: { type: 'string', description: 'Any other useful context to save for the loan officer' },
      },
      required: [],
    },
  },
  {
    name: 'book_appointment',
    description: 'Use when the borrower wants to talk to the loan officer or schedule a call. Returns a booking link to share if one is configured.',
    input_schema: {
      type: 'object' as const,
      properties: { preferred_time: { type: 'string', description: "The borrower's stated availability, if any" } },
      required: [],
    },
  },
  {
    name: 'start_application',
    description: 'Use when the borrower is ready to start their loan application. Returns the application link to share.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'escalate_to_human',
    description: 'Hand the conversation to the human loan officer. Use for anything rate/quote/approval-specific, complaints, legal/disputes, an explicit request for a person, or when you are unsure.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: { type: 'string', description: 'Brief reason for the handoff' },
        category: { type: 'string', enum: ['rate_or_quote', 'complaint', 'legal', 'complex', 'explicit_request', 'other'] },
      },
      required: ['reason'],
    },
  },
];

type Admin = SupabaseClient<any, any, any>;

const QUALIFY_FIELDS = new Set(['loan_purpose', 'timeline', 'property_state', 'loan_amount']);

export interface ToolExecResult {
  result: Record<string, unknown>;
  escalate?: { reason: string; category?: string };
}

export async function executeConciergeTool(
  sb: Admin,
  ctx: ConciergeContext,
  name: string,
  input: Record<string, unknown>,
): Promise<ToolExecResult> {
  switch (name) {
    case 'qualify': {
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input)) {
        if (QUALIFY_FIELDS.has(k) && v != null && v !== '') patch[k] = v;
      }
      if (Object.keys(patch).length) {
        await sb.from('leads').update(patch).eq('id', ctx.leadId).eq('org_id', ctx.orgId).then(() => undefined, () => undefined);
      }
      await logActivity(sb, ctx, 'concierge_qualify', `AI captured: ${JSON.stringify(input).slice(0, 300)}`);
      return { result: { saved: true, fields: Object.keys(patch) } };
    }

    case 'book_appointment': {
      await createLoTask(sb, ctx, `${ctx.borrowerFirstName} wants to schedule a call`,
        `Ashley Concierge: borrower asked to talk${input.preferred_time ? ` (availability: ${String(input.preferred_time)})` : ''}.`);
      await logActivity(sb, ctx, 'concierge_book_appointment', `Borrower requested a call. ${input.preferred_time ?? ''}`);
      return { result: { booking_url: ctx.settings.booking_url ?? null } };
    }

    case 'start_application': {
      await createLoTask(sb, ctx, `${ctx.borrowerFirstName} is ready to apply`,
        'Ashley Concierge: borrower wants to start their application.');
      await logActivity(sb, ctx, 'concierge_start_application', 'Borrower ready to apply.');
      return { result: { application_url: ctx.settings.application_url ?? null } };
    }

    case 'escalate_to_human': {
      const reason = String(input.reason ?? 'AI requested human handoff');
      const category = input.category ? String(input.category) : undefined;
      await createLoTask(sb, ctx, `Take over chat with ${ctx.borrowerFirstName}`,
        `Ashley Concierge handed this conversation back. Reason: ${reason}${category ? ` [${category}]` : ''}.`);
      return { result: { escalated: true }, escalate: { reason, category } };
    }

    default:
      return { result: { error: `Unknown tool ${name}` } };
  }
}

async function createLoTask(sb: Admin, ctx: ConciergeContext, title: string, description: string): Promise<void> {
  await sb.from('lead_tasks').insert({
    lead_id: ctx.leadId, org_id: ctx.orgId, assigned_to: ctx.loId,
    title, description, priority: 'high', completed: false, due_date: new Date().toISOString(),
  }).then(() => undefined, () => undefined);
}

async function logActivity(sb: Admin, ctx: ConciergeContext, action: string, description: string): Promise<void> {
  await sb.from('lead_activities').insert({
    lead_id: ctx.leadId, org_id: ctx.orgId, actor_id: null, action, description,
    metadata: {} as Record<string, unknown>,
  }).then(() => undefined, () => undefined);
}
