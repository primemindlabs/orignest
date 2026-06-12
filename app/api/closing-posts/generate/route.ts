/**
 * Phase 96 — POST /api/closing-posts/generate
 * Generates a compliant closing celebration post for a CLOSED lead in the org.
 * Clerk-scoped (getOrgContext) + admin client. Records the post + a 'generated'
 * audit row. The lead must belong to the org and be at stage 'closed'.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateClosingPost } from '@/lib/ai/closingPost';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { lead_id?: string };
  const leadId = body.lead_id;
  if (!leadId) return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name, property_city, property_state, loan_type, stage')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (lead.stage !== 'closed') {
    return NextResponse.json({ error: 'Lead is not closed yet' }, { status: 409 });
  }

  // Resolve the LO identity for the post signature.
  const { data: profile } = await sb
    .from('profiles')
    .select('id, first_name, last_name, nmls_id')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  const { data: org } = await sb.from('organizations').select('name').eq('id', orgId).maybeSingle();

  const loName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Your loan officer';

  const { copy, compliance, source } = await generateClosingPost({
    city: lead.property_city ?? '',
    state: lead.property_state ?? '',
    loan_type: lead.loan_type ?? 'Conventional',
    lo_name: loName,
    company_name: org?.name ?? '',
    nmls_number: profile?.nmls_id ?? '',
  });

  const { data: post, error } = await sb
    .from('closing_posts')
    .insert({
      org_id: orgId,
      lo_id: profile?.id ?? null,
      lead_id: leadId,
      generated_copy: copy,
      compliance_check_passed: compliance.passed,
      compliance_flags: compliance.flags,
      post_status: 'draft',
    })
    .select()
    .single();
  if (error) {
    console.error('[closing-post] insert failed', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  await sb.from('closing_post_audit').insert({
    post_id: post.id,
    org_id: orgId,
    lo_id: profile?.id ?? null,
    action: 'generated',
    details: { source, compliance_passed: compliance.passed, flags_count: compliance.flags.length },
  });

  return NextResponse.json({ post, compliance });
}
