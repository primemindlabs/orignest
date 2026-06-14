/** Phase 131 — current market rate lookup + Freddie Mac PMMS refresh (best-effort). */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// Fallback used only if goldmine_market_rates is empty (e.g. before the first fetch).
export const DEFAULT_RATES = { rate_30yr_fixed: 6.75, rate_15yr_fixed: 6.0, rate_5yr_arm: 6.5 };

export async function getCurrentMarketRate(sb: SupabaseClient, term: '30yr_fixed' | '15yr_fixed' | '5yr_arm' = '30yr_fixed'): Promise<number> {
  const col = `rate_${term}` as const;
  const { data } = await sb
    .from('goldmine_market_rates')
    .select(col)
    .order('survey_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const v = (data as Record<string, number | null> | null)?.[col];
  return v ?? DEFAULT_RATES[col as keyof typeof DEFAULT_RATES] ?? DEFAULT_RATES.rate_30yr_fixed;
}

/**
 * Refresh weekly from Freddie Mac PMMS. The public feed format is brittle, so this
 * is best-effort: on any failure it seeds the latest known/fallback rate for this
 * week so downstream signals keep working. Returns the survey row upserted.
 */
export async function updateMarketRates(sb: SupabaseClient): Promise<{ survey_date: string; rate_30yr_fixed: number }> {
  const today = new Date().toISOString().slice(0, 10);
  let rates = { ...DEFAULT_RATES };

  try {
    // Freddie Mac publishes PMMS as JSON; tolerate any shape/failure.
    const res = await fetch('https://www.freddiemac.com/pmms/docs/PMMS_history.json', {
      headers: { accept: 'application/json' },
      // PMMS is weekly; cache for a day.
      next: { revalidate: 86_400 },
    });
    if (res.ok) {
      const json = (await res.json()) as any;
      const rows = Array.isArray(json) ? json : json?.data ?? [];
      const latest = rows[rows.length - 1];
      const r30 = Number(latest?.pmms30 ?? latest?.rate_30yr ?? latest?.['30yr']);
      if (Number.isFinite(r30) && r30 > 0 && r30 < 20) {
        rates.rate_30yr_fixed = r30;
        const r15 = Number(latest?.pmms15 ?? latest?.rate_15yr);
        if (Number.isFinite(r15) && r15 > 0) rates.rate_15yr_fixed = r15;
      }
    }
  } catch (e) {
    console.error('[goldmine] PMMS fetch failed — seeding fallback', e);
  }

  // Carry forward the most recent stored rate if we couldn't fetch a fresh one.
  if (rates.rate_30yr_fixed === DEFAULT_RATES.rate_30yr_fixed) {
    const last = await getCurrentMarketRate(sb, '30yr_fixed');
    rates.rate_30yr_fixed = last;
  }

  await sb.from('goldmine_market_rates').upsert(
    { survey_date: today, ...rates, source: 'freddie_mac_pmms' },
    { onConflict: 'survey_date' },
  );
  return { survey_date: today, rate_30yr_fixed: rates.rate_30yr_fixed };
}
