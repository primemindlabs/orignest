/**
 * Phase 58.3 — Content 360 tracking helper. Call from outbound send flows to log a
 * content touchpoint (best-effort; never throws into the caller). INSERT-only.
 */
import { createAdminClient } from '@/lib/supabase/admin';

export type ContentType = 'email_campaign' | 'email_manual' | 'sms' | 'social_post' | 'video_message' | 'co_marketing_flyer' | 'market_update' | 'rate_drop_alert' | 'pre_approval_letter' | 'scenario_pdf' | 'loan_estimate' | 'closing_disclosure' | 'content_calendar_post';
export type EventType = 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'downloaded' | 'watched' | 'shared' | 'bounced' | 'unsubscribed';

export async function trackContent(params: { orgId: string; contactId: string; contactType: 'lead' | 'realtor' | 'partner'; contentType: ContentType; eventType?: EventType; contentId?: string; contentTitle?: string; metadata?: Record<string, unknown> }): Promise<void> {
  try {
    const sb = createAdminClient();
    await sb.from('content_engagements').insert({
      org_id: params.orgId, contact_type: params.contactType, contact_id: params.contactId,
      content_type: params.contentType, content_id: params.contentId ?? null, content_title: params.contentTitle ?? null,
      event_type: params.eventType ?? 'sent', event_metadata: params.metadata ?? null,
    });
  } catch (e) {
    console.error('[trackContent]', e);
  }
}
