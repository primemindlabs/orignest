/**
 * Phase 79 — call transcription archive for the dialer's Transcriptions tab.
 * Reads call_transcriptions (written by /api/dialer/post-call-summary) and
 * stitches in call_log metadata + borrower name in plain JS (no FK embedding).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();

  const { data: rows, error } = await sb
    .from('call_transcriptions')
    .select('id, call_id, transcript_text, ai_summary, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const transcripts = rows ?? [];
  const callIds = transcripts.map((t) => t.call_id).filter((x): x is string => !!x);

  const callById: Record<string, { phone_to: string | null; duration_seconds: number | null; status: string | null; lead_id: string | null }> = {};
  if (callIds.length) {
    const { data: calls } = await sb
      .from('call_log')
      .select('id, phone_to, duration_seconds, status, lead_id')
      .in('id', callIds);
    for (const c of calls ?? []) callById[c.id] = c;
  }

  const leadIds = Object.values(callById).map((c) => c.lead_id).filter((x): x is string => !!x);
  const nameById: Record<string, string> = {};
  if (leadIds.length) {
    const { data: leads } = await sb.from('leads').select('id, first_name, last_name').in('id', leadIds);
    for (const l of leads ?? []) nameById[l.id] = `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim();
  }

  const out = transcripts.map((t) => {
    const call = t.call_id ? callById[t.call_id] : undefined;
    const leadId = call?.lead_id ?? null;
    return {
      id: t.id,
      call_id: t.call_id,
      transcript_text: t.transcript_text,
      ai_summary: t.ai_summary,
      created_at: t.created_at,
      lead_id: leadId,
      borrower_name: leadId ? nameById[leadId] ?? null : null,
      to_number: call?.phone_to ?? null,
      duration_seconds: call?.duration_seconds ?? null,
      outcome: call?.status ?? null,
    };
  });

  return NextResponse.json({ transcripts: out });
}
