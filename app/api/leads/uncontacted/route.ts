import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export interface UncontactedLead {
  id: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

export async function GET() {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sb = createClient();

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await sb
      .from('leads')
      .select('id, first_name, last_name, created_at')
      .eq('org_id', orgId)
      .eq('stage', 'new_inquiry')
      .is('first_contacted_at', null)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const leads: UncontactedLead[] = (data ?? []).map((l) => ({
      id: l.id,
      first_name: l.first_name,
      last_name: l.last_name,
      created_at: l.created_at,
    }));

    return NextResponse.json({ leads });
  } catch (err) {
    console.error('[leads/uncontacted] error:', err);
    return NextResponse.json({ error: 'Failed to fetch uncontacted leads' }, { status: 500 });
  }
}
