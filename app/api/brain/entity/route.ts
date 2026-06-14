/**
 * Phase 127 — GET /api/brain/entity?entityType=&entityId=&types=&limit=
 * Structured memories for one entity (the profile-panel feed).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireBrain } from '@/lib/brain/guard';
import { getEntityMemories } from '@/lib/brain/getEntityMemories';
import { BRAIN_ENTITY_TYPES, type BrainEntityType } from '@/lib/brain/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await requireBrain();
  if (actor instanceof NextResponse) return actor;

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entityType') ?? '';
  const entityId = searchParams.get('entityId') ?? '';
  if (!BRAIN_ENTITY_TYPES.includes(entityType as BrainEntityType) || !entityId) {
    return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 });
  }

  const typesParam = searchParams.get('types');
  const limitParam = searchParams.get('limit');

  const memories = await getEntityMemories(actor.sb, actor.loId, entityType as BrainEntityType, entityId, {
    types: typesParam ? typesParam.split(',').filter(Boolean) : undefined,
    limit: limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 0)) || undefined : undefined,
    activeOnly: true,
  });

  return NextResponse.json({ memories });
}
