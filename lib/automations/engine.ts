// Phase 107 — milestone automation engine. Called from the Phase 99 stage-transition
// handler (lib/funnel/logTransition) whenever a lead's stage changes. For the lead's
// assigned LO, finds active rules for the new stage, renders a snapshot message, logs
// each as pending (SMS) or auto-sends (email opted-in), and pings the LO.
//
// Org-scoped (Clerk). Realtor recipient via leads.referral_realtor_id -> realtors.
import type { SupabaseClient } from '@supabase/supabase-js';
import { renderTemplate, type TemplateContext } from './template';
import { notify } from '@/lib/notifications/notify';

type Admin = SupabaseClient<any, any, any>;

export async function evaluateAutomations(
  sb: Admin,
  args: { orgId: string; leadId: string; newStage: string; loId: string | null }
): Promise<{ queued: number }> {
  const { orgId, leadId, newStage, loId } = args;
  if (!loId) return { queued: 0 }; // rules are per-LO; unassigned lead has none

  const { data: rules } = await sb
    .from('milestone_automation_rules')
    .select('*')
    .eq('org_id', orgId)
    .eq('user_id', loId)
    .eq('trigger_stage', newStage)
    .eq('active', true);
  if (!rules || rules.length === 0) return { queued: 0 };

  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, phone, email, loan_type, stage, sms_consent, referral_realtor_id')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return { queued: 0 };

  const [{ data: lo }, { data: portal }, realtor] = await Promise.all([
    sb.from('profiles').select('first_name, last_name, phone, nmls_id').eq('id', loId).maybeSingle(),
    sb.from('borrower_portal_tokens').select('token').eq('lead_id', leadId).eq('org_id', orgId).maybeSingle(),
    lead.referral_realtor_id
      ? sb.from('realtors').select('first_name, last_name, phone, email').eq('id', lead.referral_realtor_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.ashleyiq.com';
  const ctx: TemplateContext = {
    borrower_first_name: (lead.first_name as string | null) ?? '',
    loan_type: (lead.loan_type as string | null) ?? '',
    portal_token: (portal?.token as string | null) ?? '',
    realtor_name: realtor.data
      ? `${(realtor.data as any).first_name ?? ''} ${(realtor.data as any).last_name ?? ''}`.trim()
      : '',
    lo_name: lo ? `${lo.first_name ?? ''} ${lo.last_name ?? ''}`.trim() || 'Your Loan Officer' : 'Your Loan Officer',
    lo_phone: (lo?.phone as string | null) ?? '',
    lo_nmls: (lo?.nmls_id as string | null) ?? '',
    current_stage: newStage,
    days_in_stage: 0,
    baseUrl,
  };

  let queued = 0;
  let pendingCreated = 0;

  for (const rule of rules) {
    const action = rule.action_type as string;

    // TCPA pre-check: skip (and do not log) borrower SMS without consent.
    if (action === 'sms_borrower' && !lead.sms_consent) continue;

    const rendered = renderTemplate(rule.message_template as string, ctx);
    const isRealtor = action.includes('realtor');
    const isInternal = action === 'internal_note';

    const recipientPhone = isInternal ? null : isRealtor ? (realtor.data as any)?.phone ?? null : (lead.phone as string | null);
    const recipientEmail = isInternal ? null : isRealtor ? (realtor.data as any)?.email ?? null : (lead.email as string | null);
    const recipientType = isInternal ? 'internal' : isRealtor ? 'realtor' : 'borrower';

    // Internal notes are just recorded (no send / no approval).
    const initialStatus = isInternal ? 'auto_sent' : 'pending';

    const { data: logEntry } = await sb
      .from('milestone_automation_log')
      .insert({
        org_id: orgId,
        rule_id: rule.id,
        lead_id: leadId,
        user_id: loId,
        triggered_at: new Date().toISOString(),
        action_type: action,
        rendered_message: rendered,
        recipient_type: recipientType,
        recipient_phone: recipientPhone,
        recipient_email: recipientEmail,
        approval_status: initialStatus,
        sent_at: isInternal ? new Date().toISOString() : null,
      })
      .select('id')
      .maybeSingle();

    queued++;

    // Auto-send email only: opted-in, no approval required, email action. SMS never auto-sends.
    if (logEntry && rule.auto_send_email && !rule.requires_approval && action.includes('email')) {
      await autoSendEmail(sb, {
        logId: logEntry.id as string,
        action,
        orgId,
        leadId,
        recipientEmail,
        message: rendered,
      });
    } else if (!isInternal) {
      pendingCreated++;
    }
  }

  // One bell ping if anything needs LO approval.
  if (pendingCreated > 0) {
    await notify(sb, {
      orgId,
      userId: loId,
      type: 'system',
      title: `${pendingCreated} automation${pendingCreated === 1 ? '' : 's'} need your approval`,
      body: 'Milestone messages are queued and waiting to send.',
      link: '/settings/automations?tab=queue',
    });
  }

  return { queued };
}

async function autoSendEmail(
  sb: Admin,
  p: { logId: string; action: string; orgId: string; leadId: string; recipientEmail: string | null; message: string }
): Promise<void> {
  if (!p.recipientEmail) {
    await sb.from('milestone_automation_log').update({ approval_status: 'failed', failed_reason: 'No recipient email' }).eq('id', p.logId);
    return;
  }
  try {
    const { sendCompliantEmail } = await import('@/lib/resend');
    const subject = p.action === 'email_realtor' ? 'Loan milestone update — your client' : 'Update on your mortgage';
    const res = await sendCompliantEmail({
      to: p.recipientEmail,
      subject,
      text: p.message,
      orgId: p.orgId,
      recipientEmail: p.recipientEmail,
      leadId: p.leadId,
    });
    await sb
      .from('milestone_automation_log')
      .update({ approval_status: 'auto_sent', sent_at: new Date().toISOString(), resend_message_id: res?.id ?? null })
      .eq('id', p.logId);
  } catch (e: any) {
    await sb
      .from('milestone_automation_log')
      .update({ approval_status: 'failed', failed_reason: e?.message ?? 'Send failed' })
      .eq('id', p.logId);
  }
}
