/**
 * Phase 39.1 — export the LO's personal book of business (their lo_personal
 * leads). Logs the request (regulatory paper trail), builds CSV, emails it
 * best-effort via Resend, and returns the CSV inline so the LO always gets it.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function POST() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id, email, first_name').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: req } = await sb.from('data_export_requests').insert({ org_id: orgId, requested_by: profile.id, export_type: 'lo_personal_book', status: 'processing' }).select('id').single();

  const { data: leads } = await sb
    .from('leads')
    .select('first_name, last_name, email, phone, loan_type, loan_purpose, loan_amount, stage, data_ownership, ownership_notes, created_at')
    .eq('org_id', orgId)
    .eq('assigned_to', profile.id)
    .eq('data_ownership', 'lo_personal')
    .order('created_at', { ascending: false });

  const header = ['first_name', 'last_name', 'email', 'phone', 'loan_type', 'loan_purpose', 'loan_amount', 'stage', 'ownership_notes', 'created_at'];
  const lines = [header.join(',')];
  for (const l of leads ?? []) lines.push(header.map((h) => csvCell((l as Record<string, unknown>)[h])).join(','));
  const csv = lines.join('\n');

  // Best-effort email of the CSV.
  try {
    const mod = (await import('@/lib/resend')) as Record<string, unknown>;
    const send = (mod.sendEmail ?? mod.sendTransactionalEmail ?? mod.default) as ((a: { to: string; subject: string; html: string }) => Promise<unknown>) | undefined;
    if (typeof send === 'function' && profile.email) {
      await send({ to: profile.email, subject: `Your book of business (${leads?.length ?? 0} contacts)`, html: `<p>Hi ${profile.first_name ?? ''}, your personal book export is attached below.</p><pre>${csv.slice(0, 50000)}</pre>` });
    }
  } catch {
    /* best-effort */
  }

  if (req?.id) await sb.from('data_export_requests').update({ status: 'sent', record_count: leads?.length ?? 0, sent_at: new Date().toISOString() }).eq('id', req.id);

  return NextResponse.json({ count: leads?.length ?? 0, csv });
}
