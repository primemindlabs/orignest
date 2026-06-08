import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

interface LeadResult {
  id: string;
  first_name: string;
  last_name: string;
  stage: string;
  loan_amount: number | null;
}

export async function GET(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() ?? '';

    if (q.length < 3) {
      return NextResponse.json({ leads: [] });
    }

    const sb = createClient();

    const { data: leads } = await sb
      .from('leads')
      .select('id, first_name, last_name, stage, loan_amount, email, phone')
      .eq('org_id', orgId)
      .or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`
      )
      .limit(5);

    const results: LeadResult[] = (leads ?? []).map((l) => ({
      id: l.id,
      first_name: l.first_name,
      last_name: l.last_name,
      stage: l.stage,
      loan_amount: l.loan_amount,
    }));

    return NextResponse.json({ leads: results });
  } catch (err) {
    console.error('[search/global] error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
