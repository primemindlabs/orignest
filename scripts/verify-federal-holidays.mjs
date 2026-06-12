// Phase 84 — runnable compliance test for the federal-holiday generator.
// No deps: `node scripts/verify-federal-holidays.mjs`. Validates the dynamic generator
// against the previously-vetted hardcoded set (2024–2028). The single intentional
// divergence is Christmas 2027: the old hardcoded set listed 2027-12-24 (an incorrect
// "observed" shift); Dec 25 2027 is a Saturday and, under TRID's specific business-day
// rule (12 CFR 1026.2(a)(6)), the actual date 2027-12-25 is the holiday. So the generator
// is MORE correct than the old set. Off-by-one here = CFPB violation, hence this test.

function nthWeekday(year, month, weekday, n) {
  const d = new Date(year, month, 1);
  let c = 0;
  while (true) { if (d.getDay() === weekday) { c++; if (c === n) return new Date(d); } d.setDate(d.getDate() + 1); }
}
function lastWeekday(year, month, weekday) {
  const d = new Date(year, month + 1, 0);
  while (d.getDay() !== weekday) d.setDate(d.getDate() - 1);
  return new Date(d);
}
function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

// TRID uses ACTUAL holiday dates — no weekday "observed" shifting.
export function federalHolidayStrings(year) {
  return [
    new Date(year, 0, 1),            // New Year's Day
    nthWeekday(year, 0, 1, 3),       // MLK Day — 3rd Mon Jan
    nthWeekday(year, 1, 1, 3),       // Presidents' Day — 3rd Mon Feb
    lastWeekday(year, 4, 1),         // Memorial Day — last Mon May
    new Date(year, 5, 19),           // Juneteenth
    new Date(year, 6, 4),            // Independence Day
    nthWeekday(year, 8, 1, 1),       // Labor Day — 1st Mon Sep
    nthWeekday(year, 9, 1, 2),       // Columbus Day — 2nd Mon Oct
    new Date(year, 10, 11),          // Veterans Day
    nthWeekday(year, 10, 4, 4),      // Thanksgiving — 4th Thu Nov
    new Date(year, 11, 25),          // Christmas
  ].map(ymd);
}

const vetted = {
  2024: ['2024-01-01','2024-01-15','2024-02-19','2024-05-27','2024-06-19','2024-07-04','2024-09-02','2024-10-14','2024-11-11','2024-11-28','2024-12-25'],
  2025: ['2025-01-01','2025-01-20','2025-02-17','2025-05-26','2025-06-19','2025-07-04','2025-09-01','2025-10-13','2025-11-11','2025-11-27','2025-12-25'],
  2026: ['2026-01-01','2026-01-19','2026-02-16','2026-05-25','2026-06-19','2026-07-04','2026-09-07','2026-10-12','2026-11-11','2026-11-26','2026-12-25'],
  2027: ['2027-01-01','2027-01-18','2027-02-15','2027-05-31','2027-06-19','2027-07-04','2027-09-06','2027-10-11','2027-11-11','2027-11-25','2027-12-25'],
  2028: ['2028-01-01','2028-01-17','2028-02-21','2028-05-29','2028-06-19','2028-07-04','2028-09-04','2028-10-09','2028-11-11','2028-11-23','2028-12-25'],
};

let fail = 0;
for (const y of Object.keys(vetted)) {
  const got = federalHolidayStrings(Number(y));
  vetted[y].forEach((want, i) => {
    if (got[i] !== want) { fail++; console.log(`FAIL ${y}[${i}]: got ${got[i]} want ${want}`); }
  });
}
console.log(fail === 0 ? 'PASS: 55/55 federal holidays correct (2024–2028)' : `FAIL: ${fail} mismatches`);
if (fail !== 0) process.exit(1);
