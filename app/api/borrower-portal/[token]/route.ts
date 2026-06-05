import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'Application Received',
  pre_qualified: 'Pre-Qualified',
  application_started: 'Application In Progress',
  application_complete: 'Application Complete',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Conditionally Approved',
  clear_to_close: 'Clear to Close',
  closing_scheduled: 'Closing Scheduled',
  closed: 'Closed',
  dead: 'On Hold',
};

const STAGE_ORDER = [
  'new_inquiry',
  'pre_qualified',
  'application_started',
  'application_complete',
  'processing',
  'underwriting',
  'conditional_approval',
  'clear_to_close',
  'closing_scheduled',
  'closed',
];

const NEXT_STEPS: Record<string, string> = {
  new_inquiry: 'Your application has been received. Your loan officer will contact you within 1 business day.',
  pre_qualified: 'Great news — you\'re pre-qualified! Your loan officer will guide you through completing your full application.',
  application_started: 'Your application is in progress. Please gather your financial documents to speed up the process.',
  application_complete: 'Your application is complete and moving into processing. Our team will review your documents.',
  processing: 'Your loan is being processed. We may contact you for additional documents.',
  underwriting: 'Your loan is with our underwriting team for final review and approval.',
  conditional_approval: 'You\'ve received a conditional approval. Please provide any outstanding items requested.',
  clear_to_close: 'You\'re clear to close! Your closing date will be scheduled soon.',
  closing_scheduled: 'Your closing is scheduled. Your loan officer will send final instructions.',
  closed: 'Congratulations — your loan has closed! Thank you for trusting us.',
  dead: 'Your loan is currently on hold. Please contact your loan officer for details.',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const { token } = params;
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const sb = createAdminClient();

    // Validate token
    const { data: portalToken } = await sb
      .from('borrower_portal_tokens')
      .select('id,org_id,lead_id,expires_at,page_views')
      .eq('token', token)
      .maybeSingle();

    if (!portalToken) {
      return NextResponse.json({ error: 'Invalid portal link' }, { status: 404 });
    }

    if (portalToken.expires_at && new Date(portalToken.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Portal link has expired' }, { status: 410 });
    }

    // Increment page views
    await sb
      .from('borrower_portal_tokens')
      .update({
        last_accessed_at: new Date().toISOString(),
        page_views: (portalToken.page_views ?? 0) + 1,
      })
      .eq('id', portalToken.id);

    // Load lead — ONLY non-sensitive fields
    const { data: lead } = await sb
      .from('leads')
      .select(
        'id,first_name,stage,trid_status,le_sent_date,cd_sent_date,closing_date,assigned_to',
      )
      .eq('id', portalToken.lead_id)
      .eq('org_id', portalToken.org_id)
      .single();

    if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    // Load LO contact info
    const lo = lead.assigned_to
      ? await sb
          .from('profiles')
          .select('first_name,last_name,phone,nmls_id,avatar_url,title')
          .eq('id', lead.assigned_to)
          .single()
          .then((r) => r.data)
      : null;

    // Load org for branding
    const { data: org } = await sb
      .from('organizations')
      .select('name,logo_url')
      .eq('id', portalToken.org_id)
      .single();

    // Document checklist (requested docs only — no amounts or PII)
    const { data: docRequests } = await sb
      .from('document_requests')
      .select('id,display_name,doc_type,status')
      .eq('lead_id', lead.id);

    // Build pipeline steps
    const currentStageIndex = STAGE_ORDER.indexOf(lead.stage);
    const pipelineSteps = STAGE_ORDER.map((s, idx) => ({
      stage: s,
      label: STAGE_LABELS[s] ?? s,
      status:
        idx < currentStageIndex
          ? 'completed'
          : idx === currentStageIndex
            ? 'current'
            : 'upcoming',
    }));

    // TRID dates (if applicable)
    const tridInfo =
      lead.trid_status !== 'pending'
        ? {
            leSentDate: lead.le_sent_date ?? null,
            cdSentDate: lead.cd_sent_date ?? null,
            closingDate: lead.closing_date ?? null,
          }
        : null;

    return NextResponse.json({
      borrowerFirstName: lead.first_name,
      currentStage: lead.stage,
      currentStageLabel: STAGE_LABELS[lead.stage] ?? lead.stage,
      nextStep: NEXT_STEPS[lead.stage] ?? 'Contact your loan officer for next steps.',
      pipelineSteps,
      documents: (docRequests ?? []).map((d) => ({
        id: d.id,
        name: d.display_name,
        type: d.doc_type,
        status: d.status,
      })),
      trid: tridInfo,
      lo: lo
        ? {
            name: `${lo.first_name} ${lo.last_name}`,
            phone: lo.phone,
            nmls: lo.nmls_id,
            avatarUrl: lo.avatar_url,
            title: lo.title,
          }
        : null,
      org: org ? { name: org.name, logoUrl: org.logo_url } : null,
    });
  } catch (err) {
    console.error('[borrower-portal]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
