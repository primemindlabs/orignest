/**
 * Phase 49.3 — Mercury Network (VMP) AMC integration. OAuth2 client-credentials.
 * GATED: every call requires a stored, decrypted Mercury credential; without a
 * connected account these throw/return null and callers no-op. No fake orders.
 */
import 'server-only';
import { decrypt } from '@/lib/crypto/encrypt';

const MERCURY_BASE = 'https://api.mercuryvmp.com/v2';

export interface MercuryCreds { client_id: string; client_secret: string; company_id: string }

export const MERCURY_STATUS_MAP: Record<string, string> = {
  New: 'ordered', Assigned: 'assigned', 'Inspection Scheduled': 'inspection_scheduled',
  'Inspection Completed': 'inspection_complete', 'Under Review': 'report_in_review',
  'Report Delivered': 'report_delivered', 'Revision Requested': 'revision_requested',
  Completed: 'completed', Cancelled: 'cancelled',
};
export const MERCURY_TYPE_MAP: Record<string, string> = {
  full_1004: 'URAR', condo_1073: 'Individual Condo', desktop: 'Desktop', drive_by: 'Drive-By',
  fha_1004: 'FHA URAR', dscr_1025: 'Small Income', commercial: 'Commercial',
};

function creds(encrypted: string): MercuryCreds {
  return JSON.parse(decrypt(encrypted)) as MercuryCreds;
}

async function token(encrypted: string): Promise<string> {
  const c = creds(encrypted);
  const r = await fetch(`${MERCURY_BASE}/auth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: c.client_id, client_secret: c.client_secret, grant_type: 'client_credentials', scope: 'orders.read orders.write' }),
  });
  if (!r.ok) throw new Error('Mercury auth failed');
  return (await r.json()).access_token as string;
}

export async function placeMercuryOrder(encrypted: string, order: Record<string, unknown>): Promise<{ amc_order_id: string; fee: number }> {
  const t = await token(encrypted);
  const c = creds(encrypted);
  const r = await fetch(`${MERCURY_BASE}/orders`, {
    method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId: c.company_id, ...order }),
  });
  if (!r.ok) throw new Error(`Mercury order failed: ${r.status}`);
  const result = await r.json();
  return { amc_order_id: result.orderId, fee: result.fee };
}

export async function getMercuryOrderStatus(encrypted: string, amcOrderId: string): Promise<Record<string, unknown> | null> {
  const t = await token(encrypted);
  const r = await fetch(`${MERCURY_BASE}/orders/${amcOrderId}`, { headers: { Authorization: `Bearer ${t}` } });
  if (!r.ok) return null;
  const o = await r.json();
  return {
    status: MERCURY_STATUS_MAP[o.status] ?? null,
    appraiser_name: o.appraiser?.name, appraiser_license: o.appraiser?.licenseNumber, appraiser_company: o.appraiser?.company,
    inspection_scheduled_at: o.inspectionDate ? new Date(o.inspectionDate).toISOString() : undefined,
    appraised_value: o.appraisedValue,
    report_delivered_at: o.reportDeliveredDate ? new Date(o.reportDeliveredDate).toISOString() : undefined,
  };
}
