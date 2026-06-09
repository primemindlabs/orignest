# Ashley IQ — Underwriting Suite & CD Balancer Build Prompt
# Claude Code Session Instruction

---

## HOW TO LAUNCH THIS SESSION

Run from `products/conduit-next/`:

```bash
claude --dangerously-skip-permissions
```

**Prerequisites:**
- Supabase MCP configured with project ref `dhnxiijduycmzfjmohyp`
- Main v2 build prompt (`prompt-ashleyiq-v2-complete-build.md`) must have been run first
- `.env.local` with all required keys

> Run `ls` to confirm structure, then execute phases in order. Do not skip. Do not mock data.

---

## ENGINEERING PRINCIPLES (NON-NEGOTIABLE)

- **Read before you write.** Before touching any file, read it in full.
- **Additive only.** Never delete or replace existing functionality.
- **DRY.** Search before writing any new utility, hook, or component.
- **KISS.** Simplest solution wins. No unnecessary abstractions.
- **TypeScript strict mode.** No `as any`. Run `tsc --noEmit` after every phase.

---

## ⚠️ DESIGN FREEZE

Files that must never be modified: `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx`

**Color palette (exact values only):**
```
Page background:  #F5F5F7 → var(--c-bg)
Cards:            #FFFFFF → var(--c-surface)
Secondary panels: #FBFBFD → var(--c-surface2)
Primary text:     #0F1D2E → var(--c-text)
Secondary text:   #6B7B8D → var(--c-label2)
Gold accent:      #C9A95C → var(--c-gold)
Gold fill:        rgba(201,169,92,0.12) → var(--c-gold-light)
Borders:          rgba(15,29,46,0.10) → var(--c-border)
Success:          #2D7A4F | Warning: #B07D28 | Danger: #C4724A | Info: #3A5C7A
```

**Fonts:** Lora Bold (headings) · Instrument Sans (UI) · DM Mono (numbers/data)

**Violations = build failure:** Apple blue anywhere · Tailwind gray backgrounds · hardcoded hex in style props · new CSS files · new UI libraries · `#F5EFE0` anywhere

---

## IMMOVABLE SECURITY RULES

1. **SSN and DOB never written to the database.** Grep before every commit.
2. **All audit tables INSERT-only.** `uw_decisions`, `adverse_actions`, `fair_lending_flags`, `post_close_audits`: RLS denies UPDATE and DELETE for ALL roles including `service_role`.
3. **No mock data in production paths.**
4. **TCPA compliance.** No SMS without verified `opt_in`.
5. **Admin client (`createAdminClient()`) only for public/portal routes.** Authenticated LO routes use `createClient()`.
6. **Wire instruction data.** Never store full account numbers — last 4 digits only.

---

## PHASE 24 — FULL UNDERWRITING SUITE

Ashley IQ's underwriting suite is the LO's AI-native replacement for the clunky UW screens in legacy LOS systems. It covers every phase of underwriting — income, credit, assets, property, risk layering, conditions, and decisions — with AI doing the heavy analysis work. The goal: an LO should be able to prepare a bulletproof underwriting package without opening Encompass.

---

### 24.1 — Schema

```sql
-- Master UW file per loan
CREATE TABLE uw_files (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id             uuid NOT NULL REFERENCES tenants(id),
  assigned_underwriter  text,                -- name/email of external UW (not a system user)
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','submitted','in_review','suspended','approved_with_conditions',
    'approved','denied','withdrawn','clear_to_close'
  )),
  risk_score            integer CHECK (risk_score BETWEEN 0 AND 100),
  risk_summary          text,                -- AI-generated plain-English risk narrative
  risk_factors          jsonb DEFAULT '[]',  -- [{ factor, severity, description }]
  uw_memo_url           text,                -- PDF of AI-generated UW memo in Supabase Storage
  predicted_outcome     text CHECK (predicted_outcome IN ('approve','suspend','counter','deny')),
  predicted_confidence  numeric(5,2),        -- 0-100%
  submitted_at          timestamptz,
  decision_at           timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- UW decision history — INSERT-only
CREATE TABLE uw_decisions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uw_file_id    uuid NOT NULL REFERENCES uw_files(id),
  lead_id       uuid NOT NULL REFERENCES leads(id),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  decision_type text NOT NULL CHECK (decision_type IN (
    'submitted','suspended','counter_offer','approved_with_conditions',
    'approved','denied','withdrawn','ctc'
  )),
  decision_by   uuid REFERENCES users(id),
  notes         text,
  counter_terms jsonb,   -- if counter_offer: { loan_amount, ltv, reserves_required, etc. }
  created_at    timestamptz DEFAULT now()
);

-- DTI Worksheet
CREATE TABLE dti_worksheets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  -- Monthly income components
  base_salary         numeric(12,2) NOT NULL DEFAULT 0,
  overtime_income     numeric(12,2) NOT NULL DEFAULT 0,
  bonus_income        numeric(12,2) NOT NULL DEFAULT 0,
  commission_income   numeric(12,2) NOT NULL DEFAULT 0,
  se_income           numeric(12,2) NOT NULL DEFAULT 0,
  rental_income       numeric(12,2) NOT NULL DEFAULT 0,
  social_security     numeric(12,2) NOT NULL DEFAULT 0,
  pension             numeric(12,2) NOT NULL DEFAULT 0,
  other_income        numeric(12,2) NOT NULL DEFAULT 0,
  total_gross_monthly numeric(12,2) GENERATED ALWAYS AS (
    base_salary + overtime_income + bonus_income + commission_income +
    se_income + rental_income + social_security + pension + other_income
  ) STORED,
  -- Proposed housing payment
  proposed_pi         numeric(10,2) NOT NULL DEFAULT 0,
  proposed_taxes      numeric(10,2) NOT NULL DEFAULT 0,
  proposed_insurance  numeric(10,2) NOT NULL DEFAULT 0,
  proposed_hoa        numeric(10,2) NOT NULL DEFAULT 0,
  proposed_mi         numeric(10,2) NOT NULL DEFAULT 0,
  proposed_other      numeric(10,2) NOT NULL DEFAULT 0,
  total_housing       numeric(10,2) GENERATED ALWAYS AS (
    proposed_pi + proposed_taxes + proposed_insurance +
    proposed_hoa + proposed_mi + proposed_other
  ) STORED,
  -- Monthly debts
  auto_payment        numeric(10,2) NOT NULL DEFAULT 0,
  student_loan        numeric(10,2) NOT NULL DEFAULT 0,
  cc_minimum          numeric(10,2) NOT NULL DEFAULT 0,
  personal_loan       numeric(10,2) NOT NULL DEFAULT 0,
  child_support       numeric(10,2) NOT NULL DEFAULT 0,
  alimony             numeric(10,2) NOT NULL DEFAULT 0,
  other_debt          numeric(10,2) NOT NULL DEFAULT 0,
  total_debt          numeric(10,2) GENERATED ALWAYS AS (
    auto_payment + student_loan + cc_minimum + personal_loan +
    child_support + alimony + other_debt
  ) STORED,
  -- Calculated (set by API, not GENERATED — requires total_gross_monthly > 0 guard)
  front_end_dti       numeric(5,2),
  back_end_dti        numeric(5,2),
  qm_compliant        boolean,
  atr_compliant       boolean,
  qm_notes            text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Self-Employment Income Worksheets (1084/1088/bank statement/asset depletion/1099/K-1)
CREATE TABLE se_income_worksheets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  worksheet_type  text NOT NULL CHECK (worksheet_type IN (
    '1084_fannie','1088_freddie',
    'bank_statement_12','bank_statement_24',
    'asset_depletion','1099','k1','corporate_return'
  )),
  year_1          integer NOT NULL,
  year_2          integer,
  -- Shared income fields
  gross_income_y1           numeric(12,2) DEFAULT 0,
  gross_income_y2           numeric(12,2) DEFAULT 0,
  depreciation_y1           numeric(12,2) DEFAULT 0,
  depreciation_y2           numeric(12,2) DEFAULT 0,
  depletion_y1              numeric(12,2) DEFAULT 0,
  depletion_y2              numeric(12,2) DEFAULT 0,
  mileage_y1                numeric(12,2) DEFAULT 0,
  mileage_y2                numeric(12,2) DEFAULT 0,
  nonrecurring_loss_y1      numeric(12,2) DEFAULT 0,
  nonrecurring_loss_y2      numeric(12,2) DEFAULT 0,
  business_use_home_y1      numeric(12,2) DEFAULT 0,
  business_use_home_y2      numeric(12,2) DEFAULT 0,
  -- Bank statement specific
  total_deposits_period     numeric(12,2) DEFAULT 0,
  business_expense_factor   numeric(5,2) DEFAULT 50.00,
  -- Asset depletion specific
  total_eligible_assets     numeric(12,2) DEFAULT 0,
  depletion_months          integer DEFAULT 360,
  -- Output
  qualifying_monthly_income numeric(12,2),
  ai_analysis               text,   -- Claude Sonnet analysis of SE income picture
  calculation_notes         text,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

-- Asset & Reserve Worksheet
CREATE TABLE asset_worksheets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE asset_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_worksheet_id    uuid NOT NULL REFERENCES asset_worksheets(id) ON DELETE CASCADE,
  account_type          text NOT NULL CHECK (account_type IN (
    'checking','savings','money_market','cd','retirement_401k',
    'retirement_ira','stocks','bonds','gift','business','other'
  )),
  institution           text NOT NULL,
  balance               numeric(12,2) NOT NULL,
  is_gift               boolean DEFAULT false,
  gift_donor            text,
  gift_seasoned         boolean DEFAULT false,   -- 60+ days in account
  retirement_vested_pct numeric(5,2) DEFAULT 100,
  eligible_amount       numeric(12,2),           -- computed: 60% retirement, 100% liquid
  notes                 text,
  created_at            timestamptz DEFAULT now()
);

-- Credit Analysis
CREATE TABLE credit_analyses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  pull_date        date NOT NULL,
  experian_score   integer,
  equifax_score    integer,
  transunion_score integer,
  qualifying_score integer,   -- middle score of the three
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE credit_tradelines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_analysis_id  uuid NOT NULL REFERENCES credit_analyses(id) ON DELETE CASCADE,
  creditor_name       text NOT NULL,
  account_type        text NOT NULL,
  balance             numeric(10,2) DEFAULT 0,
  payment             numeric(10,2) DEFAULT 0,
  limit_amount        numeric(10,2),
  open_date           date,
  status              text NOT NULL CHECK (status IN (
    'open','closed','derogatory','collection','charge_off','bankruptcy','judgement'
  )),
  late_30             integer DEFAULT 0,
  late_60             integer DEFAULT 0,
  late_90             integer DEFAULT 0,
  months_remaining    integer,
  omit_from_dti       boolean DEFAULT false,
  omit_reason         text,
  loe_required        boolean DEFAULT false,
  loe_drafted         text,   -- AI-drafted letter of explanation
  created_at          timestamptz DEFAULT now()
);

-- HOA Certification Tracker
CREATE TABLE hoa_certifications (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                 uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id               uuid NOT NULL REFERENCES tenants(id),
  hoa_name                text NOT NULL,
  management_company      text,
  owner_occupancy_pct     numeric(5,2),   -- FHA/Conv require >= 51%
  delinquency_pct         numeric(5,2),   -- must be <= 15%
  pending_litigation      boolean DEFAULT false,
  litigation_description  text,
  adequate_insurance      boolean,
  fha_approved            boolean,
  warrantable             boolean,        -- Fannie/Freddie warrantable condo
  review_status           text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','pass','fail','exception_approved')),
  review_notes            text,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- Underwriter direct message channel
CREATE TABLE uw_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES leads(id),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  sender_type   text NOT NULL CHECK (sender_type IN ('lo','processor','underwriter','system')),
  sender_id     uuid REFERENCES users(id),
  message       text NOT NULL,
  read_by_uw    boolean DEFAULT false,
  read_by_lo    boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

-- Adverse Action Notices (ECOA / Reg B)
CREATE TABLE adverse_actions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               uuid NOT NULL REFERENCES leads(id),
  tenant_id             uuid NOT NULL REFERENCES tenants(id),
  action_type           text NOT NULL CHECK (action_type IN (
    'denial','counteroffer_not_accepted','incomplete_application','withdrawn'
  )),
  reason_codes          text[] NOT NULL,    -- FCRA/ECOA reason codes (e.g. 'DTI_TOO_HIGH')
  reason_descriptions   text[] NOT NULL,    -- plain English
  hmda_captured         boolean DEFAULT false,
  notice_sent_at        timestamptz,
  notice_due_by         timestamptz,        -- 30 days from action date (ECOA requirement)
  notice_pdf_url        text,
  ai_drafted_notice     text,
  created_at            timestamptz DEFAULT now()
);

-- Fair Lending Monitoring
CREATE TABLE fair_lending_flags (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  flag_type       text NOT NULL CHECK (flag_type IN (
    'pricing_disparity','denial_pattern','processing_time_disparity',
    'fee_disparity','dual_role_conflict','redlining_risk'
  )),
  hmda_field      text,
  description     text NOT NULL,
  severity        text NOT NULL CHECK (severity IN ('info','warning','critical')),
  reviewed        boolean DEFAULT false,
  reviewed_by     uuid REFERENCES users(id),
  review_notes    text,
  created_at      timestamptz DEFAULT now()
);

-- LO/Realtor dual role detection log
CREATE TABLE dual_role_checks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  loan_program    text NOT NULL,
  lo_name         text NOT NULL,
  lo_nmls         text NOT NULL,
  lo_re_license   text,         -- RE license number if found in CredifyID
  agent_name_on_contract text,
  match_type      text CHECK (match_type IN ('exact','fuzzy','license','closa_match','no_match')),
  match_confidence numeric(5,2),
  violation       boolean NOT NULL DEFAULT false,
  violation_rule  text,         -- e.g. 'HUD_4000.1_II.A.1.b' | 'VA_Lender_Handbook_Ch9' | 'RESPA_Section_8'
  blocked         boolean DEFAULT false,  -- true = submission blocked; false = warning only
  resolved        boolean DEFAULT false,
  resolved_by     uuid REFERENCES users(id),
  resolution_notes text,
  created_at      timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX ON uw_files(lead_id);
CREATE INDEX ON uw_files(tenant_id, status);
CREATE INDEX ON uw_decisions(lead_id);
CREATE INDEX ON dti_worksheets(lead_id);
CREATE INDEX ON se_income_worksheets(lead_id);
CREATE INDEX ON asset_worksheets(lead_id);
CREATE INDEX ON asset_accounts(asset_worksheet_id);
CREATE INDEX ON credit_analyses(lead_id);
CREATE INDEX ON credit_tradelines(credit_analysis_id);
CREATE INDEX ON hoa_certifications(lead_id);
CREATE INDEX ON uw_messages(lead_id);
CREATE INDEX ON adverse_actions(lead_id);
CREATE INDEX ON adverse_actions(tenant_id, notice_due_by) WHERE notice_sent_at IS NULL;
CREATE INDEX ON fair_lending_flags(tenant_id, severity) WHERE reviewed = false;
CREATE INDEX ON dual_role_checks(lead_id);

-- RLS
ALTER TABLE uw_files           ENABLE ROW LEVEL SECURITY;
ALTER TABLE uw_decisions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE dti_worksheets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE se_income_worksheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_worksheets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_analyses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_tradelines  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hoa_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE uw_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE adverse_actions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fair_lending_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE dual_role_checks   ENABLE ROW LEVEL SECURITY;

-- Standard tenant-scoped read/write
CREATE POLICY "uw_files_tenant"           ON uw_files           USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "dti_worksheets_tenant"     ON dti_worksheets     USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "se_worksheets_tenant"      ON se_income_worksheets USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "asset_worksheets_tenant"   ON asset_worksheets   USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "credit_analyses_tenant"    ON credit_analyses    USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "hoa_certs_tenant"          ON hoa_certifications USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "uw_messages_tenant"        ON uw_messages        USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "dual_role_checks_tenant"   ON dual_role_checks   USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- uw_decisions: INSERT-only
CREATE POLICY "uw_decisions_insert"    ON uw_decisions    FOR INSERT WITH CHECK (true);
CREATE POLICY "uw_decisions_no_update" ON uw_decisions    FOR UPDATE USING (false);
CREATE POLICY "uw_decisions_no_delete" ON uw_decisions    FOR DELETE USING (false);

-- adverse_actions: INSERT-only
CREATE POLICY "adverse_actions_insert"    ON adverse_actions FOR INSERT WITH CHECK (true);
CREATE POLICY "adverse_actions_no_update" ON adverse_actions FOR UPDATE USING (false);
CREATE POLICY "adverse_actions_no_delete" ON adverse_actions FOR DELETE USING (false);

-- fair_lending_flags: INSERT-only (reviewed flag updated via separate API)
CREATE POLICY "fair_lending_insert"    ON fair_lending_flags FOR INSERT WITH CHECK (true);
CREATE POLICY "fair_lending_no_delete" ON fair_lending_flags FOR DELETE USING (false);
```

---

### 24.2 — DTI Worksheet UI

**Location:** New `"Underwriting"` top-level section in the lead record, with sub-tabs: DTI · Income · Assets · Credit · HOA · Risk · Conditions · Decisions · Messages

**DTI tab layout:**

Two columns side by side — Income (left) and Housing + Debts (right).

Income section: each income type is an editable row with a DM Mono input. A `"Source"` dropdown beside each item (W2 / VOE / 1099 / Tax Return / SS Award Letter / etc.). Subtotals update live.

Housing section: pre-filled from lead record (P&I from rate, taxes/insurance from 1003). All fields editable.

Debt section: auto-populated from credit tradelines (Phase 24.6). LO can toggle each debt's `omit_from_dti` flag with a reason. Debts with ≤ 10 months remaining are auto-flagged for omission with a note.

**Live calculations (update on every keystroke):**
```typescript
// lib/underwriting/dtiCalculator.ts
export function calculateDTI(worksheet: DTIWorksheet) {
  const totalIncome = /* sum all income fields */;
  const totalHousing = /* sum housing payment fields */;
  const totalDebt = /* sum active (non-omitted) debt fields */;

  const frontEnd = totalIncome > 0 ? (totalHousing / totalIncome) * 100 : 0;
  const backEnd  = totalIncome > 0 ? ((totalHousing + totalDebt) / totalIncome) * 100 : 0;

  // QM thresholds (12 CFR § 1026.43)
  const qmCompliant = backEnd <= 43.0;
  // ATR check — must demonstrate ability to repay
  const atrCompliant = totalIncome > 0 && backEnd <= 50.0;

  return { frontEnd, backEnd, qmCompliant, atrCompliant };
}
```

**DTI color coding:**
- Front-end ≤ 28%: green · 29–31%: amber · > 31%: red (FHA threshold)
- Back-end ≤ 43%: green · 44–50%: amber · > 50%: red

**QM/ATR badges:** Two pill badges below the DTI numbers: `"QM ✓"` (green) or `"QM ✗"` (red), and `"ATR ✓"` or `"ATR ✗"`. Clicking either badge opens a tooltip explaining the threshold and the regulatory citation.

---

### 24.3 — Self-Employment Income Suite

**SE Income tab** (within the Income sub-section).

**Worksheet type selector:** Dropdown — 1084 (Fannie) / 1088 (Freddie) / Bank Statement 12mo / Bank Statement 24mo / Asset Depletion / 1099 / Schedule K-1 / Corporate Return

**1084 / 1088 Worksheet:**

All standard lines from the Fannie Mae Form 1084 / Freddie Mac Form 91, rendered as labeled inputs organized into sections matching the actual form. Key sections:
- Schedule C (Sole Proprietorship): gross income, expenses, add-backs (depreciation, depletion, mileage, business-use-of-home)
- Schedule D (Capital Gains): only include if recurring
- Schedule E (Rental/Partnership/S-Corp): net income + depreciation add-back
- Schedule F (Farm): gross income, expenses, add-backs
- Partnership / S-Corp: ordinary income + add-backs, ownership % applied

**Qualifying income calculation (auto-updates on each field change):**
```
Year 1 qualifying income + Year 2 qualifying income
÷ 24 months
= Monthly qualifying SE income
```

If only one year of returns available: Year 1 ÷ 12 with a compliance note that lender may require 2 years.

**Bank Statement Worksheets:**
- 12-month or 24-month deposit totals (manual entry or upload-and-parse)
- Business expense factor: default 50% (configurable per tenant per loan program)
- Personal bank statements: 100% of deposits after confirmed business expenses removed
- Output: `total_deposits × (1 - expense_factor) ÷ months = qualifying monthly income`

**Asset Depletion:**
```
Total eligible assets (checking + savings + 70% of investment accounts)
÷ Depletion months (360 for 30yr, 180 for 15yr)
= Monthly qualifying income
```

**AI Analysis (Claude Sonnet):**

After any SE worksheet is saved, call Claude Sonnet:
```
You are a senior mortgage underwriter reviewing self-employment income documentation.

Worksheet type: [TYPE]
Year 1 qualifying income: $[Y1]
Year 2 qualifying income: $[Y2]
Income trend: [INCREASING / DECREASING / STABLE] by [%]
Monthly qualifying income: $[MONTHLY]

Analyze:
1. Is the income trend favorable for approval? (2+ year increase = favorable)
2. Are there any red flags (large year-over-year decline, unusual add-backs)?
3. What documentation will underwriting likely require?
4. Recommended qualifying income to use and why.

Write 3-4 sentences. Plain language for a loan officer, not a borrower.
```

Display the AI analysis in a gold-tinted callout below the worksheet.

**Non-QM Income Types:**

When loan program is non-QM (bank statement, asset depletion, DSCR, 1099), show a `"Non-QM Program"` banner and unlock the appropriate worksheet type. Standard QM income rules do not apply — show program-specific qualification thresholds instead.

---

### 24.4 — Non-QM Underwriting Engine

**Triggered when `lead.loan_program IN ('bank_statement','asset_depletion','dscr','non_qm','1099')`**

A separate underwriting mode with its own qualification logic:

**Bank Statement Program:**
- 12 or 24 months personal or business bank statements
- Business expense factor: 50% default (configurable)
- Minimum qualifying income: program-specific (no DTI cap as strict as QM)
- Show DTI as informational only

**Asset Depletion Program:**
- Total liquid + investment assets (with haircuts: 70% stocks, 60% retirement, 100% liquid)
- Depletion over loan term = monthly income
- Show net worth summary panel

**DSCR Program:**
- Debt Service Coverage Ratio: monthly rent ÷ PITIA
- Display DSCR with color coding: ≥ 1.25 green · 1.00–1.25 amber · < 1.00 red
- No income qualification — property cash flow only
- Show rental income source (lease agreement, market rent from appraisal)

**1099 Program:**
- 1 or 2 years of 1099s
- Income: 1099 total × program factor (typically 75–90%)
- No P&L required if factor applied

For each non-QM type, show the program-specific overlays the LO must check: LTV caps, credit score minimums, reserve requirements. These are informational — pulled from a `nonqm_program_guidelines` config table seeded per tenant.

---

### 24.5 — Asset & Reserve Worksheet

**Assets tab.**

A table of accounts — add row → select type → enter institution, balance, and flags.

**Eligible asset calculation (auto-computed):**
| Account type | Eligible % |
|---|---|
| Checking / Savings / Money Market | 100% |
| CD | 100% |
| Stocks / Bonds / Mutual Funds | 70% |
| 401k / IRA (vested) | 60% |
| Gift funds (sourced + seasoned) | 100% |
| Gift funds (not seasoned) | 0% (flag for LOE + donor letter) |
| Business accounts | 0% (flag — business funds not liquid) |

**Reserve requirement calculator:**

Below the account table, show required reserves vs. available:
```
Loan program: [PROGRAM]
Required reserves: [N] months PITIA = $[AMOUNT]
Available liquid assets: $[ELIGIBLE]
Reserve cushion: $[ELIGIBLE - REQUIRED] (green if positive, red if negative)
```

Reserve requirements by program:
- Conventional < 20% down: 2 months
- Conventional ≥ 20% down: 0 months (but flag if < 2 for risk layering)
- FHA: 0 months required, flag if none
- Jumbo: 6–12 months (configurable)
- Non-QM: 6–18 months (configurable)

**Gift fund tracker:** If any account is flagged as gift, show required documentation checklist: gift letter, donor bank statement, transfer evidence, receiving account statement.

---

### 24.6 — Credit Analysis Panel

**Credit tab.**

**Credit summary header (pulled from credit pull record):**
- Three bureau scores displayed side-by-side in DM Mono 32px
- Qualifying (middle) score highlighted in gold
- Pull date with warning if > 90 days old (credit may need refresh)

**Tradeline table:**

Each tradeline as a table row. Columns: Creditor · Type · Balance · Payment · Limit · Status · 30/60/90 · Mo. Remaining · DTI · LOE

- Status badges: Open (neutral) · Derogatory (red) · Collection (red) · Charge-off (red) · Bankruptcy (red)
- Late payment counts highlighted in red if > 0
- ≤ 10 months remaining: `omit_from_dti` auto-suggested with amber badge
- `omit_from_dti` toggle with required reason dropdown

**AI-Drafted Letters of Explanation:**

For every tradeline where `loe_required = true`, show a `"Draft LOE"` button. On click, call Claude Haiku:
```
Draft a brief, professional letter of explanation for a mortgage borrower to explain
the following derogatory credit item to an underwriter.

Creditor: [CREDITOR]
Account type: [TYPE]
Status: [STATUS]
Balance: $[BALANCE]
Date of last activity: [DATE]

Instructions:
- 2-3 sentences max
- Factual, not emotional
- End with: "This account has been resolved / is being addressed / will not affect my ability to repay."
- Do not include specific personal information beyond what's provided

Return plain text only.
```

LO reviews and can edit before attaching to the loan file. Store in `credit_tradelines.loe_drafted`.

**Credit Score Improvement Panel:**

Below the tradeline table, if the qualifying score < lender's target for the loan program, show:
```
⚡ Score improvement opportunities

Your current qualifying score is [SCORE]. The [PROGRAM] program requires [MIN].
Here's what typically moves scores in 30–60 days:
[AI-generated list based on the specific derogatory items and utilization in the file]
```

Call Claude Haiku with the tradeline summary to generate specific, actionable improvement recommendations.

---

### 24.7 — HOA Certification Tracker

**HOA tab (only visible when property type is condo or PUD).**

Form fields: HOA name · Management company · Owner-occupancy % · Delinquency % · Pending litigation (Y/N + description) · Adequate insurance (Y/N) · FHA-approved (Y/N) · Warrantable (Y/N)

**Auto-review logic (`lib/underwriting/hoaReview.ts`):**

```typescript
export function reviewHOA(cert: HOACertification, loanProgram: string): HOAReviewResult {
  const flags: string[] = [];

  if (cert.owner_occupancy_pct < 51) flags.push('Owner occupancy below 51% — FHA/Conventional ineligible');
  if (cert.delinquency_pct > 15)     flags.push('HOA delinquency exceeds 15% — ineligible for most programs');
  if (cert.pending_litigation)        flags.push('Pending litigation — requires lender exception or ineligible');
  if (!cert.adequate_insurance)       flags.push('Inadequate insurance — must be resolved before closing');

  if (loanProgram === 'FHA' && !cert.fha_approved) flags.push('FHA loan requires FHA-approved condo project');
  if (['Conventional','Jumbo'].includes(loanProgram) && !cert.warrantable)
    flags.push('Non-warrantable condo — not eligible for conventional/agency financing');

  return {
    status: flags.length === 0 ? 'pass' : 'fail',
    flags,
  };
}
```

Review result shown as a badge: `"HOA ✓ Warrantable"` (green) or `"HOA ✗ [N] issues"` (red). Clicking the badge shows the flag list.

---

### 24.8 — AUS Deep Integration (DU / LP)

**AUS Findings tab.**

Extends the Phase 8 AUS integration with a full findings display.

**DU / LP findings import:**

LO pastes the raw AUS findings text (or in future, imports via MISMO XML) into a findings input area. API route `POST /api/leads/[id]/uw/parse-aus-findings` calls Claude Sonnet to parse it:

```
Parse this Automated Underwriting System findings report and extract structured data.

Findings text:
[RAW_FINDINGS_TEXT]

Extract and return JSON:
{
  "system": "DU" | "LP",
  "recommendation": "Approve/Eligible" | "Refer/Eligible" | "Refer" | "Ineligible" | "Out of Scope",
  "documentation_type": "Full Doc" | "DU Refi Plus" | etc.,
  "ltv": number,
  "cltv": number,
  "dti": number,
  "qualifying_rate": number,
  "risk_class": string,
  "conditions": [{ "type": "prior_to_approval"|"prior_to_closing"|"at_closing", "description": string }],
  "messages": [{ "severity": "finding"|"message"|"documentation", "text": string }],
  "key_risk_factors": string[]
}
```

Display findings in a structured, scannable layout — recommendation in a large badge at top, conditions in a table organized by timing (Prior to Approval / Prior to Closing / At Closing), key messages in an accordion.

**AUS conditions → conditions list sync:**

After parsing, show a `"Import [N] conditions to loan file"` button. On confirm, bulk-inserts the AUS conditions into the existing `conditions` table, tagged with `source = 'aus'`, mapped to the correct `phase` (ptd/ptc/ptf).

---

### 24.9 — Layered Risk Score

**Risk tab.**

The Risk Score (0–100, lower = better) is computed by `lib/underwriting/riskScore.ts` and stored on `uw_files.risk_score`.

**Scoring model:**

```typescript
type RiskFactor = { label: string; points: number; severity: 'low'|'medium'|'high' };

export function computeRiskScore(file: UWFileInput): { score: number; factors: RiskFactor[] } {
  const factors: RiskFactor[] = [];
  let score = 0;

  // DTI risk (max 25 pts)
  if (file.backEndDTI > 50)      { score += 25; factors.push({ label: 'DTI > 50%', points: 25, severity: 'high' }); }
  else if (file.backEndDTI > 45) { score += 15; factors.push({ label: 'DTI 45–50%', points: 15, severity: 'medium' }); }
  else if (file.backEndDTI > 43) { score += 10; factors.push({ label: 'DTI 43–45% (non-QM zone)', points: 10, severity: 'medium' }); }

  // LTV risk (max 20 pts)
  if (file.ltv > 95)      { score += 20; factors.push({ label: 'LTV > 95%', points: 20, severity: 'high' }); }
  else if (file.ltv > 90) { score += 12; factors.push({ label: 'LTV 90–95%', points: 12, severity: 'medium' }); }
  else if (file.ltv > 80) { score += 6;  factors.push({ label: 'LTV 80–90% (MI required)', points: 6, severity: 'low' }); }

  // Credit risk (max 20 pts)
  if (file.qualifyingScore < 580)      { score += 20; factors.push({ label: 'Credit score < 580', points: 20, severity: 'high' }); }
  else if (file.qualifyingScore < 620) { score += 12; factors.push({ label: 'Credit score 580–619', points: 12, severity: 'medium' }); }
  else if (file.qualifyingScore < 660) { score += 6;  factors.push({ label: 'Credit score 620–659', points: 6, severity: 'low' }); }

  // Reserve risk (max 15 pts)
  if (file.reserveMonths === 0)      { score += 15; factors.push({ label: 'No reserves', points: 15, severity: 'high' }); }
  else if (file.reserveMonths < 2)   { score += 8;  factors.push({ label: 'Reserves < 2 months', points: 8, severity: 'medium' }); }

  // Self-employed risk (max 10 pts)
  if (file.selfEmployed && file.seIncomeTrend === 'declining') { score += 10; factors.push({ label: 'Declining SE income', points: 10, severity: 'high' }); }
  else if (file.selfEmployed)                                   { score += 5;  factors.push({ label: 'Self-employed borrower', points: 5, severity: 'low' }); }

  // Property risk (max 10 pts)
  if (file.propertyType === 'condo' && !file.hoaWarrantable) { score += 10; factors.push({ label: 'Non-warrantable condo', points: 10, severity: 'high' }); }
  if (file.propertyType === 'manufactured')                   { score += 8;  factors.push({ label: 'Manufactured home', points: 8, severity: 'medium' }); }

  return { score: Math.min(score, 100), factors };
}
```

**Risk score display:**

A gauge (0–100) rendered with pure CSS/SVG. Color zones: 0–25 green · 26–50 amber · 51–75 orange · 76–100 red.

Below the gauge: a table of risk factors with label, points, and severity badges.

**AI Risk Narrative (Claude Sonnet):**

```
You are a senior underwriter summarizing the risk profile of this loan for a loan officer.

Risk score: [SCORE]/100
Risk factors: [FACTORS_JSON]
Loan program: [PROGRAM]
Loan amount: $[AMOUNT]

Write 2-3 sentences:
1. Overall risk assessment
2. The single most important factor to address
3. Likelihood of approval if current profile is submitted

Be direct and professional. No hedging.
```

Store in `uw_files.risk_summary`. Displayed in a card on the Risk tab.

---

### 24.10 — Condition Waterfall (PTD / PTC / PTF)

**Conditions tab** (replaces/extends the existing conditions list for UW-phase conditions).

Three columns (Kanban-style on desktop, tabbed on mobile):
- **PTD** — Prior to Docs (must be cleared before closing docs ordered)
- **PTC** — Prior to Close (must be cleared before closing)
- **PTF** — Prior to Funding (must be cleared before wire sent)

Each condition card shows: description · assigned to · due date · status (open / received / waived / cleared) · source badge (AUS / Manual / AI-suggested)

**AI Condition Suggestions:**

When the DTI worksheet, SE income, credit analysis, and asset worksheet are all populated, a `"Generate AI Conditions"` button appears. Calls Claude Sonnet:

```
You are a mortgage underwriter generating a conditions list for this loan file.

Loan program: [PROGRAM]
Credit score: [SCORE] | DTI: [DTI]% | LTV: [LTV]%
Self-employed: [Y/N] | SE income type: [TYPE]
Derogatory items: [COUNT] | LOE required: [COUNT]
Reserves: [MONTHS] months
HOA: [WARRANTABLE/NON-WARRANTABLE/N/A]
AUS recommendation: [RECOMMENDATION]

Generate a conditions list organized by PTD / PTC / PTF.
For each condition: { phase, description, typical_documentation }
Return JSON array. Max 20 conditions. Be specific to this profile — not a generic list.
```

LO reviews and selects which to add. Each imported condition creates a record in the existing `conditions` table with `source = 'ai_uw'`.

---

### 24.11 — AI Underwriting Memo (Claude Sonnet)

**API route:** `POST /api/leads/[id]/uw/generate-memo`

Aggregates all UW data and generates a full underwriting narrative memo. Rendered as a PDF via Puppeteer (same Edge Function as certificate generation) and stored at `uw_files.uw_memo_url`.

**Memo sections:**
1. Loan Summary (program, amount, rate, term, LTV, CLTV)
2. Borrower Profile (occupancy, employment type, years employed)
3. Income Analysis (qualifying income by source, SE analysis if applicable, total gross monthly, DTI)
4. Credit Analysis (qualifying score, derogatory summary, LOE summary)
5. Asset & Reserves (liquid assets, total eligible, reserve months)
6. Property & Collateral (property type, appraisal value, LTV, HOA status)
7. Risk Assessment (risk score, top factors, layered risk narrative)
8. AUS Findings (recommendation, key messages)
9. Conditions Summary (PTD/PTC/PTF counts, critical path items)
10. Underwriter Recommendation (Approve / Approve with Conditions / Suspend / Deny — AI recommended with reasoning)

**Claude Sonnet prompt:**
```
You are a senior mortgage underwriter writing a formal underwriting credit memo.
This memo will be reviewed by a lending officer and may be included in the loan file.

[FULL JSON OF ALL UW DATA]

Write a professional underwriting memo with the sections listed above.
Use factual, neutral language. Be specific with numbers. Flag risks honestly.
The "Underwriter Recommendation" section should state a clear recommendation and the primary reason.
Format as structured prose — not bullet points.
```

**LO view:** A `"Generate UW Memo"` button on the Risk tab. Progress indicator while generating (30–60 seconds for a full file). Once done, `"Preview"` and `"Download PDF"` buttons appear.

---

### 24.12 — Predictive Suspense Intelligence

**Runs automatically when `uw_files.status` changes to `'submitted'`.**

API route: `POST /api/leads/[id]/uw/predict-outcome`

Calls Claude Sonnet with the full UW profile:
```
You are a mortgage underwriting expert who has reviewed thousands of loan files.
Analyze this loan file and predict the most likely underwriting outcome.

[UW FILE SUMMARY JSON]

Return JSON:
{
  "predicted_outcome": "approve" | "approve_with_conditions" | "suspend" | "counter_offer" | "deny",
  "confidence": 0-100,
  "reasoning": "2-3 sentences explaining why",
  "likely_conditions": ["condition 1", "condition 2"],
  "likely_counter_terms": { ... } or null,
  "preemptive_actions": ["action the LO should take now, before UW responds"]
}
```

Stores in `uw_files.predicted_outcome` and `uw_files.predicted_confidence`.

**Display:** On the UW file header, a `"AI Prediction"` card:
```
⚡ Predicted outcome: Approve with Conditions (74% confidence)
Most likely conditions: Additional reserves documentation, 12 months canceled checks for SE income
Preemptive action: Request borrower's last 12 months bank statements now — UW will ask.
```

**Accuracy tracking:** When the actual UW decision comes in, compare to prediction and log accuracy. Over time this trains the LO on how to prepare files.

---

### 24.13 — UW Timeline Intelligence

**On the UW file header, below the status badge:**

```
Submitted: [DATE]
Time in UW: [N] business days

[Green] Normal — files at this risk profile average 11 business days.
```

Or if over average:
```
[Amber] Longer than usual — this file has been in UW 17 days.
Common reasons at this stage: stalled appraisal review, incomplete tax transcript, UW backlog.
Consider contacting your UW rep.
```

**Implementation:**
- Compute business days from `uw_files.submitted_at` to now (use business day calculator from Phase 25.10)
- Store historical UW turnaround times per tenant in `uw_timeline_benchmarks` table (seeded with industry averages, updated as real data accumulates)
- Compare current file's days-in-UW against the p50 and p85 for its risk tier (low/medium/high)

```sql
CREATE TABLE uw_timeline_benchmarks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid REFERENCES tenants(id),  -- NULL = industry default
  risk_tier    text NOT NULL CHECK (risk_tier IN ('low','medium','high')),
  loan_program text NOT NULL,
  p50_days     integer NOT NULL,
  p85_days     integer NOT NULL,
  updated_at   timestamptz DEFAULT now()
);

-- Seed industry defaults
INSERT INTO uw_timeline_benchmarks (tenant_id, risk_tier, loan_program, p50_days, p85_days) VALUES
  (NULL, 'low',    'Conventional', 7,  14),
  (NULL, 'medium', 'Conventional', 11, 18),
  (NULL, 'high',   'Conventional', 14, 25),
  (NULL, 'low',    'FHA',          9,  16),
  (NULL, 'medium', 'FHA',          13, 21),
  (NULL, 'high',   'FHA',          16, 28),
  (NULL, 'low',    'VA',           10, 18),
  (NULL, 'medium', 'VA',           14, 22),
  (NULL, 'high',   'VA',           18, 30),
  (NULL, 'low',    'Jumbo',        12, 20),
  (NULL, 'medium', 'Jumbo',        16, 26),
  (NULL, 'high',   'Jumbo',        21, 35);
```

---

### 24.14 — Denial Analysis & Adverse Action

**Triggered when `uw_files.status` changes to `'denied'`.**

**Adverse Action Notice (ECOA / Reg B — 15 USC § 1691):**

Required within 30 days of denial. Ashley IQ auto-generates on denial:

1. Determine reason codes from the denial (pull from `uw_decisions.notes` and risk factors via Claude Haiku)
2. Generate notice text:
```
Draft an Adverse Action Notice for a mortgage loan denial.
This must comply with ECOA (Reg B, 12 CFR Part 1002) and FCRA.

Applicant: [NAME]
Loan type: [PROGRAM]
Loan amount: $[AMOUNT]
Property address: [ADDRESS]
Application date: [DATE]
Denial date: [DATE]

Primary reasons (up to 4, FCRA codes):
[REASONS]

Include:
- Statement of action taken
- Name and address of creditor
- ECOA non-discrimination statement
- Right to statement of reasons (if not already included)
- FCRA credit score disclosure if credit score was a factor
- CRA contact information

Return formal letter text only. No placeholders — use the actual values provided.
```

3. Store in `adverse_actions.ai_drafted_notice`
4. LO reviews, edits if needed, approves, and sends via Resend
5. Set `notice_sent_at` and log to `adverse_actions`

**Notice deadline alert:**
- `notice_due_by` = denial date + 30 days
- Relay reminder to LO at T-7 days and T-1 day if notice not yet sent
- Dashboard badge: `"⚠️ Adverse Action notice due in [N] days"` (red if < 3 days)

**HMDA Capture:**
On denial, show an HMDA data review panel — confirm race, ethnicity, sex, income, property census tract are recorded. These fields are required for HMDA LAR reporting.

---

### 24.15 — Underwriter Direct Message Channel

**Messages tab** (on the UW file).

A clean thread UI — similar to the borrower portal messages (Phase 4.2) but for LO ↔ UW communication.

**Features:**
- Message input at bottom with `sender_type` selector (LO / Processor)
- Messages displayed chronologically with sender badge and timestamp
- Unread indicator on the Messages tab badge
- `"Copy thread summary"` button → calls Claude Haiku to summarize the thread for reference in other tools:
  ```
  Summarize this underwriting message thread for a loan file note.
  Key information: outstanding items, commitments made, decisions reached.
  3-5 bullet points. Professional language.
  [THREAD_TEXT]
  ```

**Real-time:** Supabase Realtime on `uw_messages` for live updates without polling.

---

### 24.16 — Fair Lending Monitoring

**Runs automatically in the background — never requires LO action.**

**At loan submission:** `POST /api/uw/fair-lending-check` compares this loan's:
- Rate offered vs. similar profiles in the same zip code
- Processing time vs. similar profiles by LO
- Fee levels vs. similar profiles

If statistically significant disparities detected (> 1.5σ from mean for the same loan program + LTV + credit tier), insert a `fair_lending_flags` record.

**Branch manager dashboard panel (admin role only):**

A `"Fair Lending"` panel showing:
- Last 90 days: [N] flags by severity
- Denial rate by HMDA demographic group (displayed as a table, NOT as a decision driver)
- Processing time disparity summary
- Action required: [N] flags awaiting review

**CFPB exam export:** One-click download of fair lending summary report in a format suitable for CRA/HMDA examination.

---

### 24.17 — Borrower-Facing UW Status in Portal

**Extends the Phase 4 Borrower Portal.**

When `uw_files.status` is set, the portal's milestone tracker gains a contextual status card:

```
🔍 Your file is in underwriting
The underwriter is reviewing your income, credit, and property details.
This typically takes [X] business days. You're on day [N] — [STATUS MESSAGE].

What you can do to help: [AI-generated, e.g. "Respond quickly to any requests for additional documents."]
```

Status messages auto-update via Supabase Realtime. When `status = 'approved_with_conditions'`:

```
✓ Conditionally approved!
Your loan has been conditionally approved. There are [N] remaining items
needed before you can close. Your loan officer will be in touch.
```

No raw UW data is exposed to the borrower (no risk scores, no DTI numbers, no tradeline data).

---

### 24.18 — LO / Realtor Dual Role Compliance Check

**This is a pre-submission compliance gate.** On purchase transactions, it is illegal under FHA (HUD Handbook 4000.1 §II.A.1.b), VA (Lender Handbook Chapter 9), and USDA guidelines for the originating LO to also be the listing or selling agent on the same transaction. It also raises RESPA Section 8 concerns on Conventional loans.

**Trigger:** Runs on every purchase loan when the purchase contract is uploaded, and again when the loan is submitted to UW.

**Detection logic (`lib/compliance/dualRoleCheck.ts`):**

```typescript
export async function checkDualRole(lead: Lead, lo: User): Promise<DualRoleCheckResult> {
  const checks: MatchResult[] = [];

  // 1. Name match: LO name vs. listing/selling agent on purchase contract
  if (lead.listing_agent_name || lead.selling_agent_name) {
    const listingMatch = fuzzyMatch(lo.full_name, lead.listing_agent_name);
    const sellingMatch = fuzzyMatch(lo.full_name, lead.selling_agent_name);
    if (listingMatch.score > 0.85 || sellingMatch.score > 0.85) {
      checks.push({ type: 'fuzzy', confidence: Math.max(listingMatch.score, sellingMatch.score) * 100 });
    }
  }

  // 2. CredifyID: check if LO has active RE license in transaction state
  if (process.env.CREDIFYID_API_KEY) {
    const reLicense = await credifyID.checkRealEstateLicense({
      name: lo.full_name,
      nmls: lo.nmls_number,
      state: lead.property_state,
    });
    if (reLicense.found) {
      checks.push({ type: 'license', confidence: 95, re_license: reLicense.license_number });
    }
  }

  // 3. CLOSA cross-reference: check if LO appears as agent in CLOSA for this property
  // (only if CLOSA integration is connected — feature flag closaIntegrationEnabled)
  if (process.env.CLOSA_API_KEY && lead.property_address) {
    const closaMatch = await closa.findAgentByProperty(lead.property_address, lo.full_name);
    if (closaMatch.found) {
      checks.push({ type: 'closa_match', confidence: 98 });
    }
  }

  const violation = checks.length > 0;
  const highestConfidence = Math.max(...checks.map(c => c.confidence), 0);

  return {
    violation,
    match_type: checks[0]?.type ?? 'no_match',
    match_confidence: highestConfidence,
    re_license: checks.find(c => c.re_license)?.re_license,
    // Determine regulatory rule and whether to block vs. warn
    violation_rule: determineViolationRule(lead.loan_program, violation),
    blocked: violation && ['FHA','VA','USDA'].includes(lead.loan_program),
  };
}

function determineViolationRule(loanProgram: string, violation: boolean): string | null {
  if (!violation) return null;
  if (loanProgram === 'FHA')  return 'HUD Handbook 4000.1 §II.A.1.b — LO may not have real estate interest in FHA transaction';
  if (loanProgram === 'VA')   return 'VA Lender Handbook Ch. 9 — Lender personnel may not have financial interest in the property';
  if (loanProgram === 'USDA') return 'USDA Rural Development Guidelines — LO/realtor dual role prohibited';
  return 'RESPA Section 8 — Potential kickback concern; review with compliance officer';
}
```

**UI — on purchase contract upload and on UW submission:**

If `violation = true` and `blocked = true` (FHA/VA/USDA):
```
🚫 DUAL ROLE COMPLIANCE VIOLATION — Submission Blocked

[LOAN_PROGRAM] guidelines prohibit the originating loan officer from also acting
as the listing or selling agent on the same transaction.

Rule: [VIOLATION_RULE]
Match detected: [MATCH_TYPE] ([CONFIDENCE]% confidence)

This loan cannot be submitted to underwriting until this is resolved.
If this is a false positive, document your resolution below.
```

Submission is hard-blocked until an LO with manager or compliance role marks it resolved with notes.

If `violation = true` and `blocked = false` (Conventional):
```
⚠️ Dual Role Warning

The LO appears to also be the real estate agent on this transaction.
On Conventional loans, this raises RESPA Section 8 concerns. Review with
your compliance officer before proceeding.

[Acknowledge and proceed]  [Escalate to compliance]
```

Log every check (pass or fail) to `dual_role_checks`.

---

## PHASE 25 — CD BALANCER

The Closing Disclosure Balancer is Ashley IQ's TRID compliance command center. A CD that doesn't balance or contains undetected tolerance violations creates direct lender liability — CFPB fines, borrower cure obligations, and investor repurchase demands. The CD Balancer prevents all three.

---

### 25.1 — Schema

```sql
-- Loan Estimates (all versions — LE is the comparison baseline for CD)
CREATE TABLE loan_estimates (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                     uuid NOT NULL REFERENCES leads(id),
  tenant_id                   uuid NOT NULL REFERENCES tenants(id),
  version_number              integer NOT NULL DEFAULT 1,
  issue_date                  date NOT NULL,
  is_current                  boolean NOT NULL DEFAULT true,
  issued_within_3_days        boolean,    -- verified by business day calculator
  changed_circumstance_reason text,       -- why this revised LE was issued
  changed_circumstance_doc_url text,
  total_loan_costs            numeric(10,2),
  total_other_costs           numeric(10,2),
  total_closing_costs         numeric(10,2),
  lender_credits              numeric(10,2) DEFAULT 0,
  cash_to_close               numeric(10,2),
  created_at                  timestamptz DEFAULT now()
);

-- Enforce only one current LE per lead
CREATE UNIQUE INDEX ON loan_estimates(lead_id) WHERE is_current = true;

-- LE and CD fee line items (one table for both — discriminated by disclosure_type)
CREATE TABLE disclosure_fee_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disclosure_id     uuid NOT NULL,
  disclosure_type   text NOT NULL CHECK (disclosure_type IN ('le','cd')),
  lead_id           uuid NOT NULL REFERENCES leads(id),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  section           text NOT NULL CHECK (section IN ('A','B','C','E','F','G','H','I','J','K','L')),
  -- Tolerance categories per TRID (12 CFR § 1026.19)
  -- A: Origination (0%) | B: Cannot shop (0%) | C: Can shop (10%) | E: Taxes/govt (10%)
  -- F: Prepaids (none) | G: Escrow (none) | H: Other (none)
  tolerance_category text NOT NULL CHECK (tolerance_category IN ('zero','ten_percent','no_cap')),
  fee_name          text NOT NULL,
  fee_amount        numeric(10,2) NOT NULL,
  fee_paid_by       text NOT NULL DEFAULT 'borrower' CHECK (fee_paid_by IN ('borrower','seller','lender','other')),
  is_apl            boolean DEFAULT false,   -- subject to Aggregate Payment Limitation
  notes             text,
  created_at        timestamptz DEFAULT now()
);

-- Closing Disclosures (all versions)
CREATE TABLE closing_disclosures (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                      uuid NOT NULL REFERENCES leads(id),
  tenant_id                    uuid NOT NULL REFERENCES tenants(id),
  compared_to_le_id            uuid NOT NULL REFERENCES loan_estimates(id),
  version_number               integer NOT NULL DEFAULT 1,
  issue_date                   date NOT NULL,
  closing_date                 date,
  disbursement_date            date,
  is_final                     boolean NOT NULL DEFAULT false,
  -- Tolerance results (populated by CD Balancer engine)
  zero_tolerance_violation     boolean NOT NULL DEFAULT false,
  zero_tolerance_excess        numeric(10,2) NOT NULL DEFAULT 0,
  ten_pct_violation            boolean NOT NULL DEFAULT false,
  ten_pct_excess               numeric(10,2) NOT NULL DEFAULT 0,
  ten_pct_aggregate_le         numeric(10,2) NOT NULL DEFAULT 0,   -- total 10% fees on LE
  ten_pct_aggregate_cd         numeric(10,2) NOT NULL DEFAULT 0,   -- total 10% fees on CD
  cure_required                boolean NOT NULL DEFAULT false,
  cure_amount                  numeric(10,2) NOT NULL DEFAULT 0,
  cure_deadline                date,
  cure_completed_at            timestamptz,
  cure_credited_amount         numeric(10,2),
  -- Cash-to-close balance check
  cash_to_close                numeric(10,2),
  cash_to_close_balances       boolean,
  balance_discrepancy          numeric(10,2) DEFAULT 0,
  -- Borrower delivery
  delivered_to_borrower_at     timestamptz,
  delivery_method              text CHECK (delivery_method IN ('email','mail','in_person','portal')),
  three_day_satisfied          boolean,    -- is closing date >= 3 business days after delivery?
  -- Settlement agent import
  imported_from_settlement     boolean NOT NULL DEFAULT false,
  settlement_agent_name        text,
  -- Wire safety
  wire_verified                boolean NOT NULL DEFAULT false,
  wire_verified_at             timestamptz,
  wire_verified_by             uuid REFERENCES users(id),
  -- AI narrative
  ai_comparison_narrative      text,
  created_at                   timestamptz DEFAULT now()
);

-- Changed Circumstances (documenting fee increases)
CREATE TABLE changed_circumstances (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id              uuid NOT NULL REFERENCES leads(id),
  tenant_id            uuid NOT NULL REFERENCES tenants(id),
  related_le_id        uuid REFERENCES loan_estimates(id),
  related_cd_id        uuid REFERENCES closing_disclosures(id),
  circumstance_type    text NOT NULL CHECK (circumstance_type IN (
    'borrower_request','changed_eligibility','revisions_to_credit_terms',
    'rate_lock_expiration','new_information','settlement_agent_change',
    'natural_disaster','other'
  )),
  affected_sections    text[],     -- which CD sections this CC justifies
  description          text NOT NULL,
  documentation_url    text,
  ai_drafted_narrative text,
  created_at           timestamptz DEFAULT now()
);

-- Verified wire instructions (per title company — stored once, reused)
CREATE TABLE verified_wire_instructions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  title_company_name  text NOT NULL,
  bank_name           text NOT NULL,
  account_last4       text NOT NULL,   -- NEVER store full account number
  routing_number      text NOT NULL,
  verified_at         timestamptz NOT NULL,
  verified_by         uuid NOT NULL REFERENCES users(id),
  verification_method text NOT NULL CHECK (verification_method IN ('phone','email','in_person','callback')),
  verified_phone      text,           -- callback phone number used for verification
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz DEFAULT now()
);

-- Post-close audit exports (INSERT-only)
CREATE TABLE post_close_audits (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                         uuid NOT NULL REFERENCES leads(id),
  tenant_id                       uuid NOT NULL REFERENCES tenants(id),
  generated_by                    uuid NOT NULL REFERENCES users(id),
  export_format                   text NOT NULL DEFAULT 'pdf' CHECK (export_format IN ('pdf','mismo_xml','json')),
  export_url                      text,
  le_versions_included            integer NOT NULL DEFAULT 0,
  cd_versions_included            integer NOT NULL DEFAULT 0,
  changed_circumstances_included  boolean NOT NULL DEFAULT false,
  tolerance_violations_documented boolean NOT NULL DEFAULT false,
  cures_documented                boolean NOT NULL DEFAULT false,
  created_at                      timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX ON loan_estimates(lead_id, version_number);
CREATE INDEX ON loan_estimates(lead_id) WHERE is_current = true;
CREATE INDEX ON disclosure_fee_items(disclosure_id, disclosure_type);
CREATE INDEX ON disclosure_fee_items(lead_id);
CREATE INDEX ON closing_disclosures(lead_id, version_number);
CREATE INDEX ON closing_disclosures(tenant_id) WHERE cure_required = true AND cure_completed_at IS NULL;
CREATE INDEX ON changed_circumstances(lead_id);
CREATE INDEX ON verified_wire_instructions(tenant_id, title_company_name) WHERE is_active = true;

-- RLS
ALTER TABLE loan_estimates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE disclosure_fee_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE closing_disclosures       ENABLE ROW LEVEL SECURITY;
ALTER TABLE changed_circumstances     ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_wire_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_close_audits         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "le_tenant"             ON loan_estimates            USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "fee_items_tenant"      ON disclosure_fee_items      USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "cd_tenant"             ON closing_disclosures       USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "changed_circ_tenant"   ON changed_circumstances     USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "wire_tenant"           ON verified_wire_instructions USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- post_close_audits: INSERT-only
CREATE POLICY "audit_insert"    ON post_close_audits FOR INSERT WITH CHECK (true);
CREATE POLICY "audit_no_update" ON post_close_audits FOR UPDATE USING (false);
CREATE POLICY "audit_no_delete" ON post_close_audits FOR DELETE USING (false);
```

---

### 25.2 — LE Version Manager

**Location:** New `"Disclosures"` top-level tab on the lead record with sub-tabs: Loan Estimates · Closing Disclosures · CD Balancer · Wire Safety · Audit Export

**Loan Estimates sub-tab:**

A version history table showing all LE versions: version · issue date · cash to close · status (Current / Superseded) · Changed Circumstance (if revised)

**Create new LE / Revised LE:**
- Issue date (required)
- If version > 1: require Changed Circumstance selection (dropdown) + description + optional document upload
- Fee entry: Section-by-section fee table matching the TRID LE format (Sections A–H + cash-to-close calculations)
- Tolerance categories are pre-set per section — LO cannot override them

**On creating a revised LE:**
- Set `is_current = false` on all previous LEs for this lead
- Set new LE as `is_current = true`
- Auto-check: was the revised LE issued within 3 business days of the Changed Circumstance? (uses business day calculator). If not, show compliance warning.

---

### 25.3 — TRID Tolerance Engine

**Core library: `lib/disclosures/toleranceEngine.ts`**

```typescript
export function runToleranceCheck(
  leFees: DisclosureFeeItem[],
  cdFees: DisclosureFeeItem[]
): ToleranceCheckResult {

  // 0% Tolerance — each fee individually cannot increase
  const zeroToleranceFees = leFees.filter(f => f.tolerance_category === 'zero');
  const zeroViolations: FeeViolation[] = [];
  let zeroExcess = 0;

  for (const leFee of zeroToleranceFees) {
    const cdFee = cdFees.find(f => f.fee_name === leFee.fee_name && f.section === leFee.section);
    const cdAmount = cdFee?.fee_amount ?? 0;
    if (cdAmount > leFee.fee_amount) {
      const excess = cdAmount - leFee.fee_amount;
      zeroExcess += excess;
      zeroViolations.push({ fee_name: leFee.fee_name, section: leFee.section,
        le_amount: leFee.fee_amount, cd_amount: cdAmount, excess, category: 'zero' });
    }
  }

  // 10% Tolerance — aggregate of section C + E cannot increase by more than 10%
  const tenPctFees = leFees.filter(f => f.tolerance_category === 'ten_percent');
  const leAggregate = tenPctFees.reduce((sum, f) => sum + f.fee_amount, 0);
  const cdTenPctFees = cdFees.filter(f => f.tolerance_category === 'ten_percent');
  const cdAggregate = cdTenPctFees.reduce((sum, f) => sum + f.fee_amount, 0);
  const tenPctAllowance = leAggregate * 0.10;
  const tenPctExcess = Math.max(0, cdAggregate - leAggregate - tenPctAllowance);
  const tenPctViolation = tenPctExcess > 0;

  // Total cure required = zero tolerance excess + 10% aggregate excess
  const cureAmount = zeroExcess + tenPctExcess;

  return {
    zero_tolerance_violation: zeroViolations.length > 0,
    zero_tolerance_excess: zeroExcess,
    zero_violations: zeroViolations,
    ten_pct_violation: tenPctViolation,
    ten_pct_excess: tenPctExcess,
    ten_pct_aggregate_le: leAggregate,
    ten_pct_aggregate_cd: cdAggregate,
    cure_required: cureAmount > 0,
    cure_amount: cureAmount,
  };
}
```

**Runs automatically** whenever a CD is saved or any fee item is updated.

---

### 25.4 — CD Balancer UI

**CD Balancer sub-tab** — the primary interface.

**Select LE version to compare:** Dropdown defaulting to the current LE.

**Fee comparison table:**

Side-by-side: LE column vs. CD column vs. Difference column vs. Tolerance column.

For each fee line:
- LE amount · CD amount · Difference (colored: red if increase in 0%/10% category, green if decrease)
- Tolerance badge: `"0%"` · `"10%"` · `"No cap"`
- Violation indicator: `"⚠️ Excess: $[X]"` in red

**Tolerance summary panel (below the table):**
```
0% Tolerance    ██████████  $0 excess ✓
10% Tolerance   ██████████  $0 excess ✓
No-cap fees     ──          (no tolerance limit)

Cash-to-close   ✓ Balanced   $[AMOUNT]
```

If violations exist:
```
⚠️ Tolerance violations detected

0% Tolerance:  $[EXCESS] excess → Cure required
10% Aggregate: $[EXCESS] excess → Cure required

Total cure owed to borrower: $[TOTAL]
Cure deadline: [DATE] (must be credited at or before closing)

[Document Changed Circumstance]  [Calculate Cure]
```

---

### 25.5 — Changed Circumstance Documentation Engine

**`"Document Changed Circumstance"` button (appears when tolerance violation is detected or when LO issues a revised LE):**

Opens a modal:
1. Select circumstance type (dropdown with plain-English labels)
2. Free-text description
3. Affected fee sections (multi-select checkboxes: A, B, C, E)
4. Optional document upload

**AI draft narrative button:**
```typescript
// Claude Haiku generates a compliant CC narrative
const prompt = `
Draft a Changed Circumstance narrative for a mortgage file.
This will be included in the loan file to justify a fee change on the Closing Disclosure.

Circumstance type: [TYPE]
Affected sections: [SECTIONS]
Description: [DESCRIPTION]

Write 2-3 sentences in formal, regulatory language. Be specific about what changed and why
it constitutes a valid Changed Circumstance under TRID (12 CFR § 1026.19(e)(3)(iv)).
`;
```

Store in `changed_circumstances`. Attach to the CD record via `related_cd_id`.

**Validation:** If a fee in Section A or B increased on the CD and no Changed Circumstance is documented for that section, show a blocking warning: *"Section [X] fees increased but no Changed Circumstance is documented. Cure obligation remains until a valid CC is filed."*

---

### 25.6 — Settlement Agent CD Import

**`"Import from Settlement Agent"` button on the CD Balancer tab.**

**Supported import methods:**
1. **Structured paste:** LO pastes the settlement agent's fee schedule as plain text. Claude Sonnet parses it into structured fee items:
   ```
   Parse the following mortgage closing fee schedule and extract all fee line items.
   For each fee, identify: fee_name, amount, paid_by, and which TRID section it belongs to (A–H).
   Return JSON array: [{ fee_name, amount, paid_by, section }]

   Fee schedule:
   [PASTED_TEXT]
   ```

2. **MISMO XML upload:** Accept `.xml` file conforming to MISMO 3.4 IntegratedDisclosure dataset. Parse `ClosingDisclosure/FeePayment` elements.

After import: show a review table where the LO can correct any misclassified sections before saving. One-click `"Confirm and run tolerance check"` saves all items and immediately re-runs the tolerance engine.

---

### 25.7 — Wire Fraud Safety Check

**This is a hard pre-close gate — the CD cannot be marked final without completing the wire check.**

**Wire Safety Check panel (on the CD Balancer tab):**

```
⚡ Wire Safety Check — Required before final CD

Title company on this transaction: [TITLE_COMPANY_NAME]

Verified instructions on file:
  Bank: [BANK_NAME]
  Account ending: [LAST4]
  Routing: [ROUTING]
  Last verified: [DATE] by [NAME] via [METHOD]

Wire instructions on this CD: [MATCH / MISMATCH / NOT VERIFIED]
```

**Match logic:**
- Compare CD's wire instructions (settlement agent name + account last 4 + routing) against `verified_wire_instructions` for this tenant
- If MATCH and verified within 30 days: green badge, wire check passed
- If MATCH but verified > 30 days ago: amber warning — "Re-verify recommended (instructions verified [N] days ago)"
- If MISMATCH: **red blocking alert** — "Wire instructions on this CD do not match verified instructions on file. Do NOT wire funds until instructions are re-verified by phone."
- If NOT IN SYSTEM: "No verified instructions on file for this title company. Verify before closing."

**Add/update verified instructions form:**
- Title company name · Bank name · Account last 4 · Routing number · Verification method · Callback phone used
- Saving creates a new `verified_wire_instructions` record
- Note: only manager role or compliance role can add/update wire instructions

**The CD cannot be marked `is_final = true` if `wire_verified = false`.** Enforce in the API route.

---

### 25.8 — Cure Calculator & Deadline Tracker

**Triggered automatically when `cure_required = true`.**

**Cure calculation display:**
```
Cure Required
─────────────────────────────────
0% Tolerance excess:  $[AMOUNT]
10% Aggregate excess: $[AMOUNT]
─────────────────────────────────
Total cure:           $[TOTAL]

Cure deadline: [DATE]
(Cure must be applied at or before closing — CFPB Bulletin 2013-12)
```

**Cure application options (LO selects one):**
1. Lender credit on CD (most common) — shown as negative fee in Section J
2. Principal reduction — reduce loan amount by cure amount
3. Check to borrower at closing

**Cure tracking:**
- `closing_disclosures.cure_credited_amount` — updated when cure is reflected on CD
- `closing_disclosures.cure_completed_at` — set when confirmed
- Dashboard badge on lead card: `"⚠️ $[CURE] cure due [DATE]"` (red if < 3 days, cleared when completed)

**Relay alerts:**
- 5 days before cure deadline: SMS + email to LO
- 1 day before: escalate to branch manager if `cure_completed_at` is still null

---

### 25.9 — Cash-to-Close Balancer

**Runs automatically on every CD save.**

**Balance verification:**
```typescript
// lib/disclosures/cashToCloseBalance.ts
export function verifyCashToClose(cd: ClosingDisclosure, fees: DisclosureFeeItem[]): BalanceResult {
  // Standard TRID cash-to-close calculation:
  // Closing costs financed: fees paid to lender or from escrow
  // Adjustments: seller credits, gift funds, etc.
  // Down payment + closing costs - credits = cash to close

  const totalFeesBorrower = fees.filter(f => f.fee_paid_by === 'borrower').reduce((s, f) => s + f.fee_amount, 0);
  const lenderCredits = fees.filter(f => f.fee_paid_by === 'lender').reduce((s, f) => s + f.fee_amount, 0);
  const computedCashToClose = cd.down_payment + totalFeesBorrower - lenderCredits - cd.seller_credits;
  const discrepancy = Math.abs(computedCashToClose - cd.cash_to_close);

  return {
    balances: discrepancy <= 0.01,   // penny tolerance
    discrepancy,
    computed: computedCashToClose,
    stated: cd.cash_to_close,
  };
}
```

**Display:** Below the tolerance summary:
```
Cash to Close
  Computed:  $[COMPUTED]
  On CD:     $[STATED]
  [✓ Balanced] or [✗ Discrepancy: $[AMOUNT] — review Section [X]]
```

If not balanced, show which section is likely causing the discrepancy based on the largest unexplained fee difference.

---

### 25.10 — Business Day Calculator

**Utility: `lib/disclosures/businessDays.ts`**

Used throughout: TRID 3-day rule, cure deadlines, adverse action deadlines, UW timeline.

```typescript
const FEDERAL_HOLIDAYS_2024_2026 = [
  // New Year's Day, MLK, Presidents Day, Memorial Day, Juneteenth,
  // Independence Day, Labor Day, Columbus Day, Veterans Day,
  // Thanksgiving, Christmas
  // (populate full list)
];

export function addBusinessDays(startDate: Date, days: number): Date { ... }
export function businessDaysBetween(start: Date, end: Date): number { ... }
export function isBusinessDay(date: Date): boolean { ... }
export function nextBusinessDay(date: Date): Date { ... }
```

**TRID 3-day rule check:**

When `closing_disclosures.delivered_to_borrower_at` is set:
```typescript
const businessDaysTilClose = businessDaysBetween(deliveredAt, closingDate);
const threeDaySatisfied = businessDaysTilClose >= 3;
```

Show on CD header: `"✓ 3-day waiting period satisfied"` (green) or `"⚠️ Closing is [N] business days after CD delivery — 3 required"` (red).

---

### 25.11 — Prepaid Interest Calculator

**In the CD Balancer, Section F (Prepaids) auto-populates this line:**

```typescript
// Per-diem interest = loan_amount × (rate / 100) / 365
// Days = days from closing date to first payment date (typically 1–31 days)
export function calculatePrepaidInterest(
  loanAmount: number,
  rate: number,
  closingDate: Date,
  firstPaymentDate: Date
): PrepaidInterestResult {
  const perDiem = loanAmount * (rate / 100) / 365;
  const days = Math.ceil((firstPaymentDate.getTime() - closingDate.getTime()) / (1000 * 60 * 60 * 24));
  return { perDiem, days, total: perDiem * days };
}
```

**Display on CD Balancer:**
```
Prepaid Interest
  First payment date:    [DATE]
  Closing date:          [DATE]
  Per diem:              $[AMOUNT]/day
  Days:                  [N]
  Total prepaid interest: $[TOTAL]
```

LO confirms the first payment date — if the closing date changes, the prepaid interest auto-recalculates and triggers a re-run of the balance check.

---

### 25.12 — Post-Closing Audit Export (CFPB-Exam Ready)

**`Audit Export` sub-tab.**

**`"Generate Audit Package"` button (manager/compliance role only):**

Assembles a complete CFPB-examination-ready package:

1. All LE versions (chronological) with Changed Circumstance documentation for each revision
2. Final CD with tolerance check results
3. Any cure documentation
4. Wire safety check log
5. HMDA data fields (if fair lending monitoring is connected)
6. Business day calculations for all TRID timing requirements

**Output formats:**
- **PDF** (default): full package as a single paginated PDF, generated via Puppeteer Edge Function
- **MISMO 3.4 XML**: IntegratedDisclosure dataset export — interoperable with all major LOS systems
- **JSON**: machine-readable export for internal QC tools

**MISMO 3.4 XML generation:**

```typescript
// lib/disclosures/mismoExport.ts
export function generateMISMO34(lead: Lead, les: LoanEstimate[], cd: ClosingDisclosure): string {
  // Build MISMO 3.4 MESSAGE > DEAL > ASSETS > LOANS > LOAN >
  // CLOSING_INFORMATION > INTEGRATED_DISCLOSURES
  // Per MISMO Reference Model 3.4.0
  // Returns XML string
}
```

Export stored at `post_close_audits.export_url` in Supabase Storage (private, signed URL).

---

### 25.13 — QC Scorecard Integration

**Branch manager dashboard — new `"QC Scorecard"` card.**

Per LO, per month:
| Metric | LO | Branch Avg |
|---|---|---|
| Tolerance violations | [N] | [N] |
| Cure events | [N] | [N] |
| Total cures paid out | $[X] | $[X] |
| TRID timing failures | [N] | [N] |
| UW suspense rate | [%] | [%] |
| Adverse action notices sent on time | [%] | [%] |
| Dual role flags | [N] | [N] |

Data sourced from `closing_disclosures`, `adverse_actions`, `dual_role_checks`, `uw_decisions`.

**Trend sparklines** (last 6 months) for tolerance violations and cures — pure CSS/SVG, no library.

---

### 25.14 — Borrower-Facing CD Explanation in Portal

**Extends the Phase 4 Borrower Portal.**

When `closing_disclosures.is_final = true`, the portal home screen shows a `"Your Closing Disclosure is Ready"` card:

```
📄  Your Closing Disclosure is ready

Your final closing costs have been set. Here's how they compare to your original estimate.

Closing costs:  $[CD_TOTAL]  (was $[LE_TOTAL] on your Loan Estimate)
Cash to close:  $[CD_CTC]    (was $[LE_CTC])

[View comparison →]   [Download CD →]
```

**Comparison view:**

A simplified fee table showing:
- Each fee category (not individual line items — too granular for borrowers)
- LE amount vs. CD amount
- Change indicator: `"Same"` · `"+$X"` (amber if increase) · `"-$X"` (green if decreased)
- AI-generated plain-English explanation of any changes:
  ```
  Claude Haiku prompt:
  "Explain the following closing cost changes to a borrower in 2-3 sentences.
  Be warm, honest, and avoid jargon. Focus on the net change in cash to close.
  If costs decreased, celebrate that. If they increased, explain why simply.
  Changes: [CHANGES_JSON]"
  ```

**3-day countdown:** If `three_day_satisfied = false`, show:
```
⏳ Your closing is in [N] business days.
Federal law requires you to have this disclosure for at least 3 business days before closing.
You cannot close until [DATE].
```

---

## PHASE 26 — QR CODE MARKETING

Social media posts, co-marketing posts, and referral partner materials should generate unique, trackable QR codes that link directly to the LO's application. This turns every post into a measurable lead generation event.

---

### 26.1 — Schema

```sql
CREATE TABLE qr_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  lo_id         uuid NOT NULL REFERENCES users(id),
  partner_id    uuid REFERENCES partners(id),   -- for co-marketing: which realtor/referral partner
  campaign_id   uuid REFERENCES campaign_sequences(id),   -- for campaign attribution
  qr_type       text NOT NULL CHECK (qr_type IN ('social_post','co_marketing','referral_link','flyer','email')),
  target_url    text NOT NULL,    -- the POS application URL with UTM params
  short_code    text NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  scan_count    integer NOT NULL DEFAULT 0,
  lead_count    integer NOT NULL DEFAULT 0,   -- leads created from this QR
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE qr_scans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id  uuid NOT NULL REFERENCES qr_codes(id),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  ip_address  inet,
  user_agent  text,
  referrer    text,
  lead_id     uuid REFERENCES leads(id),   -- populated if scan results in lead
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX ON qr_codes(lo_id);
CREATE INDEX ON qr_codes(short_code);
CREATE INDEX ON qr_scans(qr_code_id);
CREATE INDEX ON qr_scans(lead_id) WHERE lead_id IS NOT NULL;

ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_codes_tenant" ON qr_codes USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "qr_scans_tenant" ON qr_scans USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
```

**Redirect route (public):** `GET /q/[short_code]`
- Increment `qr_scans` count
- Insert `qr_scans` record with IP + user agent
- Redirect to `target_url`
- When that URL results in a lead being created, the POS links back via the `?qr=[short_code]` UTM param

---

### 26.2 — QR Code Generation

**Package:** `qrcode` npm package (`npm install qrcode @types/qrcode`). Generates QR as SVG or PNG — no external API.

```typescript
// lib/marketing/qrGenerator.ts
import QRCode from 'qrcode';

export async function generateQRCode(
  qrRecord: QRCode,
  options: { format: 'svg' | 'png'; size?: number; includeMargin?: boolean }
): Promise<string> {
  const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/q/${qrRecord.short_code}`;

  if (options.format === 'svg') {
    return QRCode.toString(redirectUrl, {
      type: 'svg',
      width: options.size ?? 200,
      margin: options.includeMargin ? 2 : 0,
      color: { dark: '#0F1D2E', light: '#FFFFFF' },   // Midnight Navy on white
    });
  }

  return QRCode.toDataURL(redirectUrl, {
    type: 'image/png',
    width: options.size ?? 400,
    margin: options.includeMargin ? 2 : 0,
    color: { dark: '#0F1D2E', light: '#FFFFFF' },
  });
}
```

QR codes are Midnight Navy on white — on-brand, high contrast, scannable.

---

### 26.3 — Social Media Center Integration (extends Phase 14)

**In the Social Media / Ad Center (Phase 14), every post template gains a `"Add QR code"` toggle.**

When toggled on:
1. Create `qr_codes` record for this post (`qr_type = 'social_post'`, UTM params auto-populated from post campaign)
2. Generate QR PNG
3. Composite the QR code onto the social media image:
   - Default position: bottom-right corner
   - Size: 15% of image width
   - White padding: 8px around QR
   - Caption below QR (optional, toggleable): `"Scan to apply"` in Instrument Sans 10px
4. LO can drag to reposition before downloading

**UTM auto-population:**
- `utm_source`: platform (instagram / facebook / linkedin / twitter)
- `utm_medium`: social
- `utm_campaign`: post campaign name slug
- `utm_content`: `qr_[post_id]`

---

### 26.4 — Co-Marketing QR Codes

**In the Partner CRM (existing partner/realtor records), add a `"Co-Marketing"` tab.**

**Generate co-marketing flyer with QR:**
1. Select a realtor partner from the list
2. Choose flyer template (2–3 pre-designed templates: Home Buying · Refinance · New Listing)
3. QR code auto-generated with `partner_id` set → links to POS with UTM `utm_content=co_[partner_id]`
4. LO logo + realtor logo side by side on the flyer
5. Download as PNG or PDF

This gives the LO a shareable co-marketing asset in under 60 seconds. The QR tracks exactly which realtor's flyer generated which applications.

---

### 26.5 — QR Attribution Dashboard

**In the Campaigns/Analytics section, add a `"QR Codes"` panel:**

| QR Code | Type | Partner | Scans | Leads | Conversion |
|---|---|---|---|---|---|
| Instagram Spring Post | social_post | — | 47 | 3 | 6.4% |
| Sarah Johnson Flyer | co_marketing | Sarah Johnson RE | 23 | 5 | 21.7% |

Clicking any row shows the scan timeline (when scans occurred) and lead details for any QR-sourced leads.

**Lead record:** When a lead is created from a QR scan, a `"Source: QR — [CAMPAIGN_NAME]"` badge appears on the lead card, and the `qr_scans` record is updated with the `lead_id`.

---

## MIGRATIONS — RUN VIA SUPABASE MCP

Apply after completing each phase. Do not batch at the end.

```
Phase 24: uw_files, uw_decisions, dti_worksheets, se_income_worksheets,
          asset_worksheets, asset_accounts, credit_analyses, credit_tradelines,
          hoa_certifications, uw_messages, adverse_actions, fair_lending_flags,
          dual_role_checks, uw_timeline_benchmarks (+ seed data)

Phase 25: loan_estimates, disclosure_fee_items, closing_disclosures,
          changed_circumstances, verified_wire_instructions, post_close_audits
          ALTER leads ADD COLUMN IF NOT EXISTS listing_agent_name text
          ALTER leads ADD COLUMN IF NOT EXISTS selling_agent_name text

Phase 26: qr_codes, qr_scans

RLS:      All RLS policies (run after all phases)
```

---

## FINAL STEP — AUTONOMOUS VERIFICATION

Run every check below after all phases are built. Fix any failure before reporting done.

### Step 0 — Design Integrity
```bash
git diff --name-only app/globals.css tailwind.config.ts app/layout.tsx
grep -rn "#007AFF\|#3478F6\|#0A84FF" app/ components/ --include="*.tsx"
grep -rn "bg-gray-[2-9]\|bg-slate-[2-9]\|bg-zinc-[2-9]" app/ --include="*.tsx"
grep -rn "#F5EFE0" app/ components/ --include="*.tsx" --include="*.css"
find app/ components/ -name "*.css" ! -name "globals.css"
```
Any result = STOP AND FIX.

### Step 1 — TypeScript
```bash
npx tsc --noEmit
```
Zero errors required.

### Step 2 — Schema Verification
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'uw_files','uw_decisions','dti_worksheets','se_income_worksheets',
  'asset_worksheets','asset_accounts','credit_analyses','credit_tradelines',
  'hoa_certifications','uw_messages','adverse_actions','fair_lending_flags',
  'dual_role_checks','uw_timeline_benchmarks',
  'loan_estimates','disclosure_fee_items','closing_disclosures',
  'changed_circumstances','verified_wire_instructions','post_close_audits',
  'qr_codes','qr_scans'
);
-- Must return all 22 tables
```

### Step 3 — INSERT-only Audit Tables
```sql
SELECT tablename, cmd FROM pg_policies
WHERE tablename IN ('uw_decisions','adverse_actions','fair_lending_flags','post_close_audits')
AND cmd IN ('UPDATE','DELETE');
-- Must return zero rows (no UPDATE or DELETE policies exist)
```

### Step 4 — Wire Data Security
```bash
# Full account numbers must never be stored
grep -rn "account_number\b" \
  app/api/ lib/ --include="*.ts" --include="*.tsx"
# Any result referencing a full account_number field (not account_last4) = FIX
```

### Step 5 — Dual Role Check
```bash
grep -rn "dualRoleCheck\|dual_role" \
  app/api/leads/ lib/compliance/ --include="*.ts"
# Must exist in both an API route and the compliance lib
```

### Step 6 — QR Redirect Route
```bash
find app/q -name "*.tsx" -o -name "*.ts" | head
# Must include: app/q/[short_code]/route.ts (redirect handler)
```

### Step 7 — No SSN/DOB
```bash
grep -rn "ssn\|\.dob\|date_of_birth\|social_security" \
  app/api/ lib/ --include="*.ts" --include="*.tsx"
# Zero results
```

### Step 8 — Build
```bash
npm run build
# Zero errors
```

---

## COMPLETION REPORT

```
═══════════════════════════════════════════════════════════════════
ASHLEY IQ — UNDERWRITING SUITE & CD BALANCER BUILD COMPLETE
═══════════════════════════════════════════════════════════════════

PHASE 24 — FULL UNDERWRITING SUITE
  Schema (14 tables):    [ ] uw_files  [ ] uw_decisions  [ ] dti_worksheets
                         [ ] se_income_worksheets  [ ] asset_worksheets  [ ] asset_accounts
                         [ ] credit_analyses  [ ] credit_tradelines
                         [ ] hoa_certifications  [ ] uw_messages  [ ] adverse_actions
                         [ ] fair_lending_flags  [ ] dual_role_checks  [ ] uw_timeline_benchmarks

  DTI Worksheet:          [ ] Live calc  [ ] QM/ATR badges  [ ] Omit-from-DTI toggle
  SE Income Suite:        [ ] 1084/1088  [ ] Bank stmt  [ ] Asset depletion  [ ] 1099/K-1
                          [ ] AI analysis (Claude Sonnet)
  Non-QM Engine:          [ ] Bank stmt  [ ] Asset depletion  [ ] DSCR  [ ] 1099
  Asset & Reserves:       [ ] Account table  [ ] Eligible calc  [ ] Reserve req check
  Credit Analysis:        [ ] Tradeline table  [ ] AI-drafted LOEs  [ ] Score improvement panel
  HOA Tracker:            [ ] Review logic  [ ] Warrantability check
  AUS Integration:        [ ] DU/LP parse  [ ] Conditions import
  Risk Score:             [ ] Gauge UI  [ ] 6-factor model  [ ] AI narrative
  Condition Waterfall:    [ ] PTD/PTC/PTF columns  [ ] AI condition suggestions
  UW Memo:                [ ] Claude Sonnet generation  [ ] PDF via Puppeteer
  Predictive Suspense:    [ ] Outcome prediction  [ ] Preemptive actions
  UW Timeline:            [ ] Business days calc  [ ] Benchmark comparison
  Adverse Action:         [ ] AI-drafted notice  [ ] 30-day deadline tracker
  UW Messages:            [ ] Thread UI  [ ] AI summary
  Fair Lending:           [ ] Background flags  [ ] Branch manager panel
  Borrower Portal:        [ ] UW status card  [ ] Stage-appropriate messaging
  Dual Role Check:        [ ] Name match  [ ] CredifyID RE license check  [ ] CLOSA cross-ref
                          [ ] Block (FHA/VA/USDA)  [ ] Warn (Conventional)

PHASE 25 — CD BALANCER
  Schema (6 tables):     [ ] loan_estimates  [ ] disclosure_fee_items  [ ] closing_disclosures
                         [ ] changed_circumstances  [ ] verified_wire_instructions
                         [ ] post_close_audits

  LE Version Manager:    [ ] Version history  [ ] Revised LE flow  [ ] CC required on revision
  Tolerance Engine:      [ ] 0% check  [ ] 10% aggregate check  [ ] Auto-runs on CD save
  CD Balancer UI:        [ ] Side-by-side fee table  [ ] Tolerance summary panel
  CC Engine:             [ ] Circumstance type selection  [ ] AI-drafted narrative
                         [ ] Blocking warning if no CC on 0%/10% increase
  Settlement Import:     [ ] Structured paste + Claude parse  [ ] MISMO XML upload
  Wire Safety:           [ ] Verified instructions DB  [ ] Match/mismatch detection
                         [ ] Hard gate: CD cannot be final without wire verification
  Cure Calculator:       [ ] Cure amount calc  [ ] Deadline tracker  [ ] Relay alerts
  Cash-to-Close:         [ ] Balance verification  [ ] Penny tolerance  [ ] Discrepancy flag
  Business Day Calc:     [ ] Federal holidays  [ ] 3-day TRID rule  [ ] Deadline calculations
  Prepaid Interest:      [ ] Per-diem calc  [ ] First payment date picker
  Post-Close Audit:      [ ] PDF export  [ ] MISMO 3.4 XML  [ ] JSON
  QC Scorecard:          [ ] Per-LO metrics  [ ] Branch comparison  [ ] 6-month trends
  Borrower Portal:       [ ] CD ready card  [ ] Simplified fee comparison  [ ] AI explanation
                         [ ] 3-day countdown

PHASE 26 — QR CODE MARKETING
  Schema (2 tables):     [ ] qr_codes  [ ] qr_scans
  QR Generation:         [ ] qrcode package  [ ] Navy on white  [ ] SVG + PNG
  Redirect Route:        [ ] /q/[short_code]  [ ] Scan tracking  [ ] Lead attribution
  Social Media:          [ ] QR toggle on posts  [ ] Composited onto image  [ ] UTM auto-fill
  Co-Marketing:          [ ] Per-partner QR  [ ] Flyer templates  [ ] Partner attribution
  Dashboard:             [ ] Scan + lead counts  [ ] Conversion rate  [ ] Timeline

VERIFICATION
  [ ] No frozen files modified
  [ ] No Apple blue
  [ ] TypeScript: zero errors
  [ ] All 22 tables confirmed in schema
  [ ] uw_decisions / adverse_actions / post_close_audits: INSERT-only verified
  [ ] No full account numbers stored
  [ ] Dual role check exists in compliance lib and API route
  [ ] QR redirect route exists
  [ ] No SSN/DOB in any new file
  [ ] npm run build: zero errors

Issues encountered and resolved:
  1. [describe any issue and fix]

Ready for QA: YES / NO
═══════════════════════════════════════════════════════════════════
```
