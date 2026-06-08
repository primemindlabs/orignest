import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const RATE_LIMIT_PER_HOUR = 30;

interface ContextualRequest {
  context: 'note' | 'sms' | 'email' | 'task' | 'condition';
  type: string;
  prompt: string;
  leadData?: string;
  existingContent?: string;
}

const SYSTEM_PROMPT = `You are an expert mortgage loan officer assistant for AshleyIQ. Write concise, professional, compliant mortgage communications.

Rules:
- Never make specific rate promises or guarantees
- Never violate TCPA, TRID, ECOA, RESPA, or fair lending laws
- SMS messages must be under 160 characters unless explicitly told otherwise
- Match a professional but warm LO tone
- Be actionable and specific
- Do not add unnecessary disclaimers or legal boilerplate
- Do not add greetings/signatures unless it's a full email

Respond ONLY with the requested content — no explanations, no "Here is:", no preamble.`;

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as ContextualRequest;
    const { context, type, prompt, leadData, existingContent } = body;

    if (!prompt || !context) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Rate limiting
    const sb = createAdminClient();
    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);

    const { data: rateLimit } = await sb
      .from('rate_limits')
      .select('count')
      .eq('user_id', userId)
      .eq('action', 'ai_contextual')
      .eq('window_start', windowStart.toISOString())
      .maybeSingle();

    const currentCount = rateLimit?.count ?? 0;
    if (currentCount >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Limit is 30 AI requests per hour.' },
        { status: 429 }
      );
    }

    await sb.from('rate_limits').upsert(
      {
        user_id: userId,
        action: 'ai_contextual',
        window_start: windowStart.toISOString(),
        count: currentCount + 1,
      },
      { onConflict: 'user_id,action,window_start' }
    );

    // Build user message
    const parts: string[] = [prompt];
    if (leadData) parts.push(`\nBorrower context:\n${leadData}`);
    if (existingContent) parts.push(`\nExisting content (improve or incorporate):\n${existingContent}`);
    if (context === 'sms') parts.push('\nIMPORTANT: Must be under 160 characters.');

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Stream response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5',
            max_tokens: context === 'sms' ? 200 : 800,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: parts.join('\n') }],
            stream: true,
          });

          for await (const event of response) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              const data = JSON.stringify({ text: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'AI error' })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('[ai/contextual] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI service error' },
      { status: 500 }
    );
  }
}
