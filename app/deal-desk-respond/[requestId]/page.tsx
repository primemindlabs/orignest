// Phase 120 — PUBLIC AE pricing-response page (HMAC magic-link, no login).
// Allowlisted via /deal-desk-respond/(.*). Verifies the token server-side and renders
// a single-purpose response form for one pricing request.
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyDealDeskToken } from '@/lib/dealDesk/token';
import { AeRespondForm } from '@/components/dealDesk/AeRespondForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pricing Request', robots: 'noindex' };

const money = (n: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString()}`);
const pct = (n: number | null) => (n == null ? '—' : `${n}%`);

export default async function AeRespondPage({
  params,
  searchParams,
}: {
  params: { requestId: string };
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? '';
  const payload = verifyDealDeskToken(token);
  if (!payload || payload.request_id !== params.requestId) notFound();

  const sb = createAdminClient();
  const { data: req } = await sb
    .from('ae_deal_desk_requests')
    .select('*')
    .eq('id', params.requestId)
    .eq('org_id', payload.org_id)
    .maybeSingle();
  if (!req) notFound();

  const closed = ['approved', 'declined', 'expired'].includes(req.status as string);
  const already = req.status === 'responded' || closed;

  const rows: [string, string][] = [
    ['Lender', (req.lender_name as string) ?? '—'],
    ['Loan type', (req.loan_type as string) ?? '—'],
    ['Loan amount', money(req.loan_amount as number)],
    ['LTV', pct(req.ltv as number)],
    ['FICO', req.fico_score != null ? String(req.fico_score) : '—'],
    ['Purpose', (req.loan_purpose as string) ?? '—'],
    ['Occupancy', (req.occupancy as string) ?? '—'],
    ['Requested rate', pct(req.requested_rate as number)],
    ['Lock period', req.lock_period_days != null ? `${req.lock_period_days} days` : '—'],
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <p className="font-semibold text-gray-900 text-sm">Scenario Pricing Request</p>
          <p className="text-xs text-gray-400">{req.ae_name ? `For ${req.ae_name}` : 'For the lender account executive'}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-900 mb-3">Scenario</p>
          <table className="text-sm w-full">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td className="py-1 pr-4 text-gray-400 whitespace-nowrap">{k}</td>
                  <td className="py-1 text-gray-900 font-medium text-right">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {req.exception_reason ? (
            <p className="mt-3 text-sm text-gray-700"><span className="text-gray-400">Exception requested: </span>{req.exception_reason as string}</p>
          ) : null}
        </div>

        {already ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 text-sm text-gray-600">
            {closed ? 'This request is closed.' : 'A response has already been submitted. Thank you.'}
            {req.ae_offered_rate != null || req.ae_offered_price != null || req.ae_response_notes ? (
              <div className="mt-3 text-gray-900">
                <p className="text-xs text-gray-400 mb-1">Your response</p>
                {req.ae_offered_rate != null && <p>Rate: {pct(req.ae_offered_rate as number)}</p>}
                {req.ae_offered_price != null && <p>Price: {String(req.ae_offered_price)}</p>}
                {req.ae_response_notes && <p className="mt-1">{req.ae_response_notes as string}</p>}
              </div>
            ) : null}
          </div>
        ) : (
          <AeRespondForm requestId={params.requestId} token={token} />
        )}

        <p className="text-[11px] text-gray-400 leading-relaxed px-1">
          This request is for scenario pricing only and is not a rate lock, commitment, or offer to lend.
          Rates and pricing are subject to change and confirmation.
        </p>
      </div>
    </div>
  );
}
