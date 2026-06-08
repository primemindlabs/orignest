# AshleyIQ — Recruiting Pipeline (Branch Manager Module)
## Claude Code Build Prompt · Sprint 4-E

---

## WHY THIS EXISTS

Branch managers recruit constantly. They're tracking 20–40 LO prospects at any given time, juggling NMLS production lookups, comp scenario modeling, and P&L projections. They do all of this in spreadsheets, memory, and sticky notes — there is no CRM built for mortgage recruiting.

This module thinks like a branch manager: it surfaces who's worth recruiting, models what they'd cost and generate, and manages the conversation from first contact to signed offer.

**Data source:** NMLS Nationwide Licensing System (public) provides LO production history, license status, and employer history. We call the public NMLS lookup API (or use CredifyID's PSV module which already covers NMLS).

---

## WHO USES THIS

- `branch_manager` role
- `admin` role
- Authorized `team_lead` role (read-only)

---

## EXECUTION ORDER

1. DB migration
2. Prospect NMLS lookup + enrichment
3. Recruiting pipeline board (Kanban)
4. Comp scenario modeler
5. P&L projection engine
6. Activity log + outreach
7. Dashboard and reporting

---

## STEP 1 — DATABASE MIGRATION

`supabase/migrations/008_recruiting.sql`

```sql
-- LO recruit prospects
CREATE TABLE IF NOT EXISTS recruit_prospects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owned_by              UUID NOT NULL REFERENCES profiles(id),
  -- Identity
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  linkedin_url          TEXT,
  -- NMLS Data
  nmls_id               TEXT,
  nmls_verified         BOOLEAN DEFAULT false,
  nmls_license_states   TEXT[],
  nmls_employer         TEXT,
  nmls_employer_since   DATE,
  -- Production (from NMLS public data or manual entry)
  trailing_12_units     INT,
  trailing_12_volume    NUMERIC(14,2),
  avg_loan_size         NUMERIC(12,2),
  loan_types            TEXT[],  -- conv, fha, va, jumbo, etc.
  -- Pipeline Stage
  stage                 TEXT NOT NULL DEFAULT 'identified'
    CHECK (stage IN ('identified','contacted','first_meeting','second_meeting',
                     'offer_sent','offer_accepted','onboarding','passed','rejected','competitor_hired')),
  priority              TEXT DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  source                TEXT,  -- referral, linkedin, nmls_search, conference, etc.
  recruiter_notes       TEXT,
  -- Offer Tracking
  comp_scenario_id      UUID,  -- FK to comp_scenarios
  offer_sent_at         TIMESTAMPTZ,
  offer_expires_at      TIMESTAMPTZ,
  offer_accepted_at     TIMESTAMPTZ,
  start_date            DATE,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Comp scenarios for a prospect
CREATE TABLE IF NOT EXISTS comp_scenarios (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id           UUID NOT NULL REFERENCES recruit_prospects(id) ON DELETE CASCADE,
  org_id                UUID NOT NULL,
  created_by            UUID NOT NULL REFERENCES profiles(id),
  scenario_name         TEXT NOT NULL DEFAULT 'Base Scenario',
  -- Projections based on trailing 12
  projected_monthly_units INT,
  projected_monthly_volume NUMERIC(14,2),
  projected_monthly_revenue NUMERIC(12,2),
  -- Comp structure offered
  comp_type             TEXT NOT NULL CHECK (comp_type IN ('bps','flat','percent_revenue','tiered')),
  comp_bps              NUMERIC(8,4),
  comp_flat_per_file    NUMERIC(10,2),
  comp_percent_revenue  NUMERIC(5,4),
  -- Financials
  monthly_draw          NUMERIC(10,2) DEFAULT 0,
  signing_bonus         NUMERIC(10,2) DEFAULT 0,
  marketing_budget      NUMERIC(10,2) DEFAULT 0,
  expected_monthly_comp NUMERIC(12,2),
  expected_monthly_gross_revenue NUMERIC(12,2),
  expected_monthly_branch_profit NUMERIC(12,2),
  breakeven_months      NUMERIC(5,1),
  -- Notes
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- Recruiting activity log
CREATE TABLE IF NOT EXISTS recruit_activities (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id           UUID NOT NULL REFERENCES recruit_prospects(id) ON DELETE CASCADE,
  org_id                UUID NOT NULL,
  actor_id              UUID NOT NULL REFERENCES profiles(id),
  activity_type         TEXT NOT NULL,
  -- note / email / call / meeting / stage_change / offer_sent / offer_accepted / rejected
  title                 TEXT NOT NULL,
  body                  TEXT,
  stage_from            TEXT,
  stage_to              TEXT,
  occurred_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_follow_up        TIMESTAMPTZ
);

-- RLS
ALTER TABLE recruit_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE comp_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruit_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_recruit_prospects" ON recruit_prospects
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid())
    AND (SELECT role FROM profiles WHERE clerk_user_id = auth.uid()) IN ('branch_manager','admin','team_lead'));

CREATE POLICY "org_comp_scenarios" ON comp_scenarios
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid())
    AND (SELECT role FROM profiles WHERE clerk_user_id = auth.uid()) IN ('branch_manager','admin'));

CREATE POLICY "org_recruit_activities" ON recruit_activities
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid())
    AND (SELECT role FROM profiles WHERE clerk_user_id = auth.uid()) IN ('branch_manager','admin','team_lead'));

CREATE INDEX IF NOT EXISTS idx_recruits_org ON recruit_prospects(org_id, stage);
```

---

## STEP 2 — NMLS LOOKUP INTEGRATION

`app/api/recruiting/nmls-lookup/route.ts`

Two sources in priority order:
1. **CredifyID API** (internal PrimeMind platform product) — already has NMLS PSV for 22+ states; fastest path
2. **NMLS Consumer Access** public API — free, covers all states but limited data

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const nmlsId = searchParams.get('nmlsId');
  const name = searchParams.get('name');

  if (!nmlsId && !name) return NextResponse.json({ error: 'Provide nmlsId or name' }, { status: 400 });

  // Option 1: CredifyID (preferred — internal platform product)
  if (process.env.CREDIFYID_API_KEY) {
    const res = await fetch(`${process.env.CREDIFYID_API_URL}/v1/nmls/lookup?${nmlsId ? `nmlsId=${nmlsId}` : `name=${encodeURIComponent(name!)}`}`, {
      headers: { Authorization: `Bearer ${process.env.CREDIFYID_API_KEY}` },
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ source: 'credifyid', data });
    }
  }

  // Option 2: NMLS Consumer Access public API
  // https://www.nmlsconsumeraccess.org/
  // TODO: Implement NMLS Consumer Access API call when CredifyID unavailable
  // Returns: name, nmls_id, license_states, employer, employer_since
  return NextResponse.json({
    source: 'nmls_public',
    data: null,
    message: 'NMLS lookup requires CredifyID configuration or manual entry',
  });
}
```

**Enrich prospect from NMLS:**
When branch manager adds a prospect with NMLS ID, the UI auto-populates:
- License states
- Current employer
- Employer start date (proxy for tenure)

Production data (trailing 12 units/volume) must be entered manually — NMLS public data does not include production history. However, Modex and Arive provide production data APIs (future integration note — document as Phase 2).

---

## STEP 3 — RECRUITING PIPELINE BOARD

`app/(dashboard)/recruiting/page.tsx`

Kanban board with swim lanes by stage. Drag-and-drop stage changes.

**Stage columns:**
```
Identified → Contacted → First Meeting → Second Meeting → Offer Sent → Offer Accepted
                                                                     ↘ Passed / Rejected
```

**Prospect card shows:**
```
[Photo placeholder]
Michael Torres · NMLS #1234567
Currently at: Premier Mortgage Group
T12: 48 units · $18.2M volume
States: GA, FL, TX
Priority: [HIGH]
[Follow up: Jun 10]
```

**Card actions:**
- Click → open prospect detail panel (right drawer)
- Drag → move to new stage
- Badge: ⚡ if follow-up date is past due

---

## STEP 4 — COMP SCENARIO MODELER

`app/(dashboard)/recruiting/[id]/comp-scenarios/page.tsx`

Inputs (all editable):
| Field | Default | Description |
|---|---|---|
| Projected Monthly Units | T12 Units / 12 | Units/month expected from this LO |
| Avg Loan Size | From NMLS/manual | Average loan amount |
| Projected Monthly Volume | Units × Avg Size | Auto-calculated |
| Gross Revenue (BPS) | 250 BPS | Revenue per loan (branch's take) |
| LO Comp (BPS) | 100 BPS | What you're offering LO |
| Monthly Draw | $0 | Guaranteed draw against commission |
| Signing Bonus | $0 | One-time signing incentive |
| Marketing Budget | $0/mo | Monthly marketing allowance |

**Calculated fields:**
```
Projected Monthly Gross Revenue = Monthly Volume × (Revenue BPS / 10,000)
LO Monthly Comp = Monthly Volume × (LO Comp BPS / 10,000) + Draw
Monthly Branch Profit = Gross Revenue − LO Comp − Draw − Marketing Budget − overhead
Breakeven Months = (Signing Bonus + onboarding costs) / Monthly Branch Profit
```

**Output summary card:**
```
SCENARIO: "Base — 100 BPS"
LO earns: $15,000/mo on $18M/mo volume
You gross: $45,000/mo revenue
Branch profit: $27,500/mo
Breakeven: 2.4 months
ROI at 12 months: 832%
```

Multiple scenarios per prospect (Base, Aggressive, Conservative). Branch manager can share a scenario PDF with the prospect.

`app/api/recruiting/[id]/comp-scenarios/route.ts`

```typescript
// POST — create scenario with auto-calculated financials
// Validate: comp_type required, projections required
// Save to comp_scenarios
// Return calculated monthly comp, revenue, profit, breakeven
```

---

## STEP 5 — P&L PROJECTION ENGINE

`lib/recruiting/pl-projection.ts`

```typescript
interface ScenarioInputs {
  projectedMonthlyUnits: number;
  avgLoanSize: number;
  grossRevenueBps: number;  // branch's revenue per loan
  loCompBps: number;        // LO's comp
  monthlyDraw: number;
  signingBonus: number;
  marketingBudget: number;
  branchOverheadShare: number;  // allocated monthly overhead (e.g. $2,000)
  rampMonths: number;           // months to reach full production (default 3)
}

export function calculateScenario(inputs: ScenarioInputs) {
  const monthlyVolume = inputs.projectedMonthlyUnits * inputs.avgLoanSize;
  const monthlyGrossRevenue = (monthlyVolume * inputs.grossRevenueBps) / 10000;
  const monthlyLoComp = Math.max((monthlyVolume * inputs.loCompBps) / 10000, inputs.monthlyDraw);
  const monthlyBranchCost = monthlyLoComp + inputs.marketingBudget + inputs.branchOverheadShare;
  const monthlyBranchProfit = monthlyGrossRevenue - monthlyBranchCost;
  const totalUpfrontCost = inputs.signingBonus + (inputs.monthlyDraw * inputs.rampMonths);
  const breakEvenMonths = monthlyBranchProfit > 0 ? totalUpfrontCost / monthlyBranchProfit : Infinity;

  return {
    monthlyVolume,
    monthlyGrossRevenue,
    monthlyLoComp,
    monthlyBranchProfit,
    breakEvenMonths: Number(breakEvenMonths.toFixed(1)),
    annualBranchProfit: monthlyBranchProfit * 12,
    roi12Month: totalUpfrontCost > 0 ? ((monthlyBranchProfit * 12 - totalUpfrontCost) / totalUpfrontCost) * 100 : null,
  };
}
```

---

## STEP 6 — ACTIVITY LOG + OUTREACH

**Log an activity (modal):**
- Type: Note / Call / Email / Meeting / Stage Change
- Title + notes
- Next follow-up date
- If Email type: drafts email template using Claude Haiku

`app/api/recruiting/[id]/activities/route.ts`

```typescript
// POST — log activity, update prospect.updated_at, set next_follow_up on prospect
// If stage changes: update recruit_prospects.stage, log stage_from/stage_to
// Notify branch manager if follow-up date is set (scheduled reminder)
```

**Claude-generated outreach templates** (Haiku):
When activity type = 'email', show a "Draft Email" button:
- "First outreach to LO at [current employer]"
- "Follow-up after meeting"
- "Offer letter cover email"
- Custom prompt

Generates a warm, professional, non-desperate email. No "I know you're busy" language.

---

## STEP 7 — RECRUITING DASHBOARD

`app/(dashboard)/recruiting/dashboard/page.tsx`

Key metrics:
- **Pipeline velocity** — avg days per stage
- **Conversion rate** — Identified → Hired
- **Projected new production** — total projected monthly volume from offer-accepted prospects
- **Recruiting ROI** — total expected branch profit vs. recruiting costs
- **Open follow-ups** — count of overdue follow-up dates

**Table view toggle:** switch between Kanban and sortable table.

---

## VERIFICATION CHECKLIST

- [ ] Only `branch_manager`, `admin`, and read-only `team_lead` can access recruiting routes
- [ ] NMLS lookup with valid NMLS ID returns license states + employer
- [ ] Prospect created with NMLS data auto-populated
- [ ] Kanban board renders all stages with drag-to-move
- [ ] Moving prospect to new stage logs activity with stage_from/stage_to
- [ ] Comp scenario calculator: 48 units × $380K avg × 100 BPS = correct monthly comp
- [ ] P&L projection shows breakeven months correctly
- [ ] Multiple scenarios per prospect (Base / Aggressive / Conservative)
- [ ] Activity log shows chronological timeline on prospect detail page
- [ ] Overdue follow-up dates shown with ⚠️ indicator on card
- [ ] Claude draft email generated for first outreach
- [ ] Recruiting dashboard loads key metrics
- [ ] LO (non-manager role) cannot access /dashboard/recruiting at all
