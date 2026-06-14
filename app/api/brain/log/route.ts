/**
 * Phase 127 — POST /api/brain/log
 *   { logType, content, entityType?, entityId?, rawMetadata? }
 * Appends an immutable interaction log and extracts memories inline.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireBrain } from '@/lib/brain/guard';
import { logInteraction } from '@/lib/brain/logInteraction';
import {
  BRAIN_ENTITY_TYPES,
  BRAIN_LOG_TYPES,
  type BrainEntityType,
  type BrainLogType,
} from '@/lib/brain/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const actor = await requireBrain();
  if (actor instanceof NextResponse) return actor;

  let body: {
    logType?: string;
    content?: string;
    entityType?: string;
    entityId?: string;
    rawMetadata?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!body.logType || !BRAIN_LOG_TYPES.includes(body.logType as BrainLogType)) {
    return NextResponse.json({ error: 'Valid logType is required' }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const entityType =
    body.entityType && BRAIN_ENTITY_TYPES.includes(body.entityType as BrainEntityType)
      ? (body.entityType as BrainEntityType)
      : null;
  const entityId = entityType ? body.entityId ?? null : null;

  const result = await logInteraction(actor.sb, {
    loId: actor.loId,
    orgId: actor.orgId,
    entityType,
    entityId,
    logType: body.logType as BrainLogType,
    content,
    rawMetadata: body.rawMetadata,
  });

  return NextResponse.json(result);
}
