# AshleyIQ — Mortgage Call Reports
## Claude Code Build Prompt · Sprint 4-G

---

## WHY THIS EXISTS

Branch managers and owners run their business on numbers — but mortgage-specific reporting doesn't exist in generic CRMs. Salesforce gives you pipeline charts. Surefire gives you marketing metrics. Neither gives a branch manager the P&L, the HMDA pre-report, the LO scorecard, or the pipeline velocity breakdown they actually need to run a branch.

AshleyIQ ships 7 native call reports that replace the spreadsheets branch managers have been building manually for years.

---

## THE 7 REPORTS

| # | Report | Primary User | Key Question Answered |
|---|---|---|---|
| 1 | **Production Report** | Branch Manager, Owner | How much did we fund this period? |
| 2 | **P&L Report** | Branch Manager, Owner | Are we profitable? |
| 3 | **HMDA Pre-Report** | Compliance Officer, Owner | Are we ready for HMDA filing? |
| 4 | **Pipeline Velocity Report** | Branch Manager, Team Lead | How fast are loans moving? |
| 5 | **Compliance Report** | Compliance Officer | Are there regulatory red flags? |
| 6 | **Referral Source Report** | Branch Manager, LO | Where are our best leads coming from? |
| 7 | **LO Scorecard** | Branch Manager, LO (own) | How is each LO performing? |

---

## EXECUTION ORDER

1. DB views (aggregate queries)
2. Reports API (data endpoints)
3. Report UI components
4. Report shell + navigation
5. Export (CSV + PDF)
6. Scheduled email delivery (optional)

---

## STEP 1 — DATABASE VIEWS

`supabase/migrations/010_report_views.sql`

```sql
-- Parameterized by org_id, date range — filter in queries

-- Production summary view
CREATE OR REPLACE VIEW v_production AS
SELECT
  l.org_id,
  DATE_TRUNC('month', l.closed_date) AS period,
  l.assigned_to AS lo_id,
  p.first_name || ' ' || p.last_name AS lo_name,
  COUNT(*) AS units_closed,
  SUM(l.loan_amount) AS volume,
  AVG(l.loan_amount) AS avg_loan_size,
  COUNT(*) FILTER (WHERE l.loan_type = 'conventional') AS conv_units,
  COUNT(*) FILTER (WHERE l.loan_type = 'fha') AS fha_units,
  COUNT(*) FILTER (WHERE l.loan_type = 'va') AS va_units,
  COUNT(*) FILTER (WHERE l.loan_type = 'jumbo') AS jumbo_units,
  SUM(l.loan_amount) FILTER (WHERE l.property_state IS NOT NULL) AS purchase_volume,
  COUNT(*) FILTER (WHERE l.loan_purpose = 'purchase') AS purchase_units,
  COUNT(*) FILTER (WHERE l.loan_purpose IN ('refinance','cash_out_refinance')) AS refi_units
FROM leads l
JOIN profiles p ON p.id = l.assigned_to
WHERE l.status = 'closed' AND l.closed_date IS NOT NULL
GROUP BY 1, 2, 3, 4;

-- Pipeline velocity view
CREATE OR REPLACE VIEW v_pipeline_velocity AS
SELECT
  l.org_id,
  l.assigned_to AS lo_id,
  p.first_name || ' ' || p.last_name AS lo_name,
  l.loan_type,
  l.loan_purpose,
  AVG(EXTRACT(EPOCH FROM (l.closed_date - l.created_at)) / 86400) AS avg_days_to_close,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (l.closed_date - l.created_at)) / 86400) AS median_days_to_close,
  COUNT(*) AS loans_in_sample,
  AVG(EXTRACT(EPOCH FROM (application_submitted_at - l.created_at)) / 86400) AS avg_days_lead_to_app,
  AVG(EXTRACT(EPOCH FROM (l.closed_date - application_submitted_at)) / 86400) AS avg_days_app_to_close
FROM leads l
JOIN profiles p ON p.id = l.assigned_to
WHERE l.status = 'closed' AND l.closed_date IS NOT NULL
GROUP BY 1, 2, 3, 4, 5;

-- Add application_submitted_at to leads if not present
ALTER TABLE leads ADD COLUMN IF NOT EXISTS application_submitted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS loan_type TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS closed_date DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS close_price NUMERIC(12,2);

-- Referral source summary
CREATE OR REPLACE VIEW v_referral_sources AS
SELECT
  l.org_id,
  DATE_TRUNC('month', l.created_at) AS period,
  COALESCE(l.source, 'unknown') AS source,
  l.source_metadata->>'referral_partner' AS referral_partner,
  COUNT(*) AS leads_received,
  COUNT(*) FILTER (WHERE l.status = 'closed') AS loans_closed,
  SUM(l.loan_amount) FILTER (WHERE l.status = 'closed') AS volume_closed,
  ROUND(COUNT(*) FILTER (WHERE l.status = 'closed')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS conversion_rate
FROM leads l
GROUP BY 1, 2, 3, 4;
```

---

## STEP 2 — REPORTS API

`app/api/reports/[type]/route.ts`

Single parameterized endpoint for all reports.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALLOWED_REPORT_TYPES = ['production','pl','hmda','velocity','compliance','referral','scorecard'] as const;
type ReportType = typeof ALLOWED_REPORT_TYPES[number];

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const type = params.type as ReportType;
  if (!ALLOWED_REPORT_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
  }

  const sb = createClient();
  const { data: profile } = await sb.from('profiles').select('id, org_id, role').eq('clerk_user_id', userId).single();

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('start') ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const endDate = searchParams.get('end') ?? new Date().toISOString().slice(0, 10);
  const loId = searchParams.get('lo_id');  // filter by specific LO (null = all)

  // LOs can only see their own scorecard
  const effectiveLoId = profile!.role === 'lo' ? profile!.id : (loId ?? null);

  let data: unknown;

  switch (type) {
    case 'production':
      data = await getProductionReport(sb, profile!.org_id, startDate, endDate, effectiveLoId);
      break;
    case 'pl':
      data = await getPLReport(sb, profile!.org_id, startDate, endDate, effectiveLoId);
      break;
    case 'hmda':
      data = await getHMDAReport(sb, profile!.org_id, startDate, endDate);
      break;
    case 'velocity':
      data = await getVelocityReport(sb, profile!.org_id, startDate, endDate, effectiveLoId);
      break;
    case 'compliance':
      data = await getComplianceReport(sb, profile!.org_id, startDate, endDate);
      break;
    case 'referral':
      data = await getReferralReport(sb, profile!.org_id, startDate, endDate, effectiveLoId);
      break;
    case 'scorecard':
      data = await getScorecardReport(sb, profile!.org_id, startDate, endDate, effectiveLoId);
      break;
  }

  return NextResponse.json({ report: type, start: startDate, end: endDate, data });
}
```

---

## STEP 3 — REPORT DATA FUNCTIONS

`lib/reports/production.ts`

```typescript
export async function getProductionReport(sb: any, orgId: string, start: string, end: string, loId: string | null) {
  let q = sb.from('v_production').select('*').eq('org_id', orgId)
    .gte('closed_date', start).lte('closed_date', end);
  if (loId) q = q.eq('lo_id', loId);
  const { data } = await q.order('period', { ascending: false });

  // Aggregate totals
  const totals = (data ?? []).reduce((acc: Record<string, number>, row: Record<string, number>) => ({
    units: (acc.units ?? 0) + row.units_closed,
    volume: (acc.volume ?? 0) + row.volume,
    purchase_units: (acc.purchase_units ?? 0) + row.purchase_units,
    refi_units: (acc.refi_units ?? 0) + row.refi_units,
  }), {});

  return { rows: data ?? [], totals };
}
```

`lib/reports/pl.ts`

```typescript
export async function getPLReport(sb: any, orgId: string, start: string, end: string, loId: string | null) {
  // Gross revenue = sum of pay_run_items.gross_comp (branch take) for closed loans in period
  // LO comp = sum of pay_run_items.net_comp
  // Branch profit = gross revenue - LO comp - overhead
  // NOTE: Overhead must be configured per org (flat monthly or % of revenue)
  const { data: payItems } = await sb
    .from('pay_run_items')
    .select('*, pay_runs!inner(lo_id, pay_period_start, pay_period_end, org_id)')
    .eq('pay_runs.org_id', orgId)
    .gte('close_date', start).lte('close_date', end);

  const rows = (payItems ?? []).map((item: Record<string, unknown>) => ({
    lo_id: (item.pay_runs as Record<string, unknown>).lo_id,
    loan_amount: item.loan_amount,
    gross_comp: item.gross_comp,    // branch revenue
    lo_comp: item.net_comp,          // LO's cut
    branch_margin: Number(item.gross_comp) - Number(item.net_comp),
  }));

  return {
    rows,
    totals: {
      gross_revenue: rows.reduce((s, r) => s + r.gross_comp, 0),
      total_lo_comp: rows.reduce((s, r) => s + r.lo_comp, 0),
      branch_profit: rows.reduce((s, r) => s + r.branch_margin, 0),
    },
  };
}
```

`lib/reports/hmda.ts`

```typescript
export async function getHMDAReport(sb: any, orgId: string, start: string, end: string) {
  // HMDA LAR fields: loan amount, loan type, purpose, occupancy, property type,
  //   action taken, applicant race/ethnicity/sex, income, denial reason
  // Pull from pos_applications where submitted_at in range
  const { data } = await sb
    .from('pos_applications')
    .select('id, app_reference, loan_amount, loan_type:loan_purpose, property_type, property_state, demographics, submitted_at, status')
    .eq('org_id', orgId)
    .gte('submitted_at', start).lte('submitted_at', end)
    .order('submitted_at');

  const issues: string[] = [];
  (data ?? []).forEach((app: Record<string, unknown>) => {
    if (!app.loan_amount) issues.push(`${app.app_reference}: missing loan amount`);
    if (!app.property_state) issues.push(`${app.app_reference}: missing property state`);
    // Demographics collected on POS Step 8 — if missing, flag for HMDA
    const demo = app.demographics as Record<string, unknown>;
    if (!demo?.race && !demo?.ethnicity) {
      issues.push(`${app.app_reference}: demographic info not collected (HMDA required)`);
    }
  });

  return {
    applications: data ?? [],
    total: (data ?? []).length,
    hmda_issues: issues,
    ready_for_filing: issues.length === 0,
  };
}
```

`lib/reports/compliance.ts`

```typescript
export async function getComplianceReport(sb: any, orgId: string, start: string, end: string) {
  const flags: Array<{ severity: string; type: string; description: string; lead_id?: string }> = [];

  // Check 1: Leads without TCPA consent who received SMS
  const { data: noTcpaSms } = await sb
    .from('leads')
    .select('id, first_name, last_name')
    .eq('org_id', orgId)
    .is('tcpa_consent_at', null)
    .gte('created_at', start);
  // Cross-reference with speed_to_lead_events sms_sent
  // (Simplified: flag leads with no TCPA consent created in period)
  (noTcpaSms ?? []).forEach((l: Record<string, string>) =>
    flags.push({ severity: 'high', type: 'tcpa_missing', description: `No TCPA consent on file: ${l.first_name} ${l.last_name}`, lead_id: l.id }));

  // Check 2: Loans past 3-business-day RESPA GFE deadline (application → LE not issued within 3 days)
  // TODO: implement when Loan Estimate issuance is tracked

  // Check 3: CROA — credit repair borrowers charged before service rendered
  // Check credit_repair_subscriptions — flag if pull fired before subscription_status = 'active'

  // Check 4: Pay runs with comp that varies by loan type (would violate LO Comp Rule)
  // Already prevented by comp engine design — include note in report

  return {
    flags,
    flag_count: flags.length,
    high_severity: flags.filter(f => f.severity === 'high').length,
    medium_severity: flags.filter(f => f.severity === 'medium').length,
    period: { start, end },
  };
}
```

---

## STEP 4 — REPORT UI COMPONENTS

`app/(dashboard)/reports/page.tsx` — Report selector with date range.

`app/(dashboard)/reports/[type]/page.tsx` — Renders the appropriate report component.

**Production Report UI:**
```
PRODUCTION REPORT
Period: Jun 1 – Jun 30, 2026  [Export CSV] [Export PDF]

Total Volume: $4.2M     Units: 11     Avg Loan Size: $381K
Purchase: 7 (64%)       Refi: 4 (36%)

BY LOAN OFFICER          Units    Volume      Avg Size
Ashley Leyva             6        $2.3M       $383K
James Carter             3        $1.1M       $367K
Maria Torres             2        $0.8M       $400K

BY LOAN TYPE             Units    Volume
Conventional             7        $2.8M
FHA                      2        $580K
VA                       1        $390K
Jumbo                    1        $430K
```

**P&L Report UI:**
```
P&L REPORT — Jun 2026
Gross Revenue:         $105,000
LO Compensation:       -$42,000
Branch Margin:         $63,000
Branch Margin %:       60%

VS PRIOR MONTH:   +$12,000 (+13%)
```

**LO Scorecard UI (per LO):**
```
SCORECARD — Ashley Leyva — Jun 2026
Applications Received:  12
Loans Closed:           6     Closing Rate: 50%
Avg Days to Close:      31.4
Response Time (Leads):  3m 12s  [Industry avg: 47min]
Outstanding Conditions: 14    Overdue: 2
Referral Partners:      3 active
```

---

## STEP 5 — EXPORT

`app/api/reports/[type]/export/route.ts`

```typescript
// CSV: returns formatted CSV with headers and rows
// PDF: use pdf skill (supabase/functions or jsPDF)
// Both triggered by [Export CSV] and [Export PDF] buttons
// Include: org name, report name, date range, generated timestamp
```

---

## STEP 6 — SCHEDULED EMAIL DELIVERY (Optional, Phase 2)

```typescript
// Let branch manager configure: "Email me this report every Monday at 8 AM"
// Use Supabase pg_cron + Resend
// Report rendered as HTML email table
// Recipient: branch_manager + any configured email recipients
```

---

## VERIFICATION CHECKLIST

- [ ] All 7 report types load without error
- [ ] Date range filter applies to all reports
- [ ] LO role can only see their own scorecard (not branch-wide data)
- [ ] Production report totals match sum of individual LO rows
- [ ] P&L report calculates branch margin correctly
- [ ] HMDA report flags applications missing demographics
- [ ] HMDA report marks `ready_for_filing: true` only when no issues
- [ ] Compliance report flags leads without TCPA consent
- [ ] Referral source report ranks sources by closed volume
- [ ] LO scorecard shows average response time from `lead_assignments`
- [ ] CSV export downloads correctly with proper column headers
- [ ] Report page requires authenticated Clerk session
- [ ] LO cannot navigate to /reports/pl or /reports/compliance (branch-manager only)
