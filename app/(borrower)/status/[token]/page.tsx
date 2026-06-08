import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrGenerateNextStep } from '@/lib/borrower/nextStep';
import { BorrowerPortalClient } from './BorrowerPortalClient';

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
  'new_inquiry', 'pre_qualified', 'application_started', 'application_complete',
  'processing', 'underwriting', 'conditional_approval',
  'clear_to_close', 'closing_scheduled', 'closed',
];

const NEXT_STEPS: Record<string, string> = {
  new_inquiry: 'Your application has been received. Your loan officer will contact you within 1 business day.',
  pre_qualified: 'Great news — you\'re pre-qualified! Next step is completing your full application.',
  application_started: 'Your application is in progress. Please upload any requested documents to keep things moving.',
  application_complete: 'Your application is complete. Our team will begin processing your loan now.',
  processing: 'Your loan is being processed. We may reach out for additional documentation.',
  underwriting: 'Your loan is with our underwriting team for final review.',
  conditional_approval: 'Conditionally approved! Please address any outstanding conditions listed by your loan officer.',
  clear_to_close: 'You\'re clear to close! Your closing date will be confirmed soon.',
  closing_scheduled: 'Your closing is confirmed. Your loan officer will send final instructions.',
  closed: 'Congratulations — your loan has closed! Thank you for trusting us.',
  dead: 'Your loan is on hold. Please contact your loan officer for details.',
};

export default async function BorrowerPortalPage({ params }: { params: { token: string } }) {
  const { token } = params;
  const sb = createAdminClient();

  const { data: portalToken } = await sb
    .from('borrower_portal_tokens')
    .select('id,org_id,lead_id,expires_at,page_views')
    .eq('token', token)
    .maybeSingle();

  if (!portalToken) notFound();
  if (portalToken.expires_at && new Date(portalToken.expires_at) < new Date()) notFound();

  // Increment page views
  await sb
    .from('borrower_portal_tokens')
    .update({
      last_accessed_at: new Date().toISOString(),
      page_views: (portalToken.page_views ?? 0) + 1,
    })
    .eq('id', portalToken.id);

  // Lead data — NO financial PII, credit score, SSN, income
  const { data: lead } = await sb
    .from('leads')
    .select('id,first_name,stage,trid_status,le_sent_date,cd_sent_date,closing_date,assigned_to')
    .eq('id', portalToken.lead_id)
    .eq('org_id', portalToken.org_id)
    .single();

  if (!lead) notFound();

  const lo = lead.assigned_to
    ? await sb
        .from('profiles')
        .select('first_name,last_name,phone,nmls_id,avatar_url,title')
        .eq('id', lead.assigned_to)
        .single()
        .then((r) => r.data)
    : null;

  const { data: org } = await sb
    .from('organizations')
    .select('name,logo_url')
    .eq('id', portalToken.org_id)
    .single();

  const { data: docRequests } = await sb
    .from('document_requests')
    .select('id,display_name,doc_type,status')
    .eq('lead_id', lead.id);

  // Credit repair enrollment (if the LO has enrolled this borrower)
  const { data: creditEnrollment } = await sb
    .from('credit_repair_enrollments')
    .select('id, status, subscription_status, target_score, trial_ends_at, starting_score_exp, starting_score_eqx, starting_score_tu, current_score_exp, current_score_eqx, current_score_tu, score_history, croa_disclosure_signed_at, created_at')
    .eq('lead_id', lead.id)
    .eq('org_id', portalToken.org_id)
    .maybeSingle();

  const currentStageIndex = STAGE_ORDER.indexOf(lead.stage);
  const pipelineSteps = STAGE_ORDER.map((s, idx) => ({
    stage: s,
    label: STAGE_LABELS[s] ?? s,
    status:
      idx < currentStageIndex ? 'completed' : idx === currentStageIndex ? 'current' : 'upcoming',
  }));

  // Phase 4.5 — AI plain-English "what happens next" (cached per stage).
  const openConditions = (docRequests ?? []).filter((d) => d.status !== 'uploaded' && d.status !== 'accepted').length;
  const nextStep = await getOrGenerateNextStep({
    leadId: lead.id,
    orgId: portalToken.org_id,
    stage: lead.stage,
    stageLabel: STAGE_LABELS[lead.stage] ?? lead.stage,
    openConditions,
    fallback: NEXT_STEPS[lead.stage] ?? 'Contact your loan officer for next steps.',
  });

  return (
    <BorrowerPortalClient
      token={token}
      borrowerFirstName={lead.first_name}
      currentStage={lead.stage}
      currentStageLabel={STAGE_LABELS[lead.stage] ?? lead.stage}
      nextStep={nextStep}
      pipelineSteps={pipelineSteps}
      documents={(docRequests ?? []).map((d) => ({
        id: d.id,
        name: d.display_name,
        type: d.doc_type,
        status: d.status,
      }))}
      trid={
        lead.trid_status !== 'pending'
          ? { leSentDate: lead.le_sent_date, cdSentDate: lead.cd_sent_date, closingDate: lead.closing_date }
          : null
      }
      lo={lo ? { name: `${lo.first_name} ${lo.last_name}`, phone: lo.phone, nmls: lo.nmls_id, avatarUrl: lo.avatar_url, title: lo.title } : null}
      org={org ? { name: org.name, logoUrl: org.logo_url } : null}
      creditRepair={creditEnrollment ?? null}
    />
  );
}
