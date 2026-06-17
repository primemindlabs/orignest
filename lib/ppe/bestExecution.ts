// Phase 142 — best-execution ranking + anti-steering selection (PURE).

import type { PricedProduct, AntiSteeringOptions } from './types';
import { hasRiskyFeature } from './types';

/**
 * Rank eligible products by least cost to the borrower: highest adjusted price
 * (fewest points) first, breaking ties by lower note rate. This is the order a
 * broker should present "best price" in.
 */
export function rankBestExecution(products: PricedProduct[]): PricedProduct[] {
  return [...products].sort(
    (a, b) => b.adjustedPrice - a.adjustedPrice || a.noteRate - b.noteRate,
  );
}

/**
 * The three options the §1026.36(e)(3) anti-steering safe harbor requires the LO
 * to be able to present, for the loan type the borrower expressed interest in:
 *   (A) lowest interest rate
 *   (B) lowest rate WITHOUT negative-am / prepay penalty / interest-only / balloon
 *   (C) lowest total cost (lowest discount/origination points & fees)
 * Higher adjusted price = fewer points = lower cost, so (C) is the max adjusted price.
 */
export function selectAntiSteering(products: PricedProduct[]): AntiSteeringOptions {
  if (products.length === 0) {
    return { lowestRate: null, lowestRateNoRiskyFeatures: null, lowestTotalCost: null };
  }

  const byRate = (a: PricedProduct, b: PricedProduct) =>
    a.noteRate - b.noteRate || b.adjustedPrice - a.adjustedPrice;

  const lowestRate = [...products].sort(byRate)[0] ?? null;

  const safe = products.filter((p) => !hasRiskyFeature(p.risky));
  const lowestRateNoRiskyFeatures = safe.length ? [...safe].sort(byRate)[0] : null;

  const lowestTotalCost =
    [...products].sort((a, b) => b.adjustedPrice - a.adjustedPrice || a.noteRate - b.noteRate)[0] ?? null;

  return { lowestRate, lowestRateNoRiskyFeatures, lowestTotalCost };
}
