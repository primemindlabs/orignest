# AshleyIQ — Consumer Credit Repair Module
## Claude Code Build Prompt · Sprint 3

---

## CONTEXT — READ THIS FIRST

You are building inside `products/conduit-next` — the AshleyIQ mortgage LO CRM.

**What already exists:**
- Borrower portal at `app/(borrower)/status/[token]/` — `BorrowerPortalClient.tsx` renders the borrower-facing portal (loan pipeline, document uploads, LO contact). Token comes from `borrower_portal_tokens` table.
- LO credit repair pipeline at `app/(dashboard)/credit-repair/` — LO-facing dashboard using existing `credit_repair_pipeline` table (starting_score, current_score, ai_action_plan, etc.)
- Supabase with RLS on all tables, `org_id` multi-tenancy
- Clerk auth (LO side), token auth (borrower portal — no Clerk)
- Stripe for LO subscription billing already wired
- Claude Haiku `claude-haiku-4-5-20251001` via Anthropic SDK
- Lob SDK not yet installed
- Stripe consumer billing not yet wired
- `borrower_portal_tokens` has `lead_id` and `org_id` — use this for all borrower-side queries

**What you are building:**
A consumer-facing DIY credit repair experience embedded as a new tab inside the existing borrower portal, plus LO-side tracking enhancements. AshleyIQ collects via Stripe. LO receives milestone notifications and gets their lead back when the borrower hits their target score.

**Billing model:**
- **First payment:** $19.99/month subscription + $9.99 one-time credit pull fee — charged together in a single Stripe Checkout session
- **Ongoing:** $19.99/month only — the pull fee is a one-time add-on on the first invoice only
- In Stripe: use a single Checkout session with two `line_items` — the recurring subscription Price and a one-time Price for the pull fee
- The "Pull My Credit" button is gated behind `subscription_status = 'active'` — pull only unlocks after payment clears
- After the first pull succeeds, the pull fee never appears again

**Credit pull method: Soft Pull Solutions API only.** There is NO PDF upload path. The borrower clicks "Pull My Credit Report" → AshleyIQ calls the Soft Pull Solutions API → returns tri-merge data → Claude analyzes it. A soft pull does not affect the borrower's credit score. Soft Pull Solutions requires a 2–3 week vendor approval process before going live — include a placeholder integration layer so the UI and data flow are complete and the API key can be dropped in when approved.

---

## EXECUTION ORDER — FOLLOW EXACTLY

1. Install packages
2. Run database migration
3. Build API routes (no UI yet)
4. Build borrower portal credit repair tab
5. Build LO dashboard enhancements
6. Wire Stripe consumer billing
7. Wire Lob mail sending
8. Wire Claude AI parsing + letter generation
9. Verification checklist

---

## STEP 1 — INSTALL PACKAGES

```bash
npm install lob-node @anthropic-ai/sdk axios
```

- `lob-node` — certified physical mail
- `@anthropic-ai/sdk` — may already be installed; check `package.json` first
- `axios` — for Soft Pull Solutions API calls (uses REST, no official Node SDK)

---

## STEP 2 — DATABASE MIGRATION

Create `supabase/migrations/003_credit_repair_consumer.sql`:

```sql
-- ============================================================
-- CONSUMER CREDIT REPAIR MODULE
-- ============================================================

-- Enrollments: one per borrower who activates credit repair
CREATE TABLE IF NOT EXISTS credit_repair_enrollments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id                UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- Stripe consumer subscription
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  subscription_status    TEXT NOT NULL DEFAULT 'trial'
                         CHECK (subscription_status IN ('trial','active','past_due','canceled','paused')),
  trial_ends_at          TIMESTAMPTZ,
  billing_started_at     TIMESTAMPTZ,

  -- CROA compliance
  croa_disclosure_signed_at  TIMESTAMPTZ,
  croa_disclosure_ip         TEXT,
  croa_contract_text         TEXT,  -- snapshot of disclosure at time of signing

  -- Credit scores
  starting_score_exp     INT,
  starting_score_eqx     INT,
  starting_score_tu      INT,
  current_score_exp      INT,
  current_score_eqx      INT,
  current_score_tu       INT,
  target_score           INT NOT NULL DEFAULT 640,
  score_history          JSONB DEFAULT '[]',  -- [{date, exp, eqx, tu}]

  -- Status
  status                 TEXT NOT NULL DEFAULT 'pending_upload'
                         CHECK (status IN ('pending_upload','analyzing','active','mortgage_ready','closed','canceled')),
  mortgage_ready_at      TIMESTAMPTZ,
  closed_at              TIMESTAMPTZ,
  cancel_reason          TEXT,

  -- LO notification preferences (inherits from org defaults if null)
  notify_score_milestone BOOLEAN DEFAULT true,
  notify_item_removed    BOOLEAN DEFAULT true,
  notify_dispute_sent    BOOLEAN DEFAULT true,
  notify_bureau_response BOOLEAN DEFAULT true,
  notify_mortgage_ready  BOOLEAN DEFAULT true,
  notify_sms             BOOLEAN DEFAULT false,

  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

-- Credit report uploads (one per bureau pull cycle)
CREATE TABLE IF NOT EXISTS credit_report_uploads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id     UUID NOT NULL REFERENCES credit_repair_enrollments(id) ON DELETE CASCADE,
  org_id            UUID NOT NULL,
  lead_id           UUID NOT NULL,

  -- Storage
  storage_path      TEXT NOT NULL,  -- Supabase Storage path
  source_bureau     TEXT NOT NULL CHECK (source_bureau IN ('experian','equifax','transunion','tri_merge','unknown')),
  report_date       DATE,
  cycle_number      INT NOT NULL DEFAULT 1,  -- 1 = initial, 2 = after first round, etc.

  -- Parse status
  parse_status      TEXT NOT NULL DEFAULT 'pending'
                    CHECK (parse_status IN ('pending','parsing','parsed','failed')),
  parse_error       TEXT,

  -- Parsed scores
  score_exp         INT,
  score_eqx         INT,
  score_tu          INT,

  -- Raw AI analysis output
  ai_analysis       JSONB,  -- full structured analysis from Claude

  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Individual tradelines extracted from credit report
CREATE TABLE IF NOT EXISTS credit_tradelines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id     UUID NOT NULL REFERENCES credit_repair_enrollments(id) ON DELETE CASCADE,
  report_upload_id  UUID NOT NULL REFERENCES credit_report_uploads(id) ON DELETE CASCADE,
  org_id            UUID NOT NULL,

  -- Tradeline data
  creditor_name     TEXT NOT NULL,
  account_number    TEXT,  -- last 4 only
  account_type      TEXT,  -- credit_card, auto_loan, collection, medical, etc.
  bureau            TEXT NOT NULL CHECK (bureau IN ('experian','equifax','transunion','all_three')),
  balance           NUMERIC,
  credit_limit      NUMERIC,
  open_date         DATE,
  close_date        DATE,
  status            TEXT,  -- open, closed, charged_off, in_collections
  payment_status    TEXT,  -- current, 30_days_late, 60_days_late, etc.
  negative_remarks  TEXT[],

  -- Dispute targeting
  is_disputable     BOOLEAN NOT NULL DEFAULT false,
  dispute_reason    TEXT,  -- AI-generated reason
  dispute_priority  INT DEFAULT 5,  -- 1 = highest mortgage impact, 10 = lowest
  estimated_score_gain INT,
  dispute_status    TEXT NOT NULL DEFAULT 'identified'
                    CHECK (dispute_status IN ('identified','queued','letter_sent','verified','removed','updated','not_disputing')),

  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Dispute letters (one per tradeline per cycle)
CREATE TABLE IF NOT EXISTS credit_disputes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id     UUID NOT NULL REFERENCES credit_repair_enrollments(id) ON DELETE CASCADE,
  tradeline_id      UUID NOT NULL REFERENCES credit_tradelines(id) ON DELETE CASCADE,
  org_id            UUID NOT NULL,

  bureau            TEXT NOT NULL CHECK (bureau IN ('experian','equifax','transunion')),
  cycle_number      INT NOT NULL DEFAULT 1,
  letter_type       TEXT NOT NULL DEFAULT 'initial'
                    CHECK (letter_type IN ('initial','re_dispute','method_of_verification','cfpb_complaint','goodwill','pay_for_delete')),
  letter_body       TEXT NOT NULL,  -- full letter text
  borrower_name     TEXT NOT NULL,
  borrower_address  TEXT NOT NULL,
  bureau_address    TEXT NOT NULL,

  -- Lob integration
  lob_letter_id     TEXT,
  lob_status        TEXT,  -- mailed, in_transit, delivered, failed
  sent_at           TIMESTAMPTZ,
  expected_response_by TIMESTAMPTZ,  -- sent_at + 37 days (30 day window + 7 mail)

  -- Response tracking
  response_status   TEXT NOT NULL DEFAULT 'pending'
                    CHECK (response_status IN ('pending','awaiting_response','item_removed','item_updated','verified_accurate','no_response')),
  borrower_outcome  TEXT,  -- what borrower reported
  response_upload_path TEXT,  -- if borrower uploaded bureau response letter
  response_logged_at TIMESTAMPTZ,
  ai_next_action    TEXT,  -- AI recommendation after bureau responds
  auto_next_letter_id UUID REFERENCES credit_disputes(id),

  approved_by_borrower_at TIMESTAMPTZ,  -- null until borrower taps "Send"

  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- LO notification log (append-only)
CREATE TABLE IF NOT EXISTS credit_repair_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  enrollment_id   UUID NOT NULL REFERENCES credit_repair_enrollments(id) ON DELETE CASCADE,
  lead_id         UUID NOT NULL,
  type            TEXT NOT NULL,
  -- 'score_milestone','item_removed','dispute_sent','bureau_response','mortgage_ready','cycle_complete'
  payload         JSONB,
  sent_via        TEXT[],  -- ['email','in_app','sms']
  sent_at         TIMESTAMPTZ DEFAULT now()
);

-- Score milestone thresholds (org-configurable; defaults seeded by trigger)
CREATE TABLE IF NOT EXISTS credit_repair_org_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  notify_score_milestones INT[] DEFAULT '{580,620,640,680,720}',
  notify_on_item_removed BOOLEAN DEFAULT true,
  notify_on_dispute_sent BOOLEAN DEFAULT false,
  notify_on_bureau_response BOOLEAN DEFAULT true,
  notify_sms_default     BOOLEAN DEFAULT false,
  lo_email_override      TEXT,  -- if null, use profile email
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────────

ALTER TABLE credit_repair_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_report_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_tradelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_repair_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_repair_org_settings ENABLE ROW LEVEL SECURITY;

-- LO side: org-scoped
CREATE POLICY "org_members_enrollments" ON credit_repair_enrollments
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));

CREATE POLICY "org_members_tradelines" ON credit_tradelines
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));

CREATE POLICY "org_members_disputes" ON credit_disputes
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));

CREATE POLICY "org_members_settings" ON credit_repair_org_settings
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));

-- Notifications: INSERT-only for service role (audit trail)
CREATE POLICY "insert_only_notifications" ON credit_repair_notifications
  FOR INSERT WITH CHECK (true);
CREATE POLICY "read_org_notifications" ON credit_repair_notifications
  FOR SELECT USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));

-- Borrower portal: service role only (no Clerk session)
-- All borrower-portal API routes use createAdminClient() to bypass RLS

-- ── INDEXES ──────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_enrollments_lead ON credit_repair_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_org ON credit_repair_enrollments(org_id);
CREATE INDEX IF NOT EXISTS idx_tradelines_enrollment ON credit_tradelines(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_disputes_enrollment ON credit_disputes(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_disputes_response ON credit_disputes(response_status) WHERE response_status = 'awaiting_response';

-- ── UPDATED_AT TRIGGER ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_enrollments_updated_at BEFORE UPDATE ON credit_repair_enrollments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_disputes_updated_at BEFORE UPDATE ON credit_disputes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## STEP 3 — ENVIRONMENT VARIABLES

Add to `.env.local` and document in `.env.example`:

```bash
# Lob — certified physical mail
LOB_API_KEY=live_...           # use test_... for dev

# Stripe consumer billing
STRIPE_CREDIT_REPAIR_PRICE_ID=price_...        # $19.99/month recurring Price ID
STRIPE_CREDIT_PULL_PRICE_ID=price_...          # $9.99 one-time credit pull fee Price ID
# STRIPE_SECRET_KEY already exists

# Anthropic — already exists, confirm it is set
ANTHROPIC_API_KEY=sk-ant-...

# Soft Pull Solutions — primary credit pull provider
# Requires vendor approval (2–3 week process) before production use
# Set to "mock" to enable mock mode during development
SOFT_PULL_API_KEY=mock
SOFT_PULL_API_URL=https://api.softpullsolutions.com/v1
SOFT_PULL_SUBSCRIBER_ID=placeholder   # assigned by SPS during onboarding
```

---

## STEP 4 — API ROUTES

Create the following API routes. Use `createAdminClient()` for all borrower-portal routes (no Clerk session). Use `createClient()` + auth check for all LO dashboard routes.

### 4a. `app/api/credit-repair/enroll/route.ts`
**LO triggers this to enroll a borrower.**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { leadId, targetScore = 640 } = await req.json();
  if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

  const sb = createClient();
  const sbAdmin = createAdminClient();

  // Resolve org
  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).single();
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

  // Get lead for Stripe customer creation
  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name, email')
    .eq('id', leadId)
    .eq('org_id', org.id)
    .single();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  // Idempotent — return existing enrollment if already enrolled
  const { data: existing } = await sbAdmin
    .from('credit_repair_enrollments')
    .select('id, status, stripe_subscription_id')
    .eq('lead_id', leadId)
    .eq('org_id', org.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ enrollmentId: existing.id, alreadyEnrolled: true });

  // Create Stripe customer for borrower
  const customer = await stripe.customers.create({
    email: lead.email ?? undefined,
    name: `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim(),
    metadata: { lead_id: leadId, org_id: org.id },
  });

  // Create enrollment record
  const { data: enrollment, error } = await sbAdmin
    .from('credit_repair_enrollments')
    .insert({
      org_id: org.id,
      lead_id: leadId,
      target_score: targetScore,
      stripe_customer_id: customer.id,
      subscription_status: 'trial',
      trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      status: 'pending_upload',
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Seed org notification settings if not already set
  await sbAdmin.from('credit_repair_org_settings').upsert(
    { org_id: org.id },
    { onConflict: 'org_id', ignoreDuplicates: true }
  );

  return NextResponse.json({ enrollmentId: enrollment.id });
}
```

### 4b. `app/api/borrower-portal/[token]/credit-repair/status/route.ts`
**Borrower fetches their enrollment status.**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const sb = createAdminClient();

  const { data: pt } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id')
    .eq('token', params.token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });

  const { data: enrollment } = await sb
    .from('credit_repair_enrollments')
    .select(`
      id, status, subscription_status, target_score, trial_ends_at,
      starting_score_exp, starting_score_eqx, starting_score_tu,
      current_score_exp, current_score_eqx, current_score_tu,
      score_history, croa_disclosure_signed_at, created_at
    `)
    .eq('lead_id', pt.lead_id)
    .eq('org_id', pt.org_id)
    .maybeSingle();

  if (!enrollment) return NextResponse.json({ enrolled: false });

  // Active disputes
  const { data: disputes } = await sb
    .from('credit_disputes')
    .select('id, bureau, letter_type, cycle_number, response_status, sent_at, expected_response_by, lob_status')
    .eq('enrollment_id', enrollment.id)
    .order('created_at', { ascending: false });

  // Tradelines
  const { data: tradelines } = await sb
    .from('credit_tradelines')
    .select('id, creditor_name, bureau, dispute_status, dispute_priority, estimated_score_gain, is_disputable, dispute_reason, account_type, payment_status')
    .eq('enrollment_id', enrollment.id)
    .order('dispute_priority');

  return NextResponse.json({ enrolled: true, enrollment, disputes: disputes ?? [], tradelines: tradelines ?? [] });
}
```

### 4c. `app/api/borrower-portal/[token]/credit-repair/sign-croa/route.ts`
**CROA disclosure e-sign — required before billing starts.**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const CROA_DISCLOSURE = `CONSUMER CREDIT REPAIR ORGANIZATIONS ACT DISCLOSURE

You have a right to dispute inaccurate information in your credit report by contacting the credit bureau directly. There is no fee charged by credit bureaus for such disputes.

AshleyIQ is a credit services organization. Before paying any money, you have the right to:
1. Review a copy of your rights under the Credit Repair Organizations Act (15 U.S.C. §1679 et seq.)
2. Cancel this contract within 3 business days without charge
3. Receive a complete description of services to be performed

AshleyIQ will: (a) review your credit report for inaccurate, incomplete, or unverifiable items, (b) prepare and send dispute letters to the three major credit bureaus on your behalf, (c) track bureau responses and generate follow-up correspondence, and (d) provide you with progress updates throughout the credit repair process.

AshleyIQ will not: (a) advise you to dispute accurate information, (b) make any guarantee regarding credit score improvement, (c) charge you before services are rendered.

Monthly fee: $19.99 billed after your free trial period. You may cancel at any time.

By signing below, you acknowledge receipt of this disclosure and agree to the terms of service.`;

export async function POST(req: NextRequest) {
  const sb = createAdminClient();
  const body = await req.json();
  const { token, enrollmentId } = body;

  const { data: pt } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id')
    .eq('token', token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: 'Invalid token' }, { status: 403 });

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';

  const { error } = await sb
    .from('credit_repair_enrollments')
    .update({
      croa_disclosure_signed_at: new Date().toISOString(),
      croa_disclosure_ip: ip,
      croa_contract_text: CROA_DISCLOSURE,
    })
    .eq('id', enrollmentId)
    .eq('lead_id', pt.lead_id)
    .eq('org_id', pt.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ signed: true });
}
```

### 4d. `app/api/borrower-portal/[token]/credit-repair/pull-credit/route.ts`
**Borrower requests a soft pull. Calls Soft Pull Solutions API. Claude analyzes structured data.**

This is the ONLY credit pull method — no PDF upload. Soft pull does not affect the borrower's credit score.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic();

// ── Soft Pull Solutions integration ──────────────────────────────
// Docs: https://www.softpullsolutions.com/api-documentation
// Requires vendor approval before production use.
// Set SOFT_PULL_API_KEY=mock for development — returns realistic fake data.

interface SoftPullTradeline {
  SubscriberName: string;
  AccountNumber: string;
  AccountType: string;
  Bureau: string;  // 'Experian' | 'Equifax' | 'TransUnion'
  Balance: number;
  CreditLimit: number;
  OpenDate: string;
  CloseDate: string;
  AccountStatus: string;
  PaymentStatus: string;
  Remarks: string[];
}

interface SoftPullResponse {
  Scores: { Experian?: number; Equifax?: number; TransUnion?: number };
  ReportDate: string;
  Tradelines: SoftPullTradeline[];
  HardInquiries: Array<{ SubscriberName: string; Date: string; Bureau: string }>;
  PublicRecords: Array<{ Type: string; Date: string; Bureau: string }>;
  ErrorCode?: string;
  ErrorMessage?: string;
}

async function callSoftPullSolutions(borrowerInfo: {
  firstName: string; lastName: string;
  ssn: string; dob: string;
  addressLine1: string; city: string; state: string; zip: string;
}): Promise<SoftPullResponse> {
  const isMock = process.env.SOFT_PULL_API_KEY === 'mock' || process.env.SOFT_PULL_API_KEY === 'placeholder';

  if (isMock) {
    // Realistic mock for development — replace with real API call when approved
    return {
      Scores: { Experian: 598, Equifax: 602, TransUnion: 594 },
      ReportDate: new Date().toISOString().split('T')[0],
      Tradelines: [
        { SubscriberName: 'CAPITAL ONE', AccountNumber: '****1234', AccountType: 'CREDIT_CARD', Bureau: 'Experian', Balance: 2800, CreditLimit: 3000, OpenDate: '2019-03-15', CloseDate: '', AccountStatus: 'Open', PaymentStatus: '60_days_late', Remarks: ['Late payment 60 days'] },
        { SubscriberName: 'PORTFOLIO RECOVERY', AccountNumber: '****5678', AccountType: 'COLLECTION', Bureau: 'Equifax', Balance: 1450, CreditLimit: 0, OpenDate: '2021-08-01', CloseDate: '', AccountStatus: 'Open', PaymentStatus: 'collection', Remarks: ['In collections', 'Original creditor: Sprint'] },
        { SubscriberName: 'CHASE BANK', AccountNumber: '****9012', AccountType: 'AUTO_LOAN', Bureau: 'TransUnion', Balance: 12500, CreditLimit: 18000, OpenDate: '2020-06-20', CloseDate: '', AccountStatus: 'Open', PaymentStatus: 'current', Remarks: [] },
      ],
      HardInquiries: [
        { SubscriberName: 'BEST BUY CREDIT', Date: '2023-11-10', Bureau: 'Experian' },
      ],
      PublicRecords: [],
    };
  }

  // Real Soft Pull Solutions API call
  // TODO: confirm exact endpoint and payload shape with SPS documentation during onboarding
  const response = await axios.post(
    `${process.env.SOFT_PULL_API_URL}/trimerge`,
    {
      SubscriberId: process.env.SOFT_PULL_SUBSCRIBER_ID,
      FirstName: borrowerInfo.firstName,
      LastName: borrowerInfo.lastName,
      SSN: borrowerInfo.ssn,
      DOB: borrowerInfo.dob,
      Address: borrowerInfo.addressLine1,
      City: borrowerInfo.city,
      State: borrowerInfo.state,
      Zip: borrowerInfo.zip,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.SOFT_PULL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );
  return response.data as SoftPullResponse;
}

const ANALYZE_PROMPT = `You are an expert credit analyst and mortgage advisor. Analyze this structured credit report data and identify all disputable items.

Credit report data: {REPORT_DATA}

Return a JSON object:
{
  "tradelines": [
    {
      "creditor_name": string,
      "account_number_last4": string | null,
      "account_type": "credit_card" | "auto_loan" | "mortgage" | "collection" | "medical" | "student_loan" | "personal_loan" | "other",
      "bureau": "experian" | "equifax" | "transunion" | "all_three",
      "balance": number | null,
      "credit_limit": number | null,
      "open_date": "YYYY-MM-DD" | null,
      "close_date": "YYYY-MM-DD" | null,
      "status": "open" | "closed" | "charged_off" | "in_collections" | "settled",
      "payment_status": "current" | "30_days_late" | "60_days_late" | "90_days_late" | "120_plus_days_late" | "charge_off" | "collection",
      "negative_remarks": string[],
      "is_disputable": boolean,
      "dispute_reason": string | null,
      "estimated_score_gain": number | null,
      "dispute_priority": number
    }
  ],
  "summary": {
    "total_negative_items": number,
    "disputable_items": number,
    "estimated_total_score_gain": number,
    "mortgage_blocking_items": string[],
    "priority_actions": string[]
  }
}

Rules:
- dispute_priority: 1 = highest mortgage impact (recent collections, charge-offs), 10 = lowest
- estimated_score_gain: be conservative (10–50 points per item)
- is_disputable: true for inaccurate, unverifiable, or outdated (7-year) items only
- Do NOT flag accurate, current negative items as disputable
Return only valid JSON, no markdown.`;

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const sb = createAdminClient();

  const { data: pt } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id')
    .eq('token', params.token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: 'Invalid token' }, { status: 403 });

  const { data: enrollment } = await sb
    .from('credit_repair_enrollments')
    .select('id, croa_disclosure_signed_at, subscription_status')
    .eq('lead_id', pt.lead_id)
    .eq('org_id', pt.org_id)
    .maybeSingle();
  if (!enrollment) return NextResponse.json({ error: 'Not enrolled' }, { status: 404 });
  if (!enrollment.croa_disclosure_signed_at) return NextResponse.json({ error: 'CROA disclosure not signed' }, { status: 403 });
  if (enrollment.subscription_status !== 'active') {
    // 402 = payment required — UI should redirect to subscribe flow
    return NextResponse.json({ error: 'Active subscription required to pull credit report', code: 'subscription_required' }, { status: 402 });
  }

  const body = await req.json() as {
    firstName: string; lastName: string;
    ssn: string; dob: string;
    addressLine1: string; city: string; state: string; zip: string;
  };

  // Update status to analyzing
  await sb.from('credit_repair_enrollments').update({ status: 'analyzing' }).eq('id', enrollment.id);

  // Create upload record (source = soft_pull)
  const { data: uploadRecord } = await sb
    .from('credit_report_uploads')
    .insert({
      enrollment_id: enrollment.id,
      org_id: pt.org_id,
      lead_id: pt.lead_id,
      storage_path: `soft-pull/${enrollment.id}/${Date.now()}`,
      source_bureau: 'tri_merge',
      cycle_number: 1,
      parse_status: 'parsing',
    })
    .select('id')
    .single();

  // Call Soft Pull Solutions
  let spsData: SoftPullResponse;
  try {
    spsData = await callSoftPullSolutions(body);
    if (spsData.ErrorCode) {
      await sb.from('credit_report_uploads').update({ parse_status: 'failed', parse_error: spsData.ErrorMessage }).eq('id', uploadRecord!.id);
      return NextResponse.json({ error: spsData.ErrorMessage ?? 'Credit pull failed' }, { status: 400 });
    }
  } catch (err) {
    await sb.from('credit_report_uploads').update({ parse_status: 'failed', parse_error: String(err) }).eq('id', uploadRecord!.id);
    return NextResponse.json({ error: 'Credit pull service unavailable' }, { status: 503 });
  }

  // Analyze with Claude
  let analysis: { tradelines: Record<string, unknown>[]; summary: Record<string, unknown> };
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: ANALYZE_PROMPT.replace('{REPORT_DATA}', JSON.stringify(spsData.Tradelines)),
      }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    analysis = JSON.parse(text) as typeof analysis;
  } catch (err) {
    await sb.from('credit_report_uploads').update({ parse_status: 'failed', parse_error: String(err) }).eq('id', uploadRecord!.id);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }

  // Persist scores + analysis
  const scores = spsData.Scores;
  await sb.from('credit_report_uploads').update({
    parse_status: 'parsed',
    score_exp: scores.Experian ?? null,
    score_eqx: scores.Equifax ?? null,
    score_tu: scores.TransUnion ?? null,
    ai_analysis: analysis,
  }).eq('id', uploadRecord!.id);

  const avgScore = Math.round(
    [scores.Experian, scores.Equifax, scores.TransUnion].filter(Boolean).reduce((a, b) => a + (b ?? 0), 0) /
    [scores.Experian, scores.Equifax, scores.TransUnion].filter(Boolean).length
  );

  await sb.from('credit_repair_enrollments').update({
    starting_score_exp: scores.Experian ?? null,
    starting_score_eqx: scores.Equifax ?? null,
    starting_score_tu: scores.TransUnion ?? null,
    current_score_exp: scores.Experian ?? null,
    current_score_eqx: scores.Equifax ?? null,
    current_score_tu: scores.TransUnion ?? null,
    score_history: JSON.stringify([{
      date: new Date().toISOString().split('T')[0],
      exp: scores.Experian, eqx: scores.Equifax, tu: scores.TransUnion, avg: avgScore,
      source: 'soft_pull',
    }]),
    status: 'active',
  }).eq('id', enrollment.id);

  // Insert tradelines
  if (analysis.tradelines?.length > 0) {
    await sb.from('credit_tradelines').insert(
      analysis.tradelines.map((t) => ({
        enrollment_id: enrollment.id,
        report_upload_id: uploadRecord!.id,
        org_id: pt.org_id,
        creditor_name: t.creditor_name,
        account_number: t.account_number_last4 ?? null,
        account_type: t.account_type,
        bureau: t.bureau,
        balance: t.balance ?? null,
        credit_limit: t.credit_limit ?? null,
        open_date: t.open_date ?? null,
        close_date: t.close_date ?? null,
        status: t.status,
        payment_status: t.payment_status,
        negative_remarks: t.negative_remarks ?? [],
        is_disputable: t.is_disputable,
        dispute_reason: t.dispute_reason ?? null,
        dispute_priority: t.dispute_priority ?? 5,
        estimated_score_gain: t.estimated_score_gain ?? null,
        dispute_status: 'identified',
      }))
    );
  }

  return NextResponse.json({ success: true, uploadId: uploadRecord!.id, summary: analysis.summary, scores: spsData.Scores });
}
```

**Security note:** The borrower's SSN and DOB are sent in the POST body over HTTPS and passed directly to Soft Pull Solutions. They are NEVER stored in Supabase — not in any table, not in logs. The API route must not log `body` contents. Add an explicit comment in the route: `// PII: SSN and DOB are passed to SPS API only — never persisted to DB`.

### 4e. `app/api/borrower-portal/[token]/credit-repair/generate-letters/route.ts`
**AI generates FCRA dispute letters for all disputable tradelines.**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic();

// Bureau mailing addresses
const BUREAU_ADDRESSES: Record<string, { name: string; address: string }> = {
  experian: { name: 'Experian Information Solutions', address: 'P.O. Box 4500\nAllen, TX 75013' },
  equifax: { name: 'Equifax Information Services LLC', address: 'P.O. Box 740256\nAtlanta, GA 30374' },
  transunion: { name: 'TransUnion LLC Consumer Dispute Center', address: 'P.O. Box 2000\nChester, PA 19016' },
};

async function generateDisputeLetter(params: {
  borrowerName: string;
  borrowerAddress: string;
  bureau: string;
  creditorName: string;
  accountNumber: string | null;
  disputeReason: string;
  letterType: string;
  cycleNumber: number;
  previousResponse?: string;
}): Promise<string> {
  const prompt = `Generate a professional, FCRA-compliant credit dispute letter. Letter type: ${params.letterType}. Cycle: ${params.cycleNumber}.
${params.previousResponse ? `Previous bureau response: ${params.previousResponse}` : ''}

Borrower: ${params.borrowerName}
Borrower address: ${params.borrowerAddress}
Bureau: ${params.bureau}
Creditor/Account: ${params.creditorName}${params.accountNumber ? ` (last 4: ${params.accountNumber})` : ''}
Dispute reason: ${params.disputeReason}

Write a complete, formal dispute letter following FCRA 15 U.S.C. §1681i requirements. Include:
- Date, borrower address, bureau address
- Clear statement this is a formal dispute under the FCRA
- Specific account information and nature of dispute
- Request for investigation and removal/correction
- Statement of rights if not resolved within 30 days
- ${params.letterType === 'method_of_verification' ? 'Demand for method of verification documentation under FCRA §1681i(a)(7)' : ''}
- ${params.letterType === 'cfpb_complaint' ? 'Notice of intent to file CFPB complaint if not resolved' : ''}
- Professional closing

Return only the letter text, no commentary.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const sb = createAdminClient();

  const { data: pt } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id')
    .eq('token', params.token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: 'Invalid token' }, { status: 403 });

  const body = await req.json() as { enrollmentId: string; borrowerName: string; borrowerAddress: string; tradelineIds?: string[] };

  const { data: enrollment } = await sb
    .from('credit_repair_enrollments')
    .select('id, croa_disclosure_signed_at')
    .eq('id', body.enrollmentId)
    .eq('lead_id', pt.lead_id)
    .single();
  if (!enrollment?.croa_disclosure_signed_at) return NextResponse.json({ error: 'CROA not signed' }, { status: 403 });

  // Get disputable tradelines (all or specified)
  let query = sb
    .from('credit_tradelines')
    .select('*')
    .eq('enrollment_id', body.enrollmentId)
    .eq('is_disputable', true)
    .in('dispute_status', ['identified', 'queued']);
  if (body.tradelineIds?.length) query = query.in('id', body.tradelineIds);
  const { data: tradelines } = await query.order('dispute_priority');

  if (!tradelines?.length) return NextResponse.json({ letters: [] });

  // Generate letters for each tradeline × each bureau
  const letters = [];
  for (const tl of tradelines) {
    const bureaus = tl.bureau === 'all_three'
      ? ['experian', 'equifax', 'transunion']
      : [tl.bureau];

    for (const bureau of bureaus) {
      const bureauInfo = BUREAU_ADDRESSES[bureau];
      if (!bureauInfo) continue;

      const letterBody = await generateDisputeLetter({
        borrowerName: body.borrowerName,
        borrowerAddress: body.borrowerAddress,
        bureau,
        creditorName: tl.creditor_name,
        accountNumber: tl.account_number ?? null,
        disputeReason: tl.dispute_reason ?? 'This account contains inaccurate information.',
        letterType: 'initial',
        cycleNumber: 1,
      });

      const { data: dispute } = await sb
        .from('credit_disputes')
        .insert({
          enrollment_id: body.enrollmentId,
          tradeline_id: tl.id,
          org_id: pt.org_id,
          bureau,
          cycle_number: 1,
          letter_type: 'initial',
          letter_body: letterBody,
          borrower_name: body.borrowerName,
          borrower_address: body.borrowerAddress,
          bureau_address: `${bureauInfo.name}\n${bureauInfo.address}`,
          response_status: 'pending',
        })
        .select('id')
        .single();

      // Mark tradeline as queued
      await sb.from('credit_tradelines').update({ dispute_status: 'queued' }).eq('id', tl.id);

      if (dispute) letters.push({ disputeId: dispute.id, bureau, creditor: tl.creditor_name, letterBody });
    }
  }

  return NextResponse.json({ letters, count: letters.length });
}
```

### 4f. `app/api/borrower-portal/[token]/credit-repair/send-disputes/route.ts`
**Borrower approves. Lob sends certified mail.**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Lob from 'lob-node';

export const dynamic = 'force-dynamic';

const lob = new Lob({ apiKey: process.env.LOB_API_KEY! });

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const sb = createAdminClient();

  const { data: pt } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id')
    .eq('token', params.token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: 'Invalid token' }, { status: 403 });

  const { disputeIds } = await req.json() as { disputeIds: string[] };

  const { data: disputes } = await sb
    .from('credit_disputes')
    .select('*, credit_repair_enrollments!inner(lead_id)')
    .in('id', disputeIds)
    .eq('org_id', pt.org_id)
    .is('sent_at', null);

  if (!disputes?.length) return NextResponse.json({ error: 'No pending disputes found' }, { status: 404 });

  const results = [];
  for (const dispute of disputes) {
    try {
      // Parse borrower address
      const addrLines = dispute.borrower_address.split('\n');
      const cityStateZip = (addrLines[1] ?? '').split(',');

      // Parse bureau address
      const bureauLines = dispute.bureau_address.split('\n');
      const bureauCityStateZip = (bureauLines[1] ?? '').split(',');

      const letter = await lob.letters.create({
        description: `Credit Dispute — ${dispute.bureau} — ${dispute.creditor_name ?? 'Account'}`,
        to: {
          name: bureauLines[0] ?? 'Credit Bureau',
          address_line1: bureauLines[1] ?? bureauLines[0],
          address_city: bureauCityStateZip[0]?.trim() ?? '',
          address_state: (bureauCityStateZip[1] ?? '').trim().split(' ')[0] ?? '',
          address_zip: (bureauCityStateZip[1] ?? '').trim().split(' ')[1] ?? '',
        },
        from: {
          name: dispute.borrower_name,
          address_line1: addrLines[0] ?? '',
          address_city: cityStateZip[0]?.trim() ?? '',
          address_state: (cityStateZip[1] ?? '').trim().split(' ')[0] ?? '',
          address_zip: (cityStateZip[1] ?? '').trim().split(' ')[1] ?? '',
        },
        file: `<html><body><p style="font-family:Arial;font-size:11pt;white-space:pre-wrap;">${dispute.letter_body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p></body></html>`,
        color: false,
        double_sided: false,
        address_placement: 'insert_blank_page',
        extra_service: 'certified',  // USPS Certified Mail
      });

      const sentAt = new Date();
      await sb.from('credit_disputes').update({
        lob_letter_id: letter.id,
        lob_status: letter.expected_delivery_date ? 'mailed' : 'processing',
        sent_at: sentAt.toISOString(),
        approved_by_borrower_at: sentAt.toISOString(),
        expected_response_by: new Date(sentAt.getTime() + 37 * 24 * 60 * 60 * 1000).toISOString(), // 30 days + 7 mail
        response_status: 'awaiting_response',
      }).eq('id', dispute.id);

      await sb.from('credit_tradelines').update({ dispute_status: 'letter_sent' }).eq('id', dispute.tradeline_id);

      results.push({ disputeId: dispute.id, lobId: letter.id, status: 'sent' });
    } catch (err) {
      results.push({ disputeId: dispute.id, status: 'failed', error: String(err) });
    }
  }

  // Notify LO
  await notifyLO(sb, pt.org_id, disputes[0].enrollment_id, 'dispute_sent', { count: results.filter(r => r.status === 'sent').length });

  return NextResponse.json({ results });
}

async function notifyLO(sb: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>, orgId: string, enrollmentId: string, type: string, payload: Record<string, unknown>) {
  await sb.from('credit_repair_notifications').insert({ org_id: orgId, enrollment_id: enrollmentId, lead_id: '', type, payload, sent_via: ['in_app'] });
}
```

### 4g. `app/api/borrower-portal/[token]/credit-repair/log-outcome/route.ts`
**Borrower reports bureau response. AI generates next action.**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic();

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const sb = createAdminClient();

  const { data: pt } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id')
    .eq('token', params.token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: 'Invalid' }, { status: 403 });

  const { disputeId, outcome, enrollmentId } = await req.json() as {
    disputeId: string;
    outcome: 'item_removed' | 'item_updated' | 'verified_accurate' | 'no_response';
    enrollmentId: string;
  };

  const { data: dispute } = await sb
    .from('credit_disputes')
    .select('*, credit_tradelines(*)')
    .eq('id', disputeId)
    .eq('org_id', pt.org_id)
    .single();
  if (!dispute) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Determine next action with Claude
  let nextAction = '';
  let autoGenerateFollowUp = false;

  if (outcome === 'verified_accurate') {
    const nextLetterType = dispute.cycle_number === 1 ? 'method_of_verification' : 'cfpb_complaint';
    autoGenerateFollowUp = true;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `A credit bureau responded "verified" to a dispute for: ${dispute.credit_tradelines?.creditor_name ?? 'unknown account'}. This is cycle ${dispute.cycle_number}. Suggest the best next action in 2 sentences. Next letter type will be: ${nextLetterType}.`,
      }],
    });
    nextAction = response.content[0].type === 'text' ? response.content[0].text : '';
  } else if (outcome === 'item_removed') {
    nextAction = 'Great news — this item was removed! Your credit score should improve within 30-45 days.';

    // Update tradeline
    await sb.from('credit_tradelines').update({ dispute_status: 'removed' }).eq('id', dispute.tradeline_id);

    // Notify LO: item removed
    await sb.from('credit_repair_notifications').insert({
      org_id: pt.org_id,
      enrollment_id: enrollmentId,
      lead_id: pt.lead_id,
      type: 'item_removed',
      payload: { creditor: dispute.credit_tradelines?.creditor_name, bureau: dispute.bureau },
      sent_via: ['in_app', 'email'],
    });
  } else if (outcome === 'no_response') {
    nextAction = 'The bureau did not respond within 30 days. Under the FCRA, they are required to remove the item. We will generate a follow-up letter.';
    autoGenerateFollowUp = true;
  }

  await sb.from('credit_disputes').update({
    response_status: outcome,
    response_logged_at: new Date().toISOString(),
    ai_next_action: nextAction,
  }).eq('id', disputeId);

  // Auto-generate follow-up letter if needed
  let nextDisputeId = null;
  if (autoGenerateFollowUp) {
    const nextType = outcome === 'no_response' ? 'method_of_verification'
      : dispute.cycle_number >= 2 ? 'cfpb_complaint' : 'method_of_verification';

    // TODO: call generate-letters logic for this specific tradeline with nextType and cycleNumber+1
    // For brevity — Claude Code should implement this as a shared helper function
  }

  return NextResponse.json({ nextAction, nextDisputeId });
}
```

### 4h. `app/api/borrower-portal/[token]/credit-repair/update-score/route.ts`
**Borrower manually enters updated credit scores.**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const sb = createAdminClient();

  const { data: pt } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id')
    .eq('token', params.token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: 'Invalid' }, { status: 403 });

  const { enrollmentId, scoreExp, scoreEqx, scoreTu } = await req.json() as {
    enrollmentId: string; scoreExp: number; scoreEqx: number; scoreTu: number;
  };

  const { data: enrollment } = await sb
    .from('credit_repair_enrollments')
    .select('id, target_score, current_score_exp, score_history')
    .eq('id', enrollmentId).eq('lead_id', pt.lead_id).single();
  if (!enrollment) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const avgNew = Math.round((scoreExp + scoreEqx + scoreTu) / 3);
  const scoreHistory = (enrollment.score_history as unknown[]) ?? [];
  scoreHistory.push({ date: new Date().toISOString().split('T')[0], exp: scoreExp, eqx: scoreEqx, tu: scoreTu, avg: avgNew });

  const isMortgageReady = avgNew >= (enrollment.target_score ?? 640);
  await sb.from('credit_repair_enrollments').update({
    current_score_exp: scoreExp,
    current_score_eqx: scoreEqx,
    current_score_tu: scoreTu,
    score_history: JSON.stringify(scoreHistory),
    ...(isMortgageReady ? { status: 'mortgage_ready', mortgage_ready_at: new Date().toISOString() } : {}),
  }).eq('id', enrollmentId);

  // Notify LO at milestones
  const notifyAt = [580, 620, 640, 680, 720];
  const prevAvg = enrollment.current_score_exp ? Math.round((enrollment.current_score_exp ?? 0 + 0 + 0) / 3) : 0;
  const crossedMilestone = notifyAt.find(m => prevAvg < m && avgNew >= m);
  if (crossedMilestone || isMortgageReady) {
    await sb.from('credit_repair_notifications').insert({
      org_id: pt.org_id,
      enrollment_id: enrollmentId,
      lead_id: pt.lead_id,
      type: isMortgageReady ? 'mortgage_ready' : 'score_milestone',
      payload: { score: avgNew, milestone: crossedMilestone, target: enrollment.target_score },
      sent_via: ['in_app', 'email'],
    });
  }

  return NextResponse.json({ avgScore: avgNew, isMortgageReady });
}
```

### 4i. `app/api/borrower-portal/[token]/credit-repair/subscribe/route.ts`
**Create Stripe checkout session for $19.99/month.**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const sb = createAdminClient();

  const { data: pt } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id')
    .eq('token', params.token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: 'Invalid' }, { status: 403 });

  const { enrollmentId } = await req.json() as { enrollmentId: string };

  const { data: enrollment } = await sb
    .from('credit_repair_enrollments')
    .select('id, stripe_customer_id, croa_disclosure_signed_at')
    .eq('id', enrollmentId)
    .eq('lead_id', pt.lead_id)
    .single();

  if (!enrollment?.croa_disclosure_signed_at) {
    return NextResponse.json({ error: 'Must sign CROA disclosure first' }, { status: 403 });
  }

  const origin = req.headers.get('origin') ?? 'https://ashleyiq.vercel.app';

  // Single checkout session: subscription + one-time credit pull fee on first invoice
  const session = await stripe.checkout.sessions.create({
    customer: enrollment.stripe_customer_id ?? undefined,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        // $19.99/month recurring — ongoing charge
        price: process.env.STRIPE_CREDIT_REPAIR_PRICE_ID!,
        quantity: 1,
      },
      {
        // $9.99 one-time credit pull fee — appears on first invoice only
        // Create this as a one-time Price in Stripe dashboard
        // Stripe adds it to the first subscription invoice automatically
        price: process.env.STRIPE_CREDIT_PULL_PRICE_ID!,
        quantity: 1,
      },
    ],
    success_url: `${origin}/status/${params.token}?tab=credit-repair&subscribed=1`,
    cancel_url: `${origin}/status/${params.token}?tab=credit-repair`,
    metadata: { enrollment_id: enrollmentId, lead_id: pt.lead_id, org_id: pt.org_id },
    subscription_data: {
      metadata: { enrollment_id: enrollmentId },
      // No trial — pull is gated behind payment, so borrower pays first then pulls
    },
  });

  return NextResponse.json({ url: session.url });
}
```

### 4j. `app/api/webhooks/stripe-credit-repair/route.ts`
**Handle subscription status changes.**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const sb = createAdminClient();

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const enrollmentId = sub.metadata?.enrollment_id;
    if (enrollmentId) {
      const statusMap: Record<string, string> = {
        active: 'active', past_due: 'past_due', canceled: 'canceled',
        unpaid: 'past_due', trialing: 'trial', paused: 'paused',
      };
      await sb.from('credit_repair_enrollments').update({
        stripe_subscription_id: sub.id,
        subscription_status: statusMap[sub.status] ?? sub.status,
        billing_started_at: sub.trial_end
          ? new Date(sub.trial_end * 1000).toISOString()
          : new Date().toISOString(),
      }).eq('id', enrollmentId);
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.CheckoutSession;
    const enrollmentId = session.metadata?.enrollment_id;
    if (enrollmentId && session.subscription) {
      await sb.from('credit_repair_enrollments').update({
        stripe_subscription_id: session.subscription as string,
        subscription_status: 'active',
      }).eq('id', enrollmentId);
    }
  }

  return NextResponse.json({ received: true });
}
```

---

## STEP 5 — BORROWER PORTAL CREDIT REPAIR TAB

### 5a. Update `app/(borrower)/status/[token]/page.tsx`

Add credit repair data fetch to the existing server component. After the existing `docRequests` query, add:

```typescript
// Fetch credit repair enrollment if it exists
const { data: creditEnrollment } = await sb
  .from('credit_repair_enrollments')
  .select('id, status, subscription_status, target_score, current_score_exp, current_score_eqx, current_score_tu, starting_score_exp, score_history, croa_disclosure_signed_at, trial_ends_at')
  .eq('lead_id', lead.id)
  .eq('org_id', portalToken.org_id)
  .maybeSingle();
```

Pass to `BorrowerPortalClient`:
```typescript
creditRepair={creditEnrollment ?? null}
```

Update the `Props` interface in `BorrowerPortalClient.tsx` to accept `creditRepair` prop.

### 5b. Create `app/(borrower)/status/[token]/CreditRepairTab.tsx`

This is the main consumer-facing credit repair experience. Create as a full `'use client'` component with the following sections:

**States / flow:**
1. `not_enrolled` — enrollment not triggered by LO yet. Show: "Your loan officer will set this up for you when needed."
2. `pending_upload` + `subscription_status != 'active'` — enrolled but not yet paid. Flow: CROA disclosure + e-sign → payment screen
3. Payment screen — show pricing clearly: "Credit Report Pull · $9.99 (one-time)" + "Monthly Dispute Service · $19.99/month" → total first charge = $29.98 → "Start My Credit Repair" CTA → Stripe Checkout
4. `pending_upload` + `subscription_status = 'active'` — paid but not yet pulled. Show the soft pull form immediately (skip back to payment is not needed)
5. `analyzing` — pull in progress. Show: spinner + "Ashley is pulling your credit report…" (typically 5–10 seconds)
4. `active` — main dashboard:
   - Score dashboard: 3 bureau scores, starting → current, progress bar toward target
   - Mortgage readiness bar: visual loan product unlock (FHA 580, Conv 620, Best Rates 740)
   - Dispute queue: list of all identified items with priority rank, estimated score gain, and status
   - "Send All Letters" CTA button (only shows pending disputes with generated letters)
   - Active disputes: timeline of sent letters with 30-day countdown + "Log Bureau Response" prompt
   - Score update section: "Re-check your scores" → manual entry form
5. `mortgage_ready` — celebration screen + LO contact CTA
6. `canceled` — reactivation prompt

**Key UI components to implement:**

```tsx
// Score progress card
function ScoreCard({ label, starting, current, target }: { label: string; starting: number; current: number; target: number }) {
  const pct = Math.min(100, Math.max(0, ((current - starting) / (target - starting)) * 100));
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-2xl font-bold text-navy">{current}</span>
        <span className="text-sm text-gray-400 mb-0.5">/ {target} target</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full">
        <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1">Started: {starting}</p>
    </div>
  );
}

// Loan product unlock bar
function LoanUnlockBar({ score }: { score: number }) {
  const products = [
    { label: 'FHA', minScore: 580, color: '#10B981' },
    { label: 'Conventional', minScore: 620, color: '#3B82F6' },
    { label: 'Best rates', minScore: 680, color: '#C9A95C' },
    { label: 'Jumbo', minScore: 720, color: '#8B5CF6' },
  ];
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-3 font-medium">Loan products you unlock</p>
      <div className="space-y-2">
        {products.map(p => (
          <div key={p.label} className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full`} style={{ background: score >= p.minScore ? p.color : '#E5E7EB' }} />
            <span className={`text-sm ${score >= p.minScore ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{p.label}</span>
            <span className="text-xs text-gray-400 ml-auto">{p.minScore}+</span>
            {score >= p.minScore && <span className="text-xs font-medium text-green-600">✓ Unlocked</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**CROA disclosure flow:**
- Show full disclosure text in a scrollable box
- "I have read and agree to the Credit Repair Organizations Act disclosure" checkbox
- "Sign & Continue" button → calls `/api/borrower-portal/[token]/credit-repair/sign-croa`
- Only shows if `croa_disclosure_signed_at` is null

**Soft pull form (shown after CROA signed, before first pull):**
- Headline: "Pull My Credit Report — Won't affect your score"
- Subtext: "We use a soft pull, which is invisible to lenders and has zero impact on your credit score."
- Fields: First Name, Last Name, SSN (masked input `***-**-****`), Date of Birth, Current Address (Line 1, City, State, Zip)
- Submit button: "Pull My Credit — Free Soft Pull"
- Disclaimer: "By clicking, you authorize AshleyIQ to obtain your credit report from all three bureaus via a soft inquiry. This will not appear on your credit report or affect your score."
- After submit: spinner + "Pulling your credit report…" (calls `/api/borrower-portal/[token]/credit-repair/pull-credit`)
- On success: transition to active dashboard immediately

**Dispute queue:**
- Grouped by priority: "High Impact" (priority 1-3), "Medium" (4-6), "Lower" (7-10)
- Each item shows: creditor name, account type, bureau, dispute reason, estimated score gain badge
- Checkbox to select/deselect individual items
- "Generate & Preview Letters" button
- Letter preview modal before sending
- "Approve & Send Certified Mail" CTA

**Active dispute timeline:**
- Each sent dispute shows: bureau, creditor, sent date, delivery estimate, 30-day countdown timer
- When countdown expires: "⏰ Time to check your mail — log your bureau response" prompt
- "Log Response" button opens modal with options: Item Removed ✓ / Item Updated / Bureau Said Verified / No Response
- Option to upload a photo of the bureau response letter

**Score refresh prompt:**
- Appears 45 days after the initial pull (prompt borrower to re-pull)
- "Time to check your progress — pull a fresh report" CTA button
- Clicking launches the same soft pull form, pre-filled with previously entered info (name/address only — never SSN/DOB pre-filled)
- After successful re-pull: score history chart updates, any newly unlocked loan products highlighted
- The `/api/borrower-portal/[token]/credit-repair/pull-credit` route handles both initial and refresh pulls — `cycle_number` increments automatically based on `credit_report_uploads` count

### 5c. Update `BorrowerPortalClient.tsx`

Add `creditRepair` prop and a new "Credit Repair" tab to the existing navigation. The tab should show a badge indicator if there are pending actions (disputes awaiting approval, responses to log). Tab icon: `<ShieldCheck />` (already imported).

---

## STEP 6 — LO DASHBOARD ENHANCEMENTS

### 6a. Enhance `app/(dashboard)/credit-repair/page.tsx`

The existing page shows the manual credit repair pipeline. Add a new section at the top: **"Consumer Credit Repair"** — a card grid showing:
- Enrolled borrowers count
- Active disputes in flight
- Borrowers who hit mortgage-ready this month
- Unread notifications (items removed, score milestones)

### 6b. Create `app/(dashboard)/credit-repair/CreditRepairNotifications.tsx`

Feed from `credit_repair_notifications` table. Shows:
- 🎉 `[Borrower Name]` hit 640 — mortgage ready! → CTA: "Call Now"
- ✅ Collection removed from `[Borrower]`'s Experian report
- 📊 `[Borrower]` score increased to 623
- 📬 `[Borrower]` disputes sent to all 3 bureaus

### 6c. Create `app/(dashboard)/credit-repair/enrollment/[enrollmentId]/page.tsx`

LO detail view per enrolled borrower:
- Score chart (line chart: all 3 bureau scores over time)
- Dispute timeline (all letters sent, responses, outcomes)
- Current status + estimated mortgage-ready date
- "Enroll in credit repair" button on lead detail page at `app/(dashboard)/leads/[id]/page.tsx` — add this button if borrower is not yet enrolled

### 6d. LO Notification Settings

Add a "Credit Repair Notifications" section to `app/(dashboard)/settings/page.tsx`:
- Checkboxes for each notification type (pre-checked to recommended defaults)
- SMS toggle
- Save → updates `credit_repair_org_settings`

---

## STEP 7 — STRIPE SETUP REMINDER

Before running in production, create two Prices in Stripe under the same Product:

```
Product: "AshleyIQ Credit Repair"

Price 1 — Monthly subscription
  Type: Recurring
  Amount: $19.99/month
  → Set as STRIPE_CREDIT_REPAIR_PRICE_ID

Price 2 — Credit report pull
  Type: One-time
  Amount: $9.99
  → Set as STRIPE_CREDIT_PULL_PRICE_ID
```

Both line items go into the same Checkout session. Stripe bills them together on the first invoice ($29.98 total). From the second month onward, only the subscription renews ($19.99).

Also register the new webhook endpoint `/api/webhooks/stripe-credit-repair` in Stripe dashboard.

---

## STEP 8 — LOB SETUP REMINDER

1. Sign up at lob.com and get API key
2. Use `test_...` key in dev (letters go to Lob test dashboard, not real mail)
3. Switch to `live_...` key for production
4. Set `LOB_API_KEY` in Vercel env vars

---

## STEP 9 — SUPABASE STORAGE BUCKET

Create a private bucket called `bureau-responses` in Supabase Storage:
- No public access
- Used only for borrower uploads of bureau response letters (photos/scans)
- Files accessible only via service role (`createAdminClient()`)
- Max file size: 10MB
- Allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`

Note: No `credit-reports` bucket is needed. Soft Pull Solutions returns structured data via API — no PDF is stored. Bureau response letter uploads go in `bureau-responses`.

---

## STEP 10 — VERIFICATION CHECKLIST

Before marking complete, verify each of the following works end-to-end:

- [ ] LO can enroll a borrower from lead detail page → enrollment record created
- [ ] Borrower visits `/status/[token]` → Credit Repair tab visible
- [ ] CROA disclosure renders, checkbox works, signing records `croa_disclosure_signed_at` and IP
- [ ] Soft pull form renders after CROA signed — SSN field is masked
- [ ] Submitting soft pull form calls `/pull-credit` → `credit_report_uploads` record created with `parse_status: parsing`
- [ ] In mock mode (`SOFT_PULL_API_KEY=mock`): mock data returned, Claude analyzes it, tradelines inserted
- [ ] SSN and DOB are NEVER written to any Supabase table (verify by inspecting the DB after a pull)
- [ ] Score dashboard shows starting scores
- [ ] "Generate Letters" creates `credit_disputes` records with full letter body
- [ ] "Send Certified Mail" calls Lob API → returns `lob_letter_id`
- [ ] 30-day countdown timers display per dispute
- [ ] "Log Response: Item Removed" → tradeline marked removed, LO notification inserted
- [ ] "Log Response: Bureau Verified" → AI generates next-round letter automatically
- [ ] "Update My Scores" → score history updated, mortgage-ready status checked
- [ ] When avg score hits target → LO gets `mortgage_ready` notification, borrower sees celebration screen
- [ ] CROA signed → payment screen shows "$9.99 + $19.99/mo = $29.98 first charge" clearly
- [ ] Stripe checkout session has two line_items (subscription + one-time pull fee)
- [ ] After payment, subscription_status = 'active' → "Pull My Credit" button unlocks
- [ ] Attempting to pull without active subscription returns 402 with `code: subscription_required`
- [ ] Second month Stripe invoice = $19.99 only (pull fee does not recur)
- [ ] Stripe webhook updates subscription_status on cancel/past_due → pull button re-locks
- [ ] LO dashboard shows enrolled borrower count + notifications
- [ ] LO notification settings save correctly
- [ ] RLS: borrower-portal routes use `createAdminClient()`, LO routes use `createClient()` with auth

---

## NOTES FOR CLAUDE CODE

- `createAdminClient()` bypasses RLS — only use it for borrower-portal routes where there is no Clerk session. Never use it in LO dashboard routes.
- The Anthropic document API (PDF parsing) requires `type: 'document'` in the message content — double check the SDK version supports this. If not available, fall back to sending the PDF as base64 text and instruct Claude to parse it from the text representation.
- The Lob `lob-node` package may have TypeScript type issues — add `@types/lob-node` or use `// @ts-ignore` where needed.
- Soft Pull Solutions is the only credit pull method. When `SOFT_PULL_API_KEY=mock`, the mock flow runs end-to-end with realistic data. When the real key is set (after SPS vendor approval), swap the env var and the same code runs against the live API — no other changes needed.
- To apply for Soft Pull Solutions access, go to softpullsolutions.com — approval typically takes 2–3 weeks. The API uses REST with Bearer token auth. Confirm exact endpoint paths and payload schema during onboarding as they may differ from the placeholder in this prompt.
- All dates in the DB are `TIMESTAMPTZ` — use `.toISOString()` for inserts, never raw Date objects.
