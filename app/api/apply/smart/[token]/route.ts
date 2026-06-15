/**
 * Phase 137 — PUBLIC token-gated persistence for the branded full Smart-1003.
 * Same section model as the in-app form (/api/leads/[id]/application), but resolved
 * by loan_applications.application_token instead of Clerk auth. On submit it lands
 * the application into the platform: advances the lead, stamps application_submitted_at,
 * and alerts the assigned LO (in-app notification + email).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SECTION_KEYS = ['loan_data', 'property_data', 'borrower_data', 'employment_data', 'declarations_data'] as const;

// Never let raw SSN/DOB land in the JSONB section blobs (collected separately, encrypted).
const FORBIDDEN_KEYS = /(ssn|social.?security|date.?of.?birth|\bdob\b)/i;
function stripForbidden(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (FORBIDDEN_KEYS.test(k)) continue;
    clean[k] = v;
  }
  return clean;
}

async function resolveApp(token: string) {
  const sb = createAdminClient();
  const { data } = await sb
    .from('loan_applications')
    .select('id, org_id, lead_id, status')
    .eq('application_token', token)
    .maybeSingle();
  return data;
}

// GET — load the application for resume/autosave-recovery.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const app = await resolveApp(params.token);
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  const sb = createAdminClient();
  const { data } = await sb
    .from('loan_applications')
    .select('id, status, current_section, loan_data, property_data, borrower_data, employment_data, declarations_data, updated_at')
    .eq('id', app.id)
    .single();
  return NextResponse.json({ application: data });
}

// PUT — save section data + progress. On status='submitted', run the landing + alerts.
export async function PUT(req: NextRequest, { params }: { params: { token: string } }) {
  const app = await resolveApp(params.token);
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  let body: { sections?: Record<string, Record<string, unknown>>; status?: string; current_section?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of SECTION_KEYS) {
    const section = body.sections?.[key];
    if (section && typeof section === 'object') update[key] = stripForbidden(section as Record<string, unknown>);
  }
  if (typeof body.current_section === 'number') update.current_section = body.current_section;

  const submitting = body.status === 'submitted';
  if (submitting) {
    update.status = 'submitted';
    update.submitted_at = new Date().toISOString();
  }

  const loanAmount = Number(body.sections?.loan_data?.loan_amount);
  const hasLoanAmount = Number.isFinite(loanAmount) && loanAmount > 0;
  if (hasLoanAmount) update.loan_amount = loanAmount;

  const sb = createAdminClient();
  const { error } = await sb.from('loan_applications').update(update).eq('id', app.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (submitting) {
    await landSubmission(sb, app, hasLoanAmount ? loanAmount : null);
  }

  return NextResponse.json({ application: { id: app.id, status: submitting ? 'submitted' : 'draft' } });
}

// Surface a submitted public application into the platform + alert the LO.
async function landSubmission(
  sb: ReturnType<typeof createAdminClient>,
  app: { id: string; org_id: string; lead_id: string },
  loanAmount: number | null,
) {
  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name, stage, assigned_to')
    .eq('id', app.lead_id)
    .maybeSingle();
  if (!lead) return;

  const leadUpdate: Record<string, unknown> = { application_submitted_at: new Date().toISOString() };
  if (lead.stage === 'new_inquiry' || lead.stage === 'pre_qual') leadUpdate.stage = 'application';
  if (loanAmount) leadUpdate.loan_amount = loanAmount;
  await sb.from('leads').update(leadUpdate).eq('id', lead.id);

  const borrower = `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || 'A borrower';

  if (lead.assigned_to) {
    // In-app notification (bell + realtime).
    await notify(sb, {
      orgId: app.org_id,
      userId: lead.assigned_to,
      type: 'system',
      title: 'New 1003 submitted',
      body: `${borrower} completed their digital application.`,
      link: `/loans/${lead.id}/application`,
      urgency: 1,
    });

    // Email the LO — best-effort, never blocks the borrower's submit.
    try {
      const { data: lo } = await sb.from('profiles').select('email, first_name').eq('id', lead.assigned_to).maybeSingle();
      if (lo?.email) {
        const { sendNewApplicationEmail } = await import('@/lib/resend');
        await sendNewApplicationEmail({
          to: lo.email,
          officerName: lo.first_name ?? 'there',
          borrowerName: borrower,
          leadId: lead.id,
          orgId: app.org_id,
        });
      }
    } catch (e) {
      console.error('[apply/smart submit] LO email skipped', e);
    }
  }
}
