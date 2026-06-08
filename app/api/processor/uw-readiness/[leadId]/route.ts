import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface UWChecklistItem {
  key: string;
  label: string;
  ready: boolean;
  detail: string;
}

const matches = (s: string | null | undefined, terms: string[]) =>
  !!s && terms.some((t) => s.toLowerCase().includes(t));

/**
 * GET /api/processor/uw-readiness/[leadId]
 * Phase 16.4 — computes the 7 pre-underwriting gates from the lead's data.
 */
export async function GET(_req: Request, { params }: { params: { leadId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();
  const leadId = params.leadId;

  const { data: lead } = await sb
    .from('leads')
    .select('id, application_submitted_at, loan_estimate_sent_at, credit_score')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const [{ data: docs }, { data: aus }] = await Promise.all([
    sb.from('document_requests').select('doc_type, display_name, status').eq('lead_id', leadId).eq('org_id', orgId),
    sb.from('aus_findings').select('id').eq('lead_id', leadId).limit(1),
  ]);

  const received = (docs ?? []).filter(
    (d: { status: string }) => d.status === 'uploaded' || d.status === 'received' || d.status === 'accepted',
  );
  const hasDoc = (terms: string[]) =>
    received.some((d: { doc_type: string; display_name: string }) => matches(d.doc_type, terms) || matches(d.display_name, terms));

  const items: UWChecklistItem[] = [
    {
      key: 'application_signed',
      label: 'Application signed by all borrowers',
      ready: !!lead.application_submitted_at,
      detail: lead.application_submitted_at ? 'Application submitted' : 'No submitted application on file',
    },
    {
      key: 'disclosures',
      label: 'Initial disclosures delivered',
      ready: !!lead.loan_estimate_sent_at,
      detail: lead.loan_estimate_sent_at ? 'Loan Estimate sent' : 'Initial LE not yet sent',
    },
    {
      key: 'credit',
      label: 'Credit report on file',
      ready: lead.credit_score != null,
      detail: lead.credit_score != null ? 'Credit score recorded' : 'No credit pull recorded',
    },
    {
      key: 'income_docs',
      label: 'Income documentation complete',
      ready: hasDoc(['paystub', 'pay stub', 'w-2', 'w2', 'income', 'tax', '1099']),
      detail: 'Pay stubs / W-2s / tax returns received',
    },
    {
      key: 'asset_docs',
      label: 'Asset documentation complete',
      ready: hasDoc(['bank', 'asset', 'statement', 'reserve']),
      detail: 'Bank / asset statements received',
    },
    {
      key: 'property_docs',
      label: 'Property documentation complete',
      ready: hasDoc(['appraisal', 'property', 'title', 'insurance', 'hoi']),
      detail: 'Appraisal / title / insurance received',
    },
    {
      key: 'aus',
      label: 'AUS run and findings on file',
      ready: (aus ?? []).length > 0,
      detail: (aus ?? []).length > 0 ? 'DU/LP findings stored' : 'No AUS findings yet',
    },
  ];

  return NextResponse.json({
    items,
    ready: items.every((i) => i.ready),
    readyCount: items.filter((i) => i.ready).length,
    total: items.length,
  });
}
