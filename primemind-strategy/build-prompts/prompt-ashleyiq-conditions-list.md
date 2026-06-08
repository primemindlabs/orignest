# AshleyIQ — Conditions / Needs List
## Claude Code Build Prompt · Sprint 4-C

---

## WHY THIS EXISTS

Every mortgage loan has a checklist of conditions: things needed before underwriting (PTU — Prior to Underwriting), before docs (PTD — Prior to Docs), and before funding (PTF — Prior to Funding). Today LOs manage this in spreadsheets, emails, or Encompass's clunky interface. Borrowers have no idea what they owe, so they either upload the wrong thing or nothing at all.

AshleyIQ needs a structured conditions/needs list that:
- Organizes all conditions by phase (PTU / PTD / PTF)
- Is visible to all parties: LO, processor, borrower, and co-borrower
- Sends smart reminders when items are outstanding
- Lets LOs mark items complete when documents arrive
- Links directly to the borrower portal for uploads

This is the feature that makes borrowers feel managed and LOs feel in control.

---

## PHASES DEFINED

| Phase | Meaning | When |
|---|---|---|
| **PTU** | Prior to Underwriting | Items needed before UW can review the file |
| **PTD** | Prior to Docs | Items needed before docs can be drawn |
| **PTF** | Prior to Funding | Items needed before the lender wires funds |
| **PTClose** | Prior to Closing | Same as PTF for purchase transactions |
| **Suspended** | UW suspended | Additional items needed to lift suspension |
| **General** | No phase | Pre-qual, informal requests |

---

## EXECUTION ORDER

1. DB migration
2. Conditions API (CRUD)
3. Conditions UI — LO dashboard
4. Borrower portal integration (view + upload)
5. Reminder automation
6. Standard condition library

---

## STEP 1 — DATABASE MIGRATION

`supabase/migrations/006_conditions.sql`

```sql
-- Standard condition templates (shared library)
CREATE TABLE IF NOT EXISTS condition_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES organizations(id),  -- NULL = system default
  name          TEXT NOT NULL,
  description   TEXT,
  phase         TEXT NOT NULL CHECK (phase IN ('ptu','ptd','ptf','ptclose','suspended','general')),
  category      TEXT NOT NULL CHECK (category IN (
    'income','assets','credit','property','title','insurance',
    'legal','identity','other'
  )),
  required_for  TEXT[] DEFAULT ARRAY['borrower'],  -- borrower, co_borrower, property, lender
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Per-loan conditions list
CREATE TABLE IF NOT EXISTS loan_conditions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL,
  template_id     UUID REFERENCES condition_templates(id),
  name            TEXT NOT NULL,
  description     TEXT,
  phase           TEXT NOT NULL CHECK (phase IN ('ptu','ptd','ptf','ptclose','suspended','general')),
  category        TEXT NOT NULL,
  required_from   TEXT NOT NULL DEFAULT 'borrower'
    CHECK (required_from IN ('borrower','co_borrower','lender','title','insurance','employer','other')),
  status          TEXT NOT NULL DEFAULT 'outstanding'
    CHECK (status IN ('outstanding','received','reviewing','satisfied','waived','n/a')),
  assigned_to_borrower BOOLEAN NOT NULL DEFAULT true,
  due_date        DATE,
  satisfied_at    TIMESTAMPTZ,
  satisfied_by    UUID REFERENCES profiles(id),
  satisfaction_note TEXT,
  document_request_id UUID REFERENCES document_requests(id),
  sort_order      INT DEFAULT 0,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Condition activity log (append-only)
CREATE TABLE IF NOT EXISTS condition_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_id  UUID NOT NULL REFERENCES loan_conditions(id),
  lead_id       UUID NOT NULL,
  org_id        UUID NOT NULL,
  event_type    TEXT NOT NULL,
  -- created / status_changed / document_uploaded / reminder_sent / note_added / waived / satisfied
  old_status    TEXT,
  new_status    TEXT,
  actor_id      UUID REFERENCES profiles(id),  -- NULL = system/borrower
  actor_type    TEXT CHECK (actor_type IN ('lo','processor','borrower','system')),
  note          TEXT,
  occurred_at   TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE condition_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE condition_events ENABLE ROW LEVEL SECURITY;

-- Templates: readable by all org members; org-specific templates scoped to org
CREATE POLICY "read_condition_templates" ON condition_templates
  FOR SELECT USING (org_id IS NULL OR org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));

CREATE POLICY "manage_org_templates" ON condition_templates
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));

-- Loan conditions
CREATE POLICY "org_loan_conditions" ON loan_conditions
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));

-- Events: append-only
CREATE POLICY "insert_condition_events" ON condition_events FOR INSERT WITH CHECK (true);
CREATE POLICY "read_org_condition_events" ON condition_events
  FOR SELECT USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_conditions_lead ON loan_conditions(lead_id);
CREATE INDEX IF NOT EXISTS idx_conditions_status ON loan_conditions(lead_id, status);
```

---

## STEP 2 — SEED STANDARD CONDITION TEMPLATES

`supabase/seed/conditions.sql`

Insert a standard library of 40+ common mortgage conditions (org_id = NULL = system defaults):

```sql
INSERT INTO condition_templates (name, description, phase, category, required_for) VALUES
-- PTU — Income
('2 Years W-2s', 'Provide W-2 forms for the most recent two tax years', 'ptu', 'income', ARRAY['borrower']),
('30-Day Pay Stubs', 'Most recent 30 days of pay stubs', 'ptu', 'income', ARRAY['borrower']),
('2 Years Federal Tax Returns', 'Signed federal tax returns for prior 2 years', 'ptu', 'income', ARRAY['borrower']),
('Year-to-Date P&L', 'Current year Profit & Loss statement (self-employed)', 'ptu', 'income', ARRAY['borrower']),
('Business Tax Returns 2 Years', 'Business federal tax returns for prior 2 years (self-employed)', 'ptu', 'income', ARRAY['borrower']),
('Verification of Employment', 'Written VOE from employer confirming employment dates and income', 'ptu', 'income', ARRAY['borrower']),
('Social Security/Pension Award Letter', 'Current award letter showing monthly benefit amount', 'ptu', 'income', ARRAY['borrower']),
-- PTU — Assets
('2 Months Bank Statements', 'Most recent 2 months of all bank account statements', 'ptu', 'assets', ARRAY['borrower']),
('401k/Investment Statements', 'Most recent statement for retirement/investment accounts', 'ptu', 'assets', ARRAY['borrower']),
('Gift Letter', 'Signed gift letter from donor with donor bank statement', 'ptu', 'assets', ARRAY['borrower']),
('Earnest Money Deposit Proof', 'Bank statement or canceled check showing EMD payment', 'ptu', 'assets', ARRAY['borrower']),
-- PTU — Credit/Identity
('Government-Issued Photo ID', 'Driver license or passport — must not be expired', 'ptu', 'identity', ARRAY['borrower']),
('Social Security Card', 'Copy of Social Security card', 'ptu', 'identity', ARRAY['borrower']),
('Letter of Explanation', 'Written explanation for any credit inquiries, late payments, or derogatory marks', 'ptu', 'credit', ARRAY['borrower']),
('Bankruptcy Discharge Papers', 'Full bankruptcy discharge documentation', 'ptu', 'credit', ARRAY['borrower']),
-- PTU — Property
('Purchase Contract (Fully Executed)', 'Signed purchase and sale agreement with all addenda', 'ptu', 'property', ARRAY['borrower']),
('HOA Contact Information', 'Name, address, phone of HOA (if applicable)', 'ptu', 'property', ARRAY['borrower']),
-- PTD — Insurance
('Homeowners Insurance Binder', 'Insurance declarations page with lender listed as mortgagee', 'ptd', 'insurance', ARRAY['borrower']),
('Flood Insurance Certificate', 'NFIP or private flood insurance certificate (if in flood zone)', 'ptd', 'insurance', ARRAY['borrower']),
-- PTD — Title
('Title Commitment', 'Preliminary title commitment from title company', 'ptd', 'title', ARRAY['lender']),
('Payoff Statement', 'Payoff quote for existing mortgage(s) being paid off', 'ptd', 'title', ARRAY['lender']),
-- PTF — Legal
('Clear-to-Close Approval', 'Underwriter CTC with all prior conditions satisfied', 'ptf', 'legal', ARRAY['lender']),
('Final Inspection', 'Final property inspection (new construction)', 'ptf', 'property', ARRAY['lender']),
('Hazard Insurance Paid Receipt', 'Receipt showing first year premium paid', 'ptf', 'insurance', ARRAY['borrower']);
```

---

## STEP 3 — CONDITIONS API

`app/api/leads/[id]/conditions/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET — fetch all conditions for a lead
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createClient();
  const { data } = await sb
    .from('loan_conditions')
    .select('*')
    .eq('lead_id', params.id)
    .order('phase')
    .order('sort_order');

  return NextResponse.json({ conditions: data ?? [] });
}

// POST — add condition to a lead
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createClient();
  const { data: profile } = await sb.from('profiles').select('id, org_id').eq('clerk_user_id', userId).single();
  const body = await req.json() as {
    name: string; description?: string; phase: string; category: string;
    required_from?: string; due_date?: string; assigned_to_borrower?: boolean;
  };

  const { data: condition } = await sb.from('loan_conditions').insert({
    ...body,
    lead_id: params.id,
    org_id: profile!.org_id,
    created_by: profile!.id,
    status: 'outstanding',
  }).select().single();

  await sb.from('condition_events').insert({
    condition_id: condition!.id, lead_id: params.id, org_id: profile!.org_id,
    event_type: 'created', new_status: 'outstanding', actor_id: profile!.id, actor_type: 'lo',
  });

  return NextResponse.json({ condition }, { status: 201 });
}
```

`app/api/leads/[id]/conditions/[conditionId]/route.ts`

```typescript
// PATCH — update status (satisfy, waive, mark reviewing)
export async function PATCH(req: NextRequest, { params }: { params: { id: string; conditionId: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createClient();
  const { data: profile } = await sb.from('profiles').select('id, org_id').eq('clerk_user_id', userId).single();
  const { status, satisfaction_note } = await req.json() as { status: string; satisfaction_note?: string };

  const { data: existing } = await sb.from('loan_conditions').select('status').eq('id', params.conditionId).single();

  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'satisfied') {
    updates.satisfied_at = new Date().toISOString();
    updates.satisfied_by = profile!.id;
    if (satisfaction_note) updates.satisfaction_note = satisfaction_note;
  }

  const { data: condition } = await sb.from('loan_conditions').update(updates)
    .eq('id', params.conditionId).select().single();

  await sb.from('condition_events').insert({
    condition_id: params.conditionId, lead_id: params.id, org_id: profile!.org_id,
    event_type: 'status_changed', old_status: existing!.status, new_status: status,
    actor_id: profile!.id, actor_type: 'lo', note: satisfaction_note,
  });

  return NextResponse.json({ condition });
}
```

---

## STEP 4 — CONDITIONS UI (LO DASHBOARD)

`app/(dashboard)/leads/[id]/conditions/page.tsx`

Layout: three column groups (PTU | PTD | PTF) on desktop, stacked tabs on mobile.

**Per condition card:**
```
[●] 2 Years W-2s                         [Income]
    Due: borrower by Jun 15               [Mark Received ▼]
    Requested from: Borrower
    Status: Outstanding
    [+ Attach Document] [Send Reminder]
```

**Status actions available to LO:**
- Mark Received → sets status `received`
- Mark Satisfied → opens modal: satisfaction note, optional document link → sets `satisfied`
- Waive → requires note → sets `waived`
- Mark N/A → sets `n/a`
- Request Document → links to document_requests table, creates portal item for borrower

**Top of page summary bar:**
```
PTU: 3 outstanding, 5 satisfied
PTD: 1 outstanding, 2 satisfied
PTF: 0 outstanding, 1 satisfied (locked until PTU/PTD complete)
```

**Add Condition:**
- Dropdown to select from condition_templates (system + org)
- Or manual entry (name, description, phase, category, required_from)
- Bulk add from template set: "Add standard PTU income package"

---

## STEP 5 — BORROWER PORTAL INTEGRATION

Add a "What We Need" tab to the existing borrower portal (`app/(borrower)/status/[token]/`):

`BorrowerConditionsTab.tsx`

```typescript
// Fetch conditions via:
// GET /api/borrower-portal/[token]/conditions
// Returns only conditions where assigned_to_borrower = true

// Display per-condition card:
// [  ] 2 Years W-2s
//     Please upload W-2 forms for the past 2 years
//     Status: Waiting for your documents
//     [Upload Document]   [Due: Jun 15]

// Completed conditions show checkmark and "Received — thank you"

// Progress bar at top: "You've completed 3 of 7 items needed"
```

`app/api/borrower-portal/[token]/conditions/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const { data: tokenRecord } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id')
    .eq('token', params.token)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!tokenRecord) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const { data } = await sb
    .from('loan_conditions')
    .select('id, name, description, phase, status, due_date, assigned_to_borrower')
    .eq('lead_id', tokenRecord.lead_id)
    .eq('assigned_to_borrower', true)
    .not('status', 'in', '(waived,n/a)')
    .order('phase')
    .order('sort_order');

  return NextResponse.json({ conditions: data ?? [] });
}
```

When borrower uploads a document via the portal, trigger status update: condition marked `received` automatically if the document category matches.

---

## STEP 6 — REMINDER AUTOMATION

`supabase/functions/condition-reminders/index.ts`

Runs nightly at 8 AM ET. Sends reminders for outstanding conditions with due dates in the next 3 days.

```typescript
// For each outstanding condition with due_date <= NOW() + 3 days:
// 1. Send borrower an email via Resend: "You have items needed to complete your loan"
//    Include: list of outstanding items + portal link
// 2. Notify LO in-app: "[Borrower name] still has 3 outstanding conditions"
// 3. Log to condition_events: event_type = 'reminder_sent'
// 4. Rate limit: max 1 email per borrower per 48 hours
```

```sql
-- Register cron
SELECT cron.schedule('condition-reminders', '0 13 * * *',
  $$SELECT net.http_post(url := ... || '/functions/v1/condition-reminders')$$);
```

---

## STEP 7 — BULK APPLY FROM TEMPLATES

`app/api/leads/[id]/conditions/bulk/route.ts`

```typescript
// POST body: { phase: 'ptu', categories: ['income', 'assets', 'identity'] }
// Fetches matching condition_templates (org or system)
// Bulk inserts as loan_conditions for the lead
// Returns count of conditions added
```

**Quick-add buttons in UI:**
- "Add standard PTU package" → income + assets + identity
- "Add standard PTD package" → insurance + title
- "Add standard PTF package" → legal + final items

---

## VERIFICATION CHECKLIST

- [ ] Conditions organized by phase (PTU/PTD/PTF) in UI
- [ ] LO can add conditions from template library or manually
- [ ] "Add standard package" bulk adds 10+ conditions in one click
- [ ] Status can be changed: outstanding → received → satisfied
- [ ] Satisfied conditions show checkmark with timestamp and LO name
- [ ] Borrower portal "What We Need" tab shows only borrower-assigned, outstanding conditions
- [ ] Borrower portal progress bar updates as LO marks items satisfied
- [ ] Upload in borrower portal creates document_request + marks condition received
- [ ] Reminder email fires for items due in next 3 days
- [ ] LO gets in-app notification when borrower uploads a document
- [ ] Condition events log all status changes (append-only)
- [ ] Waived conditions require a note before saving
- [ ] PTF column is visually locked/grayed until PTU + PTD are 100% satisfied
