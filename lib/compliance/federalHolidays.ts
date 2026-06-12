// Phase 84 — federal holidays, generated dynamically per year (no annual maintenance).
//
// TRID "specific business day" rule (12 CFR 1026.2(a)(6)): the legal public holidays of
// 5 U.S.C. 6103(a), counted on their ACTUAL dates — NOT the federal-employee "observed"
// weekday shift. A Saturday holiday is excluded on that Saturday; the preceding Friday
// still counts as a business day. Validated against the previously-vetted hardcoded set
// (2024–2028) by scripts/verify-federal-holidays.mjs — 55/55 dates match (the old set's
// lone Christmas-2027 "observed" entry was a bug this fixes).
//
// Off-by-one here is a CFPB violation, so this logic is deliberately simple and tested.

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const d = new Date(year, month, 1);
  let count = 0;
  while (true) {
    if (d.getDay() === weekday) {
      count++;
      if (count === n) return new Date(d);
    }
    d.setDate(d.getDate() + 1);
  }
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  const d = new Date(year, month + 1, 0); // last day of month
  while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
  return new Date(d);
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The 11 federal holidays for `year`, on their actual dates (no observed shifting). */
export function getFederalHolidays(year: number): Date[] {
  return [
    new Date(year, 0, 1),       // New Year's Day
    nthWeekday(year, 0, 1, 3),  // MLK Day — 3rd Monday January
    nthWeekday(year, 1, 1, 3),  // Presidents' Day — 3rd Monday February
    lastWeekday(year, 4, 1),    // Memorial Day — last Monday May
    new Date(year, 5, 19),      // Juneteenth
    new Date(year, 6, 4),       // Independence Day
    nthWeekday(year, 8, 1, 1),  // Labor Day — 1st Monday September
    nthWeekday(year, 9, 1, 2),  // Columbus Day — 2nd Monday October
    new Date(year, 10, 11),     // Veterans Day
    nthWeekday(year, 10, 4, 4), // Thanksgiving — 4th Thursday November
    new Date(year, 11, 25),     // Christmas
  ];
}

const cache = new Map<number, Set<string>>();
function holidaySet(year: number): Set<string> {
  let s = cache.get(year);
  if (!s) {
    s = new Set(getFederalHolidays(year).map(ymd));
    cache.set(year, s);
  }
  return s;
}

/** True if `date` is a federal public holiday (by local calendar date). */
export function isFederalHoliday(date: Date): boolean {
  return holidaySet(date.getFullYear()).has(ymd(date));
}
