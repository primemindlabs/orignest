/**
 * Phase 79 — one-sentence AI insight for the active lead in the dialer (Claude
 * Haiku). Non-blocking from the UI's perspective: the call panel renders first
 * and the insight slots in when ready. No financial specifics (rates, income,
 * credit) — coaching tone only, mirroring the post-call summary guardrails.
 */
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'claude-haiku-4-5';

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const { leadId } = (await req.json().catch(() => ({}))) as { leadId?: string };
  if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('first_name, last_name, stage, last_contacted_at, stage_changed_at, closing_date')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ insight: null });

  // Open conditions + most recent call note for context.
  const { count: openConditions } = await sb
    .from('loan_conditions')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId)
    .not('status', 'in', '("satisfied","cleared","waived")');

  const { data: lastNote } = await sb
    .from('call_log')
    .select('notes, created_at')
    .eq('lead_id', leadId)
    .not('notes', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sinceContact = daysSince(lead.last_contacted_at);
  const sinceStage = daysSince(lead.stage_changed_at);

  // Without an API key we still return a useful deterministic insight (no mock LLM call).
  const fallback = buildFallback(lead.first_name, lead.stage, sinceContact, sinceStage, openConditions ?? 0, lead.closing_date);
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ insight: fallback });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 80,
      messages: [
        {
          role: 'user',
          content: `You are a mortgage loan officer's calling assistant. In ONE sentence (max 22 words), tell the LO why to prioritize this call and what to lead with. No rates, income, or credit figures. No preamble.
Borrower: ${lead.first_name}
Stage: ${lead.stage}
Days since last contact: ${sinceContact ?? 'unknown'}
Days in current stage: ${sinceStage ?? 'unknown'}
Open conditions: ${openConditions ?? 0}
Closing date: ${lead.closing_date ?? 'not set'}
Last call note: ${lastNote?.notes ? String(lastNote.notes).slice(0, 200) : 'none'}`,
        },
      ],
    });
    const block = res.content[0];
    const insight = block && block.type === 'text' ? block.text.trim() : '';
    return NextResponse.json({ insight: insight || fallback });
  } catch (err) {
    console.error('[dialer/insight] failed', err);
    return NextResponse.json({ insight: fallback });
  }
}

function buildFallback(
  name: string,
  stage: string,
  sinceContact: number | null,
  sinceStage: number | null,
  openConditions: number,
  closingDate: string | null
): string {
  if (closingDate) {
    const days = Math.ceil((Date.parse(closingDate) - Date.now()) / 86_400_000);
    if (!Number.isNaN(days) && days >= 0 && days <= 3) {
      return `${name} is closing ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`} — confirm final items and keep momentum.`;
    }
  }
  if (sinceContact != null && sinceContact >= 14) {
    return `${name} hasn't been contacted in ${sinceContact} days — re-engage warmly and confirm they still want to move forward.`;
  }
  if (openConditions >= 3) {
    return `${name} has ${openConditions} open conditions — walk through what's outstanding and set clear next steps.`;
  }
  if (sinceStage != null && sinceStage >= 5) {
    return `${name} has been in ${stage.replace(/_/g, ' ')} for ${sinceStage} days — check for blockers and nudge the file forward.`;
  }
  return `Check in with ${name} on where things stand in ${stage.replace(/_/g, ' ')} and agree the next step.`;
}
