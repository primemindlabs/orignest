/**
 * Phase 127 — POST /api/brain/memory
 *   { entityType, entityId, memoryType, memoryText }
 * Adds a manual LO-authored memory (source = lo_input).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireBrain } from '@/lib/brain/guard';
import { addManualMemory } from '@/lib/brain/addMemory';
import {
  BRAIN_ENTITY_TYPES,
  BRAIN_MEMORY_TYPES,
  type BrainEntityType,
  type BrainMemoryType,
} from '@/lib/brain/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const actor = await requireBrain();
  if (actor instanceof NextResponse) return actor;

  let body: { entityType?: string; entityId?: string; memoryType?: string; memoryText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { entityType, entityId, memoryType } = body;
  const memoryText = typeof body.memoryText === 'string' ? body.memoryText.trim() : '';

  if (!entityType || !BRAIN_ENTITY_TYPES.includes(entityType as BrainEntityType) || !entityId) {
    return NextResponse.json({ error: 'Valid entityType and entityId are required' }, { status: 400 });
  }
  if (!memoryType || !BRAIN_MEMORY_TYPES.includes(memoryType as BrainMemoryType)) {
    return NextResponse.json({ error: 'Valid memoryType is required' }, { status: 400 });
  }
  if (!memoryText) {
    return NextResponse.json({ error: 'memoryText is required' }, { status: 400 });
  }

  const memory = await addManualMemory(actor.sb, {
    loId: actor.loId,
    orgId: actor.orgId,
    entityType: entityType as BrainEntityType,
    entityId,
    memoryType: memoryType as BrainMemoryType,
    memoryText,
  });

  return NextResponse.json({ memory });
}
