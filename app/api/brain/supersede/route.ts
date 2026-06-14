/**
 * Phase 127 — POST /api/brain/supersede  { oldMemoryId, newMemoryText }
 * Soft-correct a memory: insert the new one, mark the old inactive. Never edits.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireBrain } from '@/lib/brain/guard';
import { supersedeMemory } from '@/lib/brain/supersedeMemory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const actor = await requireBrain();
  if (actor instanceof NextResponse) return actor;

  let body: { oldMemoryId?: string; newMemoryText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const oldMemoryId = typeof body.oldMemoryId === 'string' ? body.oldMemoryId : '';
  const newMemoryText = typeof body.newMemoryText === 'string' ? body.newMemoryText.trim() : '';
  if (!oldMemoryId || !newMemoryText) {
    return NextResponse.json({ error: 'oldMemoryId and newMemoryText are required' }, { status: 400 });
  }

  try {
    const memory = await supersedeMemory(actor.sb, {
      oldMemoryId,
      newMemoryText,
      loId: actor.loId,
      orgId: actor.orgId,
    });
    return NextResponse.json({ memory });
  } catch {
    // Most likely the old memory doesn't belong to this LO.
    return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
  }
}
