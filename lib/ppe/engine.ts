// Phase 142 — PPE orchestrator. Fans out to every configured pricing source,
// merges the eligible products into one normalized best-execution view, and
// computes the §1026.36(e)(3) anti-steering options. License a PPE for agency
// breadth + run rate-sheet ingestion for the non-QM/DSCR gap, behind one table.
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { priceFromRateSheets } from './sources/rateSheetSource';
import { priceFromLicensedPpe } from './sources/licensedPpeSource';
import { rankBestExecution, selectAntiSteering } from './bestExecution';
import type { BestExResult, PricingScenario } from './types';

export async function priceScenario(
  sb: SupabaseClient,
  orgId: string,
  loId: string,
  scenario: PricingScenario,
  opts: { leadId?: string | null } = {},
): Promise<BestExResult> {
  const [rateSheet, licensed] = await Promise.all([
    priceFromRateSheets(sb, orgId, loId, scenario).catch(
      (): Awaited<ReturnType<typeof priceFromRateSheets>> => ({
        status: { id: 'rate_sheet', label: 'Rate sheet', status: 'error', note: 'lookup failed', eligibleCount: 0 },
        eligible: [], ineligible: [],
      }),
    ),
    priceFromLicensedPpe(orgId, opts.leadId ?? null, scenario).catch(
      (): Awaited<ReturnType<typeof priceFromLicensedPpe>> => ({
        status: { id: 'optimal_blue', label: 'Optimal Blue', status: 'error', note: 'lookup failed', eligibleCount: 0 },
        eligible: [], ineligible: [],
      }),
    ),
  ]);

  const allEligible = [...rateSheet.eligible, ...licensed.eligible];
  const priced = rankBestExecution(allEligible);

  return {
    priced,
    ineligible: [...rateSheet.ineligible, ...licensed.ineligible],
    antiSteering: selectAntiSteering(allEligible),
    sources: [rateSheet.status, licensed.status],
    generatedAt: new Date().toISOString(),
    anyStale: priced.some((p) => p.stale),
  };
}
