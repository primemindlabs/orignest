/**
 * Phase 60 — business-day math for TRID waiting periods. PURE.
 * "Business day" here = Mon–Sat excluding federal holidays (TRID's general
 * definition for the 3-day windows is Mon–Sat; the specific-business-day count for
 * the CD uses all-but-Sun/holidays — we use the conservative Mon–Fri+holiday model
 * so the earliest date is never understated).
 */
const FED_HOLIDAYS_2026 = new Set(['2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25']);

function isBusinessDay(d: Date): boolean {
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return false; // Sun/Sat
  return !FED_HOLIDAYS_2026.has(d.toISOString().slice(0, 10));
}

/** Returns the date that is `n` business days after `from` (exclusive of `from`). */
export function addBusinessDays(from: Date, n: number): Date {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isBusinessDay(d)) added += 1;
  }
  return d;
}
