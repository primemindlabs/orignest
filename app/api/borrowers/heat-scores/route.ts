// Phase 110 — latest borrower heat score per borrower for the org, with contact info.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

const BAND_ORDER: Record<string, number> = { cooling: 0, warm: 1, hot: 2, cold: 3 };

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ borrowers: [] });

  const sb = createAdminClient();
  // Latest snapshot per lead (INSERT-only time series → newest computed_at wins).
  const { data: rows } = await sb
    .from('borrower_heat_scores')
    .select('lead_id, lo_id, score, band, days_since_last_contact, days_since_portal_login, days_since_close, life_event_within_30d, driving_factors, computed_at')
    .eq('org_id', orgId)
    .order('computed_at', { ascending: false })
    .limit(2000);

  const latest = new Map<string, any>();
  for (const r of rows ?? []) if (!latest.has(r.lead_id as string)) latest.set(r.lead_id as string, r);

  const leadIds = Array.from(latest.keys());
  const contactById = new Map<string, any>();
  if (leadIds.length) {
    const { data: leads } = await sb.from('leads').select('id, first_name, last_name, phone').in('id', leadIds);
    for (const l of leads ?? []) contactById.set(l.id as string, l);
  }

  const borrowers = Array.from(latest.values())
    .map((r) => {
      const c = contactById.get(r.lead_id as string);
      return {
        lead_id: r.lead_id,
        name: c ? `${c.first_name ?? ''} ${(c.last_name ?? '')[0] ?? ''}`.trim() : 'Borrower',
        phone: c?.phone ?? null,
        score: r.score,
        band: r.band,
        days_since_last_contact: r.days_since_last_contact,
        top_signal: r.driving_factors?.top_signal ?? null,
        computed_at: r.computed_at,
      };
    })
    .sort((a, b) => (BAND_ORDER[a.band] ?? 9) - (BAND_ORDER[b.band] ?? 9) || a.score - b.score);

  return NextResponse.json({ borrowers });
}
