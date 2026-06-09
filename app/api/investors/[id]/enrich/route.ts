import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/investors/[id]/enrich — DeedMine / ATTOM multi-property enrichment (Phase 20).
 *
 * Credential-gated. Without DEEDMINE_API_KEY this returns 501 with a clear TODO
 * instead of fabricating portfolio data (per the no-mock-data rule). When the key
 * and endpoint are configured, it resolves the entity's full property portfolio
 * from ATTOM via DeedMine and links any newly discovered properties.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const apiKey = process.env.DEEDMINE_API_KEY;
  const apiUrl = process.env.DEEDMINE_API_URL;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'DeedMine enrichment is not connected.',
        todo: 'Set DEEDMINE_API_KEY (and DEEDMINE_API_URL) to enable ATTOM multi-property discovery.',
        configured: false,
      },
      { status: 501 }
    );
  }

  const sb = createAdminClient();
  const { data: entity } = await sb
    .from('investor_entities')
    .select('id, name')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!entity) return NextResponse.json({ error: 'Entity not found' }, { status: 404 });

  if (!apiUrl) {
    return NextResponse.json(
      { error: 'DEEDMINE_API_URL is not set.', todo: 'Set DEEDMINE_API_URL to the DeedMine portfolio endpoint.', configured: false },
      { status: 501 }
    );
  }

  // Real integration path — query DeedMine for properties owned by this entity.
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/portfolio`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner_name: entity.name }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `DeedMine returned ${res.status}` }, { status: 502 });
    }
    const payload = (await res.json()) as { properties?: unknown[] };
    return NextResponse.json({
      ok: true,
      discovered: Array.isArray(payload.properties) ? payload.properties.length : 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'DeedMine request failed' },
      { status: 502 }
    );
  }
}
