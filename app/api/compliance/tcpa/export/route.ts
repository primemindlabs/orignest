// Phase 116 — export the consent audit log as CSV (for regulatory audits). Org-scoped.
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return new Response('Unauthorized', { status: 401 });
  if (!orgId) return new Response('No org', { status: 403 });

  const sb = createAdminClient();
  const { data: rows } = await sb
    .from('consent_audit_log')
    .select('lead_id, event_type, channel, source, old_value, new_value, consent_text, ip_address, occurred_at')
    .eq('org_id', orgId)
    .order('occurred_at', { ascending: false })
    .limit(5000);

  const header = ['lead_id', 'event_type', 'channel', 'source', 'old_value', 'new_value', 'consent_text', 'ip_address', 'occurred_at'];
  const lines = [header.join(',')];
  for (const r of rows ?? []) lines.push(header.map((h) => csvCell((r as any)[h])).join(','));

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="consent-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
