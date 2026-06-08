import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const RATE_LIMIT_PER_HOUR = 30;

type FieldType = 'note' | 'email' | 'sms' | 'task';
type ContextType =
  | 'draft_followup'
  | 'summarize_call'
  | 'write_intro_email'
  | 'rate_explanation'
  | 'custom';

interface ComposeRequest {
  fieldType: FieldType;
  contextType: ContextType;
  leadId?: string;
  existingText?: string;
  customPrompt?: string;
}

const SYSTEM_PROMPTS: Record<FieldType, string> = {
  note: `You are a mortgage loan officer assistant writing professional internal notes. Be concise, factual, and RESPA/compliance-safe. No opinions, only facts. Write in first-person LO voice.`,
  email: `You are a mortgage loan officer assistant drafting professional emails to borrowers. Be warm, helpful, and compliant with TRID/RESPA. No financial promises. Use plain language. Keep under 200 words unless requested. Sign off as the LO.`,
  sms: `You are a mortgage loan officer assistant drafting SMS messages to borrowers. TCPA compliant — include opt-out reminder if first contact. Keep under 160 characters. Warm, professional, no financial promises.`,
  task: `You are a mortgage loan officer assistant writing task descriptions. Be clear, specific, and actionable. Include what needs to be done and why. One sentence preferred.`,
};

const CONTEXT_PROMPTS: Record<ContextType, string> = {
  draft_followup: 'Draft a friendly follow-up message checking on the status and next steps.',
  summarize_call: 'Summarize the key points from a recent call into a concise note.',
  write_intro_email: 'Write an introduction email welcoming this lead and explaining the next steps in the mortgage process.',
  rate_explanation: 'Write a clear, jargon-free explanation of current rate considerations for this borrower.',
  custom: 'Complete the following request:',
};

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as ComposeRequest;
    const { fieldType, contextType, leadId, existingText, customPrompt } = body;

    if (!fieldType || !contextType) {
      return NextResponse.json({ error: 'fieldType and contextType required' }, { status: 400 });
    }

    // ── Rate limiting ─────────────────────────────────────────────────────
    const sbAdmin = createAdminClient();
    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);

    const { data: rateLimit } = await sbAdmin
      .from('rate_limits')
      .select('count')
      .eq('user_id', userId)
      .eq('action', 'ai_compose')
      .eq('window_start', windowStart.toISOString())
      .maybeSingle();

    const currentCount = rateLimit?.count ?? 0;
    if (currentCount >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: `Rate limit exceeded. AI Compose is limited to ${RATE_LIMIT_PER_HOUR} requests/hour.`, code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429 }
      );
    }

    await sbAdmin.from('rate_limits').upsert(
      {
        user_id: userId,
        action: 'ai_compose',
        window_start: windowStart.toISOString(),
        count: currentCount + 1,
      },
      { onConflict: 'user_id,action,window_start' }
    );

    // ── Load lead context ─────────────────────────────────────────────────
    const sb = createClient();
    let leadContext = '';
    let leadOrgId: string | undefined;

    if (leadId) {
      const { data: lead } = await sb
        .from('leads')
        .select(
          'first_name, last_name, stage, loan_type, loan_amount, credit_score, last_contacted_at, first_contacted_at, org_id'
        )
        .eq('id', leadId)
        .maybeSingle();

      if (lead) {
        leadOrgId = lead.org_id;
        const parts: string[] = [`Borrower: ${lead.first_name} ${lead.last_name}`];
        if (lead.stage) parts.push(`Stage: ${lead.stage.replace(/_/g, ' ')}`);
        if (lead.loan_type) parts.push(`Loan type: ${lead.loan_type}`);
        if (lead.loan_amount) parts.push(`Loan amount: $${lead.loan_amount.toLocaleString()}`);
        if (lead.credit_score) parts.push(`Credit score: ${lead.credit_score}`);
        if (lead.last_contacted_at) {
          const days = Math.floor(
            (Date.now() - new Date(lead.last_contacted_at).getTime()) / 86400000
          );
          parts.push(`Last contact: ${days} day${days !== 1 ? 's' : ''} ago`);
        }
        leadContext = parts.join('\n');
      }
    }

    // ── Build prompt ──────────────────────────────────────────────────────
    const userPrompt = [
      contextType === 'custom' && customPrompt ? customPrompt : CONTEXT_PROMPTS[contextType],
      leadContext ? `\n\nLead context:\n${leadContext}` : '',
      existingText ? `\n\nExisting text to refine:\n${existingText}` : '',
    ]
      .filter(Boolean)
      .join('');

    // ── Stream Claude Haiku ───────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const stream = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: SYSTEM_PROMPTS[fieldType],
      messages: [{ role: 'user', content: userPrompt }],
      stream: true,
    });

    // Collect full response for logging
    let fullText = '';
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const chunk = event.delta.text;
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        }
        controller.close();

        // Log to ai_feedback (fire-and-forget)
        try {
          const { data: orgRow } = await sbAdmin
            .from('organizations')
            .select('id')
            .eq('clerk_org_id', orgId)
            .maybeSingle();

          if (orgRow) {
            await sbAdmin.from('ai_feedback').insert({
              org_id: orgRow.id,
              user_id: userId,
              lead_id: leadId ?? null,
              field_type: fieldType,
              prompt_used: userPrompt.slice(0, 500),
              ai_output: fullText.slice(0, 2000),
              user_action: 'ignored', // updated later when user accepts/rejects
              final_text: null,
            });
          }
        } catch {
          // logging failure is non-fatal
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    console.error('[ai/compose] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI service error' },
      { status: 500 }
    );
  }
}
