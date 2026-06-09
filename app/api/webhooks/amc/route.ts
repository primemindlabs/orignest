/**
 * Phase 49.4 — generic AMC status webhook (Solidifi/ServiceLink/Clear Capital/
 * Appraisal Nation/Mercury). Vendor via x-amc-vendor; HMAC verify when a secret
 * is configured. Normalizes → updates appraisal_orders (status + history +
 * appraiser/value/report fields). Inert until a real AMC sends events.
 * Middleware-allowlisted via /api/webhooks(.*).
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createHmac, timingSafeEqual } from 'crypto';
import { MERCURY_STATUS_MAP } from '@/lib/amc/mercury';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SECRET_ENV: Record<string, string> = {
  mercury_network: 'MERCURY_NETWORK_WEBHOOK_SECRET', solidifi: 'SOLIDIFI_WEBHOOK_SECRET',
  servicelink: 'SERVICELINK_WEBHOOK_SECRET', clear_capital: 'CLEAR_CAPITAL_WEBHOOK_SECRET',
  appraisal_nation: 'APPRAISAL_NATION_WEBHOOK_SECRET',
};
const STATUSES = ['pending', 'ordered', 'assigned', 'inspection_scheduled', 'inspection_complete', 'report_in_review', 'report_delivered', 'revision_requested', 'completed', 'cancelled'];

function verify(body: string, sig: string, secret: string): boolean {
  if (!sig || !secret) return false;
  const exp = createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(exp), b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

function pick(o: Record<string, unknown>, keys: string[]): unknown { for (const k of keys) if (o[k] != null) return o[k]; return undefined; }

function normalize(payload: unknown): { amc_order_id?: string; status?: string; appraiser_name?: string; inspection_date?: string; appraised_value?: number; report_delivered_at?: string; notes?: string } | null {
  if (!payload || typeof payload !== 'object') return null;
  const o = payload as Record<string, unknown>;
  const id = pick(o, ['amc_order_id', 'orderId', 'order_id', 'orderNumber']);
  const rawStatus = String(pick(o, ['status', 'orderStatus', 'state']) ?? '');
  const status = MERCURY_STATUS_MAP[rawStatus] ?? (STATUSES.includes(rawStatus.toLowerCase()) ? rawStatus.toLowerCase() : undefined);
  return {
    amc_order_id: id ? String(id) : undefined, status,
    appraiser_name: (pick(o, ['appraiser_name', 'appraiserName']) as string) ?? undefined,
    inspection_date: (pick(o, ['inspection_date', 'inspectionDate']) as string) ?? undefined,
    appraised_value: Number(pick(o, ['appraised_value', 'appraisedValue', 'value'])) || undefined,
    report_delivered_at: (pick(o, ['report_delivered_at', 'reportDeliveredDate']) as string) ?? undefined,
    notes: (pick(o, ['notes', 'message']) as string) ?? undefined,
  };
}

export async function POST(req: Request) {
  const vendor = (req.headers.get('x-amc-vendor') ?? 'unknown').toLowerCase();
  const body = await req.text();
  const secret = process.env[SECRET_ENV[vendor] ?? ''] ?? '';
  if (secret && !verify(body, req.headers.get('x-amc-signature') ?? '', secret)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { return new NextResponse('Bad JSON', { status: 400 }); }
  const n = normalize(payload);
  if (!n?.amc_order_id || !n.status) return new NextResponse('Unrecognized format', { status: 400 });

  const sb = createAdminClient();
  const { data: order } = await sb.from('appraisal_orders').select('id, org_id, amc_status_history').eq('amc_order_id', n.amc_order_id).maybeSingle();
  if (!order) return new NextResponse('Order not found', { status: 404 });

  const history = Array.isArray(order.amc_status_history) ? order.amc_status_history : [];
  await sb.from('appraisal_orders').update({
    status: n.status, updated_at: new Date().toISOString(),
    amc_status_history: [...history, { status: n.status, timestamp: new Date().toISOString(), notes: n.notes ?? null }],
    ...(n.appraiser_name ? { appraiser_name: n.appraiser_name } : {}),
    ...(n.inspection_date ? { inspection_scheduled_at: n.inspection_date } : {}),
    ...(n.appraised_value ? { appraised_value: n.appraised_value } : {}),
    ...(n.report_delivered_at ? { report_delivered_at: n.report_delivered_at } : {}),
  }).eq('id', order.id);

  // When the value comes in, reflect it on the loan (property_value) if present.
  if (n.appraised_value) {
    await sb.from('appraisal_orders').select('lead_id').eq('id', order.id).maybeSingle().then(async ({ data }) => {
      if (data?.lead_id) await sb.from('leads').update({ property_value: n.appraised_value }).eq('id', data.lead_id).then(() => undefined, () => undefined);
    });
  }
  // TODO(notify): SMS/Action-Rail to LO on assigned/inspection_scheduled/report_delivered/revision (gated on Twilio).
  return new NextResponse('OK', { status: 200 });
}
