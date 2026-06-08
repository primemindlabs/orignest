/**
 * Phase 5.1 — AI Condition Satisfaction (server-only)
 *
 * Given a document the borrower/LO just uploaded, Claude Sonnet reads it and
 * decides which open underwriting conditions it satisfies. High-confidence
 * matches auto-advance to `received`; medium-confidence matches are flagged for
 * LO review (`under_review`). Every AI decision is written to `condition_events`
 * (append-only audit), never silently.
 *
 * Claude reads PDFs and images natively via document/image content blocks — no
 * pdf-parse dependency. Never import this in a client component.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';

const MODEL = 'claude-sonnet-4-5';
const DOCS_BUCKET = 'borrower-docs';

// Conditions we still try to match against (anything not already finalized).
const OPEN_STATUSES = ['issued', 'submitted', 'received', 'under_review'];

export type ConditionConfidence = 'high' | 'medium' | 'low';

export interface ConditionVerdict {
  condition_id: string;
  condition_text: string;
  satisfied: boolean;
  confidence: ConditionConfidence;
  reasoning: string;
  /** What we did about it. */
  action: 'auto_satisfied' | 'flagged_for_review' | 'evaluated';
  new_status: string | null;
}

export interface AutoSatisfyResult {
  documentRequestId: string;
  documentName: string;
  evaluated: number;
  autoSatisfied: number;
  flagged: number;
  verdicts: ConditionVerdict[];
}

interface AiVerdict {
  condition_id: string;
  satisfied: boolean;
  confidence: ConditionConfidence;
  reasoning: string;
}

const MEDIA_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function inferMediaType(fileName: string | null, fallback: string): string {
  const ext = (fileName ?? '').toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return fallback;
}

/**
 * Read one uploaded document and reconcile it against the lead's open conditions.
 * `actorId` is the profile id of the staff member who triggered it (null for system).
 */
export async function autoSatisfyConditions(params: {
  orgId: string;
  leadId: string;
  documentRequestId: string;
  actorId?: string | null;
}): Promise<AutoSatisfyResult> {
  const { orgId, leadId, documentRequestId, actorId = null } = params;
  const sb = createAdminClient();

  // ── 1. The document (must belong to this lead + org and have a file) ────────
  const { data: doc, error: docErr } = await sb
    .from('document_requests')
    .select('id, file_path, file_name, display_name, doc_type')
    .eq('id', documentRequestId)
    .eq('lead_id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (docErr || !doc) throw new Error('Document not found for this lead');
  if (!doc.file_path) throw new Error('Document has no uploaded file to review');

  // ── 2. Open conditions ──────────────────────────────────────────────────────
  const { data: conditions } = await sb
    .from('loan_conditions')
    .select('id, condition_text, category, status')
    .eq('lead_id', leadId)
    .eq('org_id', orgId)
    .in('status', OPEN_STATUSES);

  if (!conditions || conditions.length === 0) {
    return {
      documentRequestId,
      documentName: doc.display_name ?? doc.file_name ?? 'document',
      evaluated: 0,
      autoSatisfied: 0,
      flagged: 0,
      verdicts: [],
    };
  }

  // ── 3. Download the file from storage and base64-encode for Claude ──────────
  const { data: blob, error: dlErr } = await sb.storage
    .from(DOCS_BUCKET)
    .download(doc.file_path as string);
  if (dlErr || !blob) throw new Error('Could not read the uploaded file from storage');

  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
  const mediaType = inferMediaType(doc.file_name as string | null, blob.type || 'application/pdf');
  if (!MEDIA_TYPES.has(mediaType)) {
    throw new Error(`Unsupported document type for AI review: ${mediaType}`);
  }

  const fileBlock: Anthropic.ContentBlockParam =
    mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
            data: base64,
          },
        };

  // ── 4. Ask Claude which conditions this document satisfies ──────────────────
  const conditionList = conditions
    .map((c: { id: string; condition_text: string; category: string }) =>
      `- id: ${c.id}\n  category: ${c.category}\n  requirement: ${c.condition_text}`,
    )
    .join('\n');

  const system = `You are an experienced mortgage processor reviewing an uploaded borrower document against a list of open underwriting conditions.

For EACH condition, decide whether THIS document satisfies it:
- satisfied: true only if the document clearly provides what the condition requires
- confidence: "high" (unambiguous), "medium" (likely but needs a human check), or "low" (weak/unclear)
- reasoning: one concise sentence citing what in the document supports your decision

Be conservative: if the document is unrelated to a condition, satisfied=false, confidence=high.
Only return verdicts for the condition ids provided.

Return ONLY valid JSON, no markdown:
{ "conditions": [ { "condition_id": "<uuid>", "satisfied": true|false, "confidence": "high|medium|low", "reasoning": "<one sentence>" } ] }`;

  const client = new Anthropic();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [
      {
        role: 'user',
        content: [
          fileBlock,
          {
            type: 'text',
            text: `Open conditions on this loan:\n${conditionList}\n\nReview the attached document and return your JSON verdict for each condition id.`,
          },
        ],
      },
    ],
  });

  const raw = message.content[0]?.type === 'text' ? message.content[0].text : '';
  let aiVerdicts: AiVerdict[];
  try {
    const clean = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean) as { conditions: AiVerdict[] };
    aiVerdicts = Array.isArray(parsed.conditions) ? parsed.conditions : [];
  } catch {
    throw new Error('AI returned an unreadable response');
  }

  // ── 5. Apply verdicts: advance status + write append-only audit events ───────
  const byId = new Map(conditions.map((c: { id: string }) => [c.id, c]));
  const verdicts: ConditionVerdict[] = [];
  const events: Record<string, unknown>[] = [];
  let autoSatisfied = 0;
  let flagged = 0;

  for (const v of aiVerdicts) {
    const cond = byId.get(v.condition_id) as
      | { id: string; condition_text: string; status: string }
      | undefined;
    if (!cond) continue; // ignore hallucinated ids

    let action: ConditionVerdict['action'] = 'evaluated';
    let newStatus: string | null = null;

    if (v.satisfied && v.confidence === 'high') {
      action = 'auto_satisfied';
      // Only advance forward — never downgrade a condition already past 'received'.
      if (cond.status === 'issued' || cond.status === 'submitted') newStatus = 'received';
      autoSatisfied++;
    } else if (v.satisfied && v.confidence === 'medium') {
      action = 'flagged_for_review';
      if (cond.status === 'issued' || cond.status === 'submitted') newStatus = 'under_review';
      flagged++;
    }

    if (newStatus) {
      await sb
        .from('loan_conditions')
        .update({
          status: newStatus,
          document_request_id: documentRequestId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cond.id)
        .eq('org_id', orgId);
    }

    events.push({
      org_id: orgId,
      lead_id: leadId,
      condition_id: cond.id,
      document_request_id: documentRequestId,
      actor_type: 'ai',
      actor_id: actorId,
      event_type:
        action === 'auto_satisfied'
          ? 'auto_satisfied'
          : action === 'flagged_for_review'
            ? 'flagged_for_review'
            : 'ai_evaluated',
      model: MODEL,
      confidence: v.confidence,
      reasoning: { satisfied: v.satisfied, reasoning: v.reasoning, new_status: newStatus },
    });

    verdicts.push({
      condition_id: cond.id,
      condition_text: cond.condition_text,
      satisfied: v.satisfied,
      confidence: v.confidence,
      reasoning: v.reasoning,
      action,
      new_status: newStatus,
    });
  }

  if (events.length > 0) {
    await sb.from('condition_events').insert(events);
  }

  return {
    documentRequestId,
    documentName: doc.display_name ?? doc.file_name ?? 'document',
    evaluated: verdicts.length,
    autoSatisfied,
    flagged,
    verdicts,
  };
}
