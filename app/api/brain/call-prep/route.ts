/**
 * Phase 127 — GET /api/brain/call-prep?entityType=&entityId=
 * The pre-call briefing card: top memories grouped by type + recent raw logs.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireBrain } from '@/lib/brain/guard';
import { getEntityMemories, getRecentLogs } from '@/lib/brain/getEntityMemories';
import { BRAIN_ENTITY_TYPES, type BrainEntityType, type BrainMemory } from '@/lib/brain/types';

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

  const [memories, recentLogs] = await Promise.all([
    getEntityMemories(actor.sb, actor.loId, entityType as BrainEntityType, entityId, {
      limit: 12,
      activeOnly: true,
    }),
    getRecentLogs(actor.sb, actor.loId, entityType as BrainEntityType, entityId, { limit: 3 }),
  ]);

  const grouped: Record<string, BrainMemory[]> = {};
  for (const m of memories) {
    (grouped[m.memory_type] ??= []).push(m);
  }

  return NextResponse.json({ grouped, recentLogs });
}
