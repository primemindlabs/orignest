import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

interface ReadRequest {
  id: string;
}

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as ReadRequest;
    const { id } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    // Parse notification_type:reference_id from the id
    const [prefix, ...rest] = id.split('-');
    const refId = rest.join('-');

    const sb = createAdminClient();

    // Get org id
    const { data: org } = await sb
      .from('organizations')
      .select('id')
      .eq('clerk_org_id', orgId)
      .maybeSingle();

    if (!org) {
      return NextResponse.json({ error: 'Org not found' }, { status: 404 });
    }

    await sb.from('notification_reads').upsert(
      {
        org_id: org.id,
        user_id: userId,
        notification_type: prefix ?? 'unknown',
        reference_id: refId ?? id,
        read_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,notification_type,reference_id' }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[notifications/read] error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
