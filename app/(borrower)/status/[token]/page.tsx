import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrGenerateNextStep } from '@/lib/borrower/nextStep';
import { BorrowerPortalClient } from './BorrowerPortalClient';
import { PortalLinkExpired } from '@/components/portal/PortalLinkExpired';

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

  // Expired link: render a branded, LO-aware page (not a bare 404). We already have the
  // token row here, so resolve the assigned loan officer for a "contact them" CTA.
  if (portalToken.expires_at && new Date(portalToken.expires_at) < new Date()) {
    const { data: expiredLead } = await sb
      .from('leads')
      .select('assigned_to')
      .eq('id', portalToken.lead_id)
      .eq('org_id', portalToken.org_id)
      .maybeSingle();
    let loName: string | null = null;
    let loEmail: string | null = null;
    let loPhone: string | null = null;
    if (expiredLead?.assigned_to) {
      const { data: expLo } = await sb
        .from('profiles')
        .select('first_name,last_name,email,phone')
        .eq('id', expiredLead.assigned_to)
        .maybeSingle();
      if (expLo) {
        loName = [expLo.first_name, expLo.last_name].filter(Boolean).join(' ') || null;
        loEmail = (expLo.email as string) ?? null;
        loPhone = (expLo.phone as string) ?? null;
      }
    }
    return <PortalLinkExpired variant="expired" loName={loName} loEmail={loEmail} loPhone={loPhone} />;
  }

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
    .select('id,first_name,email,stage,trid_status,le_sent_date,cd_sent_date,closing_date,assigned_to')
    .eq('id', portalToken.lead_id)
    .eq('org_id', portalToken.org_id)
    .single();

  if (!lead) notFound();

  // Phase 28.7 — borrower's loan history with this LO (auto-linked by email).
  const { data: relationship } = await sb
    .from('borrower_relationships')
    .select('lead_ids, estimated_equity, last_known_avm, current_loan_balance, rate_delta, original_rate, current_market_rate, monthly_savings_if_refi, refi_alert_threshold')
    .eq('org_id', portalToken.org_id)
    .eq('email', (lead.email ?? '').toLowerCase())
    .maybeSingle();

  const historyIds = (relationship?.lead_ids ?? []).filter((id: string) => id !== lead.id);
  const { data: otherLoans } = historyIds.length
    ? await sb.from('leads').select('id, stage, loan_purpose, loan_amount, closing_date, property_city, property_state').in('id', historyIds).order('created_at', { ascending: false })
    : { data: [] };

  const loanHistory = (otherLoans ?? []).map((l: any) => ({
    id: l.id,
    label: [l.property_city, l.property_state].filter(Boolean).join(', ') || 'Loan',
    purpose: l.loan_purpose as string | null,
    amount: l.loan_amount as number | null,
    stage: l.stage as string,
    closingDate: l.closing_date as string | null,
  }));

  // Phase 29.3 — borrower portfolio (visible after 1+ closed loans).
  const { data: relRow } = await sb
    .from('borrower_relationships')
    .select('id, total_loans_closed')
    .eq('org_id', portalToken.org_id)
    .eq('email', (lead.email ?? '').toLowerCase())
    .maybeSingle();

  let portfolio: { properties: any[]; totals: { avm: number; balance: number; equity: number }; snapshots: any[] } | null = null;
  if (relRow && (relRow.total_loans_closed ?? 0) >= 1) {
    const [{ data: props }, { data: snaps }] = await Promise.all([
      sb.from('portfolio_properties').select('*').eq('relationship_id', relRow.id).eq('org_id', portalToken.org_id).eq('is_active', true).order('purchase_date', { ascending: false }),
      sb.from('portfolio_snapshots').select('snapshot_date, total_avm, total_balance, total_equity').eq('relationship_id', relRow.id).eq('org_id', portalToken.org_id).order('snapshot_date', { ascending: true }).limit(24),
    ]);
    const properties = props ?? [];
    const totals = properties.reduce((s: any, p: any) => ({ avm: s.avm + (Number(p.current_avm) || 0), balance: s.balance + (Number(p.current_balance) || 0), equity: s.equity + (Number(p.estimated_equity) || 0) }), { avm: 0, balance: 0, equity: 0 });
    portfolio = { properties, totals, snapshots: (snaps ?? []).map((s) => ({ date: s.snapshot_date, avm: Number(s.total_avm), balance: Number(s.total_balance), equity: Number(s.total_equity) })) };
    // Log the portfolio view as a retention event.
    await sb.from('retention_events').insert({ relationship_id: relRow.id, org_id: portalToken.org_id, event_type: 'portfolio_viewed' });
  }

  const refiAlert = relationship?.rate_delta != null && relationship.rate_delta >= Number(relationship.refi_alert_threshold ?? 0.75)
    ? { originalRate: Number(relationship.original_rate), currentRate: Number(relationship.current_market_rate), monthlySavings: relationship.monthly_savings_if_refi != null ? Number(relationship.monthly_savings_if_refi) : null }
    : null;
  const equityInfo = relationship?.estimated_equity != null
    ? { equity: Number(relationship.estimated_equity), avm: relationship.last_known_avm != null ? Number(relationship.last_known_avm) : null, balance: relationship.current_loan_balance != null ? Number(relationship.current_loan_balance) : null }
    : null;

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
    status: (idx < currentStageIndex
      ? 'completed'
      : idx === currentStageIndex
        ? 'current'
        : 'upcoming') as 'completed' | 'current' | 'upcoming',
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
      loanHistory={loanHistory}
      refiAlert={refiAlert}
      equityInfo={equityInfo}
      portfolio={portfolio}
    />
  );
}
