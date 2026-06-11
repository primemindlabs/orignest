// Phase 81 — GET today's morning brief for the authenticated LO.
// Generates on demand (and caches) if no brief exists for today, so the feature works
// without the nightly cron. Returns { brief_date, brief_data, dismissed_items, generated_at }.

import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateBriefItems } from '@/lib/morning-brief/generate';
import type { MorningBrief } from '@/lib/morning-brief/types';

export const runtime = 'nodejs';

const EMPTY = (date: string): MorningBrief => ({
  brief_date: date,
  brief_data: [],
  dismissed_items: [],
  generated_at: null,
});

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { userId, orgId } = await getOrgContext();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!orgId) return NextResponse.json(EMPTY(today));

    const sb = createAdminClient();
    const { data: profile } = await sb
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .maybeSingle();
    const loId = profile?.id as string | undefined;
    if (!loId) return NextResponse.json(EMPTY(today));

    // Cached brief for today?
    const { data: existing } = await sb
      .from('morning_briefs')
      .select('brief_date, brief_data, dismissed_items, generated_at, model_version')
      .eq('org_id', orgId)
      .eq('lo_id', loId)
      .eq('brief_date', today)
      .maybeSingle();

    if (existing) return NextResponse.json(existing);

    // Generate on demand + cache.
    const items = await generateBriefItems(sb, orgId, loId);
    const { data: saved } = await sb
      .from('morning_briefs')
      .upsert(
        {
          org_id: orgId,
          lo_id: loId,
          brief_date: today,
          brief_data: items,
          dismissed_items: [],
          generated_at: new Date().toISOString(),
          model_version: 'claude-haiku-4-5',
        },
        { onConflict: 'org_id,lo_id,brief_date' },
      )
      .select('brief_date, brief_data, dismissed_items, generated_at, model_version')
      .single();

    return NextResponse.json(saved ?? { ...EMPTY(today), brief_data: items, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error('[morning-brief GET]', err);
    return NextResponse.json(EMPTY(today));
  }
}
