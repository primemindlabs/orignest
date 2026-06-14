/**
 * Phase 127 — POST /api/brain/query  { query, entityType?, entityId?, limit? }
 * Semantic recall (vector when provisioned, text-search fallback otherwise).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireBrain } from '@/lib/brain/guard';
import { searchBrain } from '@/lib/brain/searchBrain';
import { BRAIN_ENTITY_TYPES, type BrainEntityType } from '@/lib/brain/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const actor = await requireBrain();
  if (actor instanceof NextResponse) return actor;

  let body: { query?: string; entityType?: string; entityId?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) return NextResponse.json({ error: 'query is required' }, { status: 400 });

  const entityType =
    body.entityType && BRAIN_ENTITY_TYPES.includes(body.entityType as BrainEntityType)
      ? (body.entityType as BrainEntityType)
      : undefined;

  const results = await searchBrain(actor.sb, actor.loId, query, {
    entityType,
    entityId: entityType ? body.entityId : undefined,
    limit: typeof body.limit === 'number' ? Math.min(25, Math.max(1, body.limit)) : 8,
  });

  return NextResponse.json({ results });
}
