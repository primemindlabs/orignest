// Phase 83 — 4-week weighted capacity forecast (PURE). Buckets loans by close date into
// 4 weekly buckets starting this week's Monday. weighted_value = loan_amount × score/100.

import { startOfWeek, addWeeks, addDays, format } from 'date-fns';

export type ForecastLoan = {
  id: string;
  loan_amount: number | null;
  closing_date: string | null;
};

export type WeekBucket = {
  week_start: string; // YYYY-MM-DD (Monday)
  week_label: string; // e.g. "Jun 16"
  weighted_value: number;
  loan_count: number;
};

/** Mondays of the current week + next 3 weeks. */
export function getNextFourWeekStarts(now = new Date()): Date[] {
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  return [0, 1, 2, 3].map((i) => addWeeks(monday, i));
}

function inWeek(dateISO: string | null, weekStart: Date): boolean {
  if (!dateISO) return false;
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return false;
  const end = addDays(weekStart, 7);
  return d >= weekStart && d < end;
}

export function buildFourWeekForecast(
  loans: ForecastLoan[],
  scoreById: Record<string, number>,
  now = new Date(),
): WeekBucket[] {
  return getNextFourWeekStarts(now).map((weekStart) => {
    const inBucket = loans.filter((l) => inWeek(l.closing_date, weekStart));
    const weighted = inBucket.reduce(
      (sum, l) => sum + (l.loan_amount ?? 0) * ((scoreById[l.id] ?? 50) / 100),
      0,
    );
    return {
      week_start: format(weekStart, 'yyyy-MM-dd'),
      week_label: format(weekStart, 'MMM d'),
      weighted_value: Math.round(weighted),
      loan_count: inBucket.length,
    };
  });
}
