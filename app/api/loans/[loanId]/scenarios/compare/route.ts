// Phase 115 — record a comparison set. (Server-side PDF is gated: no PDF renderer is
// installed; the LO prints the comparison view to PDF from the browser. We persist the
// scenario_set so it's reusable + linkable.)
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const ids = Array.isArray(b.scenarioIds) ? b.scenarioIds.filter((x: unknown) => typeof x === 'string') : [];
  if (ids.length < 2) return NextResponse.json({ error: 'Select at least 2 scenarios to compare' }, { status: 400 });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: set, error } = await sb
    .from('scenario_sets')
    .insert({ org_id: orgId, lo_id: profile.id, lead_id: params.loanId, title: (b.title ?? 'Loan Comparison').toString().slice(0, 160), scenario_ids: ids })
    .select('id')
    .single();
  if (error || !set) return NextResponse.json({ error: 'Could not save comparison' }, { status: 500 });

  // Print-friendly comparison view (browser print-to-PDF) — no server PDF dependency.
  // Rendered outside the dashboard shell so the print is clean (no sidebar).
  const printUrl = `/scenario-compare/${set.id}`;
  return NextResponse.json({ setId: set.id, printUrl });
}
