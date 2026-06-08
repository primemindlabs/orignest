# AshleyIQ — LO Payroll Workflow
## Claude Code Build Prompt · Sprint 4-D

---

## WHY THIS EXISTS

Payroll is the stickiest feature a mortgage CRM can have. Once a branch manager runs payroll through AshleyIQ, they will never leave — switching costs become enormous. No mortgage-specific CRM does this well. Surefire doesn't do it at all.

This is NOT a full payroll processor (no W-2s, no tax withholding, no direct deposit). That would require ADP integration or a payroll license. This is an **LO commission payroll workflow**: the tool that manages the approval chain from LO to Team Lead to HR, calculates the commission, generates the pay stub, and records it — with full compliance logging.

**Compliance note:** This module calculates based on compensation plans ALREADY configured by HR/admin. It does NOT determine comp based on loan terms (that would violate CFPB LO Comp Rule, Reg Z 12 CFR 1026.36). Comp plans are defined as flat dollar amounts, basis points on loan amount, or per-file fees.

---

## APPROVAL CHAIN

```
LO submits pay run request
    ↓
Team Lead reviews (approve / escalate to HR / flag)
    ↓
HR approves and issues (generate pay stub, mark paid, export to accounting)
```

All status changes are append-only logged.

---

## EXECUTION ORDER

1. DB migration
2. Comp plans
3. Pay run creation (LO)
4. Team Lead review workflow
5. HR issuance + pay stub
6. Pay history dashboard
7. Export to accounting (CSV/QuickBooks format)

---

## STEP 1 — DATABASE MIGRATION

`supabase/migrations/007_payroll.sql`

```sql
-- Compensation plan templates
CREATE TABLE IF NOT EXISTS comp_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  -- Comp type: flat (per-file), bps (basis points of loan amount), percent_revenue, custom
  comp_type       TEXT NOT NULL CHECK (comp_type IN ('flat','bps','percent_revenue','tiered','custom')),
  base_amount     NUMERIC(10,2),   -- flat dollar amount per file
  bps             NUMERIC(8,4),    -- basis points (e.g. 100 = 1.00%)
  percent_revenue NUMERIC(5,4),    -- e.g. 0.20 = 20% of net revenue
  tiered_rules    JSONB,           -- array of {min_volume, max_volume, rate} for tiered plans
  -- Adjustments
  split_with_branch NUMERIC(5,4) DEFAULT 0,  -- branch cut before LO comp
  override_ids    UUID[],          -- manager overrides
  active          BOOLEAN DEFAULT true,
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Assign comp plan to a profile
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS comp_plan_id UUID REFERENCES comp_plans(id);

-- Pay run: a batch of loans submitted for payout
CREATE TABLE IF NOT EXISTS pay_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  lo_id           UUID NOT NULL REFERENCES profiles(id),
  pay_period_start DATE NOT NULL,
  pay_period_end   DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','team_lead_review','approved','flagged','issued','void')),
  total_loans     INT NOT NULL DEFAULT 0,
  gross_commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  adjustments     NUMERIC(12,2) NOT NULL DEFAULT 0,  -- chargebacks, clawbacks, advances
  net_commission  NUMERIC(12,2) NOT NULL DEFAULT 0,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Team Lead
  team_lead_id    UUID REFERENCES profiles(id),
  team_lead_action TEXT CHECK (team_lead_action IN ('approved','escalated','flagged')),
  team_lead_note  TEXT,
  team_lead_acted_at TIMESTAMPTZ,
  -- HR
  hr_id           UUID REFERENCES profiles(id),
  hr_action       TEXT CHECK (hr_action IN ('approved','void')),
  hr_note         TEXT,
  hr_acted_at     TIMESTAMPTZ,
  issued_at       TIMESTAMPTZ,
  pay_stub_url    TEXT  -- Supabase Storage URL
);

-- Individual line items within a pay run
CREATE TABLE IF NOT EXISTS pay_run_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_run_id      UUID NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL,
  lead_id         UUID REFERENCES leads(id),
  loan_number     TEXT,
  borrower_name   TEXT NOT NULL,
  loan_amount     NUMERIC(12,2) NOT NULL,
  close_date      DATE NOT NULL,
  comp_type       TEXT NOT NULL,
  comp_basis      NUMERIC(12,2),  -- loan amount, revenue, etc.
  bps_applied     NUMERIC(8,4),
  flat_fee        NUMERIC(10,2),
  gross_comp      NUMERIC(10,2) NOT NULL,
  branch_split    NUMERIC(10,2) DEFAULT 0,
  net_comp        NUMERIC(10,2) NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Adjustments: chargebacks, advances, clawbacks
CREATE TABLE IF NOT EXISTS pay_adjustments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_run_id      UUID NOT NULL REFERENCES pay_runs(id),
  org_id          UUID NOT NULL,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('chargeback','advance_recovery','clawback','bonus','other')),
  amount          NUMERIC(10,2) NOT NULL,  -- positive = bonus, negative = deduction
  description     TEXT NOT NULL,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Append-only payroll audit log
CREATE TABLE IF NOT EXISTS payroll_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_run_id      UUID NOT NULL REFERENCES pay_runs(id),
  org_id          UUID NOT NULL,
  event_type      TEXT NOT NULL,
  -- submitted / team_lead_approved / team_lead_escalated / team_lead_flagged /
  -- hr_approved / hr_void / issued / adjusted / note_added
  actor_id        UUID REFERENCES profiles(id),
  actor_role      TEXT,
  note            TEXT,
  metadata        JSONB DEFAULT '{}',
  occurred_at     TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE comp_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_events ENABLE ROW LEVEL SECURITY;

-- Comp plans: HR/admin only can write; all org members can read
CREATE POLICY "read_comp_plans" ON comp_plans FOR SELECT
  USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));
CREATE POLICY "manage_comp_plans" ON comp_plans FOR ALL
  USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid())
    AND (SELECT role FROM profiles WHERE clerk_user_id = auth.uid()) IN ('hr','admin'));

-- Pay runs: LO sees own; TL sees team; HR/admin sees all
CREATE POLICY "lo_pay_runs" ON pay_runs FOR ALL
  USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid())
    AND (
      lo_id = (SELECT id FROM profiles WHERE clerk_user_id = auth.uid())
      OR (SELECT role FROM profiles WHERE clerk_user_id = auth.uid()) IN ('team_lead','hr','admin','branch_manager')
    ));

-- Events: append-only
CREATE POLICY "insert_payroll_events" ON payroll_events FOR INSERT WITH CHECK (true);
CREATE POLICY "read_org_payroll_events" ON payroll_events FOR SELECT
  USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid())
    AND (SELECT role FROM profiles WHERE clerk_user_id = auth.uid()) IN ('hr','admin','branch_manager','team_lead'));
```

---

## STEP 2 — LO PAY RUN SUBMISSION

`app/(dashboard)/payroll/submit/page.tsx`

LO opens this page to create a pay run for a pay period.

**Flow:**
1. Select pay period (date range picker, defaults to previous month)
2. System auto-fetches all CLOSED loans in that period assigned to the LO
   - Pulls from `leads` table where `status = 'closed'` and `closed_date` in range
3. Shows table: Borrower Name | Loan Amount | Close Date | Comp Basis | Calculated Commission
4. LO can add notes per line, exclude any loan (with reason), or add a manually entered loan
5. Shows totals: Gross Commission | Adjustments | Net Commission
6. "Submit for Team Lead Review" button → creates `pay_run` + `pay_run_items` records

`app/api/payroll/submit/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { calculateComp } from '@/lib/payroll/comp-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createClient();
  const { data: profile } = await sb
    .from('profiles')
    .select('id, org_id, comp_plan_id')
    .eq('clerk_user_id', userId)
    .single();

  if (!profile?.comp_plan_id) {
    return NextResponse.json({ error: 'No compensation plan assigned. Contact your branch manager.' }, { status: 400 });
  }

  const { data: compPlan } = await sb.from('comp_plans').select('*').eq('id', profile.comp_plan_id).single();

  const body = await req.json() as {
    payPeriodStart: string;
    payPeriodEnd: string;
    items: Array<{ leadId: string; loanAmount: number; closeDate: string; notes?: string; }>;
  };

  // Calculate comp per item
  const items = body.items.map(item => {
    const calc = calculateComp(compPlan!, item.loanAmount);
    return {
      lead_id: item.leadId,
      loan_amount: item.loanAmount,
      close_date: item.closeDate,
      comp_type: compPlan!.comp_type,
      comp_basis: item.loanAmount,
      bps_applied: compPlan!.bps,
      flat_fee: compPlan!.base_amount,
      gross_comp: calc.gross,
      branch_split: calc.branchSplit,
      net_comp: calc.net,
      notes: item.notes,
      org_id: profile.org_id,
    };
  });

  const grossCommission = items.reduce((s, i) => s + i.gross_comp, 0);
  const netCommission = items.reduce((s, i) => s + i.net_comp, 0);

  // Find team lead for this LO
  const { data: teamLead } = await sb
    .from('profiles')
    .select('id')
    .eq('org_id', profile.org_id)
    .eq('role', 'team_lead')
    .maybeSingle();

  const { data: payRun } = await sb.from('pay_runs').insert({
    org_id: profile.org_id,
    lo_id: profile.id,
    pay_period_start: body.payPeriodStart,
    pay_period_end: body.payPeriodEnd,
    status: 'team_lead_review',
    total_loans: items.length,
    gross_commission: grossCommission,
    adjustments: 0,
    net_commission: netCommission,
    team_lead_id: teamLead?.id,
  }).select('id').single();

  // Insert line items
  await sb.from('pay_run_items').insert(items.map(i => ({ ...i, pay_run_id: payRun!.id })));

  // Log event
  await sb.from('payroll_events').insert({
    pay_run_id: payRun!.id, org_id: profile.org_id,
    event_type: 'submitted', actor_id: profile.id, actor_role: 'lo',
    metadata: { total_loans: items.length, gross_commission: grossCommission },
  });

  // Notify team lead
  if (teamLead) {
    await sb.from('notifications').insert({
      org_id: profile.org_id, user_id: teamLead.id, type: 'payroll_review',
      title: 'Pay run submitted for review',
      body: `A pay run has been submitted and requires your approval.`,
      action_url: `/dashboard/payroll/review/${payRun!.id}`,
      read: false,
    });
  }

  return NextResponse.json({ payRunId: payRun!.id }, { status: 201 });
}
```

`lib/payroll/comp-engine.ts`

```typescript
interface CompPlan {
  comp_type: string;
  base_amount: number | null;
  bps: number | null;
  percent_revenue: number | null;
  split_with_branch: number;
}

export function calculateComp(plan: CompPlan, loanAmount: number, revenue?: number) {
  let gross = 0;

  if (plan.comp_type === 'flat') {
    gross = plan.base_amount ?? 0;
  } else if (plan.comp_type === 'bps') {
    gross = (loanAmount * (plan.bps ?? 0)) / 10000;
  } else if (plan.comp_type === 'percent_revenue') {
    gross = (revenue ?? 0) * (plan.percent_revenue ?? 0);
  }

  const branchSplit = gross * (plan.split_with_branch ?? 0);
  const net = gross - branchSplit;

  return { gross: Number(gross.toFixed(2)), branchSplit: Number(branchSplit.toFixed(2)), net: Number(net.toFixed(2)) };
}
```

---

## STEP 3 — TEAM LEAD REVIEW

`app/(dashboard)/payroll/review/[id]/page.tsx`

Role-gated to `team_lead`, `branch_manager`, `admin`.

Shows:
- LO name, pay period, total loans, gross, net commission
- Line items table: Borrower | Loan Amount | Close Date | Commission
- Adjustments panel: add chargeback, advance recovery, bonus
- Actions: **Approve → HR** | **Escalate to HR** | **Flag** (with required note)

`app/api/payroll/[id]/team-lead/route.ts`

```typescript
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Verify actor is team_lead/branch_manager/admin
  // action: 'approved' | 'escalated' | 'flagged'
  // Update pay_runs: team_lead_action, team_lead_note, team_lead_acted_at
  // If approved: set status = 'approved', notify HR
  // If flagged: set status = 'flagged', notify LO
  // Log payroll_events
}
```

---

## STEP 4 — HR ISSUANCE + PAY STUB

`app/(dashboard)/payroll/hr/[id]/page.tsx`

Role-gated to `hr`, `admin` only.

Shows full pay run summary + all adjustments. HR can:
- Add final adjustments (e.g., garnishments, advance repayments — with notes)
- Recalculate net
- **Approve + Issue** → triggers pay stub generation
- **Void** with note

**Pay stub generation** (PDF via `pdf` skill or html-to-pdf):

`app/api/payroll/[id]/issue/route.ts`

```typescript
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Verify role = hr or admin
  // Fetch pay run + items + adjustments + LO profile + org
  // Generate PDF pay stub (see template below)
  // Upload to Supabase Storage: pay-stubs/[org_id]/[pay_run_id].pdf (private bucket)
  // Update pay_runs: status = 'issued', issued_at, pay_stub_url
  // Log payroll_events: 'issued'
  // Notify LO: "Your pay stub is ready"
}
```

**Pay stub template fields:**
```
[Company Logo]              PAY STUB
Pay Period: Jun 1 – Jun 30, 2026    Issued: Jul 5, 2026
LO: Ashley Leyva            NMLS: 1234567
---
LOANS CLOSED THIS PERIOD
File / Borrower         Loan Amount    Comp Basis    Commission
Smith Purchase          $420,000       100 BPS       $4,200.00
Jones Refi              $280,000       100 BPS       $2,800.00
---
Gross Commission:                                    $7,000.00
Branch Split (20%):                                 -$1,400.00
Advance Recovery:                                    -$500.00
---
NET COMMISSION:                                      $5,100.00
---
Approved by: [Team Lead Name] | Issued by: [HR Name]
```

---

## STEP 5 — PAY HISTORY DASHBOARD

`app/(dashboard)/payroll/page.tsx`

**LO view:**
- Table: Pay Period | Loans | Gross | Net | Status | [View Stub]
- Total YTD earnings card

**Branch Manager / HR view:**
- All LOs' pay runs in a table
- Filters: date range, LO, status
- Aggregate: total payroll cost this month, this quarter, YTD
- Export to CSV
- QuickBooks export (CSV formatted with DEBIT/CREDIT columns — no direct API integration needed)

---

## STEP 6 — COMP PLAN MANAGEMENT

`app/(dashboard)/settings/comp-plans/page.tsx`

HR/Admin only. Create, edit, assign comp plans.

Fields:
- Plan name
- Comp type: Flat Fee / BPS / % Revenue / Tiered
- Base amount or BPS rate
- Branch split percentage
- Assign to LO dropdown (multi-select)

Tiered example config:
```json
[
  {"min_volume": 0, "max_volume": 2000000, "bps": 75},
  {"min_volume": 2000001, "max_volume": 5000000, "bps": 100},
  {"min_volume": 5000001, "max_volume": null, "bps": 125}
]
```

---

## COMPLIANCE GUARDRAILS (BUILT INTO THE CODE)

Per CFPB LO Comp Rule (Reg Z 12 CFR 1026.36):

1. **Comp cannot vary based on loan terms.** The comp engine calculates based on LOAN AMOUNT only — not interest rate, type, or other terms. Any tiered plan tiers on VOLUME (total dollars closed), not loan characteristics.

2. **No dual comp.** A flag should appear in settings if any LO is configured to receive both borrower-paid and lender-paid comp on the same transaction. (UI warning only in Phase 1.)

3. **Audit trail immutable.** `payroll_events` table has INSERT-only RLS. No UPDATE, no DELETE, not even for `service_role`.

4. **Pay stubs are permanent.** Once issued, `pay_runs.status` can only move to `void` with a mandatory note — it cannot be deleted.

5. **Role enforcement.** LOs cannot approve their own pay runs. HR cannot submit pay runs. All role checks are enforced at the API layer, not just the UI.

---

## ENV VARS

```bash
# Supabase Storage bucket (private)
# Create bucket: pay-stubs (private, no public access)
```

---

## VERIFICATION CHECKLIST

- [ ] LO cannot see other LOs' pay runs
- [ ] LO submits pay run → team lead receives in-app notification
- [ ] Team lead approves → HR receives in-app notification
- [ ] HR can add adjustments (chargeback, bonus) before issuing
- [ ] Pay stub PDF generated correctly with all line items
- [ ] Pay stub stored in private Supabase Storage bucket
- [ ] LO notified when pay stub is issued
- [ ] Comp engine: 100 BPS on $420K = $4,200
- [ ] Comp engine: flat $1,500/file on 3 files = $4,500
- [ ] Comp engine: tiered — volume under $2M uses 75 BPS, over uses 100 BPS
- [ ] Branch split applied before net calculation
- [ ] Flagged pay run notifies LO (not HR)
- [ ] payroll_events has no UPDATE/DELETE RLS policies (audit immutability)
- [ ] HR/admin only can create or modify comp plans
- [ ] Role enforcement: LO cannot access /payroll/review or /payroll/hr routes
- [ ] CSV export includes all LOs for the selected period
