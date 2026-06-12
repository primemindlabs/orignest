// Phase 86 — Refi rate-trigger blast.
//  GET  — list eligible candidates (refi_opportunities not yet sent) for the blast picker.
//  POST — send a reviewed blast. The RESPA disclaimer is appended SERVER-SIDE to every
//         message (never trusted from the client) and the job is logged to refi_blast_jobs.
//         Email send via Resend is gated: record-only when RESEND_API_KEY is absent.

import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildBlastMessage, RESPA_DISCLAIMER_VERSION } from '@/lib/refi/constants';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { userId, orgId } = await getOrgContext();
    if (!userId || !orgId) return NextResponse.json({ candidates: [] });

    const sb = createAdminClient();
    const { data } = await sb
      .from('refi_opportunities')
      .select('id, lead_id, original_rate, current_market_rate, rate_spread, monthly_savings, loan_balance_estimate, outreach_status, leads(first_name, email, loan_type, unsubscribed_email)')
      .eq('org_id', orgId)
      .neq('outreach_status', 'sent')
      .order('monthly_savings', { ascending: false });

    return NextResponse.json({ candidates: data ?? [] });
  } catch (err) {
    console.error('[refi-blast GET]', err);
    return NextResponse.json({ candidates: [] });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await getOrgContext();
    if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { candidate_ids?: string[]; message_template?: string };
    const ids = (body.candidate_ids ?? []).filter(Boolean);
    const template = (body.message_template ?? '').trim();
    if (!ids.length) return NextResponse.json({ error: 'No candidates selected' }, { status: 400 });
    if (!template) return NextResponse.json({ error: 'Message template required' }, { status: 400 });

    const sb = createAdminClient();
    const { data: caller } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

    const { data: candidates } = await sb
      .from('refi_opportunities')
      .select('id, lead_id, monthly_savings, leads(first_name, email, unsubscribed_email)')
      .eq('org_id', orgId)
      .in('id', ids);
    const list = candidates ?? [];

    // Audit record first (status draft).
    const { data: job } = await sb
      .from('refi_blast_jobs')
      .insert({
        org_id: orgId,
        user_id: (caller?.id as string | undefined) ?? null,
        recipient_count: list.length,
        message_template: template,
        respa_disclaimer_included: true, // server-enforced — always true
        respa_disclaimer_version: RESPA_DISCLAIMER_VERSION,
        status: 'draft',
      })
      .select('id')
      .single();

    const resendReady = Boolean(process.env.RESEND_API_KEY);
    let resend: import('resend').Resend | null = null;
    if (resendReady) {
      const { getResend } = await import('@/lib/resend');
      resend = getResend();
    }
    const { FROM_EMAIL } = await import('@/lib/resend');

    let transmitted = 0;
    for (const c of list) {
      const lead = (c as { leads?: { first_name?: string; email?: string; unsubscribed_email?: boolean } }).leads;
      const fullMessage = buildBlastMessage(template, { first_name: lead?.first_name, rate_savings: (c as { monthly_savings?: number }).monthly_savings ?? '' });

      if (resend && lead?.email && !lead.unsubscribed_email) {
        try {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: lead.email,
            subject: 'Rate update — potential savings for you',
            text: fullMessage,
          });
          transmitted++;
        } catch (e) {
          console.error('[refi-blast send]', e);
        }
      }

      // Mark the candidate as sent (column confirmed present).
      await sb.from('refi_opportunities').update({ outreach_status: 'sent', last_checked_at: new Date().toISOString() }).eq('id', c.id);
    }

    await sb
      .from('refi_blast_jobs')
      .update({ status: 'sent', sent_at: new Date().toISOString(), transmitted_count: transmitted })
      .eq('id', job?.id);

    return NextResponse.json({
      ok: true,
      job_id: job?.id,
      recipient_count: list.length,
      transmitted,
      transmitted_all: transmitted === list.length,
      reason: resendReady ? null : 'Email sending is not configured — blast recorded for compliance, not transmitted.',
    });
  } catch (err) {
    console.error('[refi-blast POST]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
