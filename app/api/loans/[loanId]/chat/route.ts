/**
 * Phase 31.1 — 3-way chat (LO endpoint).
 *   GET  → full thread (LO sees everything) + participant state
 *   POST → LO sends a message. Realtor-visible messages are hard-blocked when
 *          they contain financial content.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrCreateThread } from '@/lib/chat/thread';
import { detectFinancialContent, validateMessageForRealtor, FinancialContentError } from '@/lib/chat/financialGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_VISIBLE = ['lo', 'borrower', 'coborrower', 'realtor', 'title_agent'];
const VALID_CONTENT_TYPE = ['text', 'document_request', 'milestone_update', 'system', 'action_required'];

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const thread = await getOrCreateThread(sb, orgId, params.loanId);
  if (!thread) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const [{ data: messages }, { data: lead }, { data: realtor }] = await Promise.all([
    sb.from('chat_messages').select('*').eq('thread_id', thread.id).order('created_at', { ascending: true }),
    sb.from('leads').select('first_name, last_name, assigned_to').eq('id', params.loanId).maybeSingle(),
    thread.realtor_portal_id
      ? sb.from('portal_realtors').select('realtor_name').eq('id', thread.realtor_portal_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { data: loProfile } = lead?.assigned_to
    ? await sb.from('profiles').select('first_name, last_name').eq('id', lead.assigned_to).maybeSingle()
    : { data: null };

  return NextResponse.json({
    thread,
    messages: messages ?? [],
    participants: {
      lo: loProfile ? `${loProfile.first_name ?? ''} ${loProfile.last_name ?? ''}`.trim() : 'Loan Officer',
      borrower: lead ? `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() : 'Borrower',
      realtor: realtor?.realtor_name ?? null,
    },
  });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    content?: string;
    content_type?: string;
    visible_to?: string[];
    document_id?: string;
    document_name?: string;
  };
  const content = (body.content ?? '').trim();
  if (!content) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  if (content.length > 4000) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  const visible_to = Array.isArray(body.visible_to) && body.visible_to.length
    ? body.visible_to.filter((v) => VALID_VISIBLE.includes(v))
    : ['lo', 'borrower', 'coborrower'];
  if (!visible_to.includes('lo')) visible_to.push('lo');
  const content_type = VALID_CONTENT_TYPE.includes(body.content_type ?? '') ? (body.content_type as string) : 'text';

  // HARD BLOCK: financial content can never be visible to a realtor.
  if (visible_to.includes('realtor')) {
    try {
      validateMessageForRealtor(content);
    } catch (err) {
      if (err instanceof FinancialContentError) return NextResponse.json({ error: err.message, code: 'financial_blocked' }, { status: 400 });
      throw err;
    }
  }

  const sb = createAdminClient();
  const thread = await getOrCreateThread(sb, orgId, params.loanId);
  if (!thread) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

  const { data: inserted, error } = await sb
    .from('chat_messages')
    .insert({
      thread_id: thread.id,
      org_id: orgId,
      sender_type: 'lo',
      sender_id: profile?.id ?? null,
      content,
      content_type,
      document_id: body.document_id ?? null,
      document_name: body.document_name ?? null,
      visible_to,
      financial_content_detected: detectFinancialContent(content),
    })
    .select('*')
    .single();
  if (error) {
    console.error('[chat] insert failed', error);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }

  await sb.from('loan_chat_threads').update({ updated_at: new Date().toISOString() }).eq('id', thread.id);
  return NextResponse.json({ message: inserted });
}
