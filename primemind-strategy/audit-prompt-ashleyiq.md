# AshleyIQ — Full Codebase Audit Prompt
# Paste this entire prompt into a new Claude Code session opened at the project root.

---

You are performing a full audit of the AshleyIQ mortgage CRM platform. The goal is a
complete picture of what is working, what is stubbed, what is missing, and what is broken —
with a prioritized fix list at the end. Do not stop after finding the first issue. Complete
every phase before summarizing.

---

## PHASE 1 — Codebase orientation

1. Run `find . -type f -name "*.ts" -o -name "*.tsx" | head -200` to map the directory tree.
2. Read `package.json` (root and any workspace packages). Note Next.js version, Supabase client
   version, Clerk version, and all third-party integrations present.
3. Identify the active app directory (`app/`, `src/app/`, or similar). Note whether the App
   Router or Pages Router is in use.
4. Read every file in `supabase/migrations/` (or `supabase/schema.sql` if a single file).
   Build a full list of every table defined in the database.
5. Read `supabase/seed/` if it exists. Note any seed data files.
6. Check for a `.env.example` or `.env.local.example` file. List every required environment
   variable. Flag any that are hardcoded or missing from the example file.

---

## PHASE 2 — Feature coverage check

For each feature below, confirm it exists in the codebase. For each one, report:
- STATUS: Fully built / Partially built / Stubbed / Missing
- KEY FILE(S): The primary file(s) that implement it
- GAPS: Any missing pieces (missing route, missing table, TODO comment, empty function body,
  hardcoded mock data, missing env var guard)

### 2.1 Lead pipeline (CRM core)
- [ ] Lead list view with stage columns or kanban
- [ ] Lead detail page showing contact info, loan info, status, and assigned LO
- [ ] Create / edit lead form
- [ ] Lead stage update (move through pipeline stages)
- [ ] Activity log / timeline on each lead
- [ ] Notes on lead record
- [ ] Tag / label system

### 2.2 Speed-to-lead routing
- [ ] `POST /api/leads/route` — assigns lead to LO based on round-robin, specialty, or geography
- [ ] Assignment rules table or config
- [ ] Escalation tiers (5 min → 10 min → 30 min) using pg_cron or Edge Function
- [ ] TCPA consent gate — no SMS fires without `tcpa_consent = true`
- [ ] Twilio SMS on assignment
- [ ] Zillow webhook receiver (`POST /api/webhooks/zillow` or equivalent)
- [ ] Lead source tracking field on every lead

### 2.3 Point of sale (POS)
- [ ] Public-facing application route (`/apply/[slug]`) — must use `createAdminClient()`,
  NOT Clerk auth
- [ ] URLA fields: personal info, employment, income, assets, liabilities, declarations,
  demographic data
- [ ] Co-borrower section
- [ ] Disclosure checkboxes: RESPA, TILA, ECOA, FCRA — all required before submit
- [ ] `POST /api/pos/submit` — creates lead record
- [ ] SSN and DOB passed to credit API only — CONFIRM these fields are never written to any
  Supabase table. Grep for `ssn` and `dob` across all INSERT/UPDATE statements.
- [ ] Application reference number generation (`APP-YYYY-NNNNN` format or similar)
- [ ] Borrower portal token created on POS submit (`borrower_portal_tokens` table)
- [ ] Embeddable widget script (`/api/pos/widget/[slug]`)
- [ ] `pos_configs` table (per-org POS configuration)

### 2.4 Borrower portal
- [ ] Token-based auth (no Clerk for borrowers) — token in URL or cookie
- [ ] Borrower can see their loan status / pipeline stage
- [ ] Borrower can see their outstanding conditions (only those flagged `assigned_to_borrower`)
- [ ] Borrower can upload documents
- [ ] Portal does NOT expose waived or n/a conditions

### 2.5 Conditions list
- [ ] `loan_conditions` table
- [ ] `condition_events` table — verify RLS is INSERT-only (no UPDATE, no DELETE, including
  for service_role)
- [ ] Condition phases: PTU / PTD / PTF / PTClose / Suspended / General
- [ ] Condition statuses: outstanding → received → reviewing → satisfied / waived / n/a
- [ ] Condition template library (seeded in `supabase/seed/conditions.sql` or equivalent)
- [ ] Bulk add conditions by phase + category
- [ ] `GET /api/borrower-portal/[token]/conditions` — returns only `assigned_to_borrower = true`,
  excludes waived/n/a
- [ ] Nightly reminder Edge Function or pg_cron (max 1 email per borrower per 48 hours)
- [ ] DSCR-specific condition templates: rent roll, lease agreements, entity formation docs,
  DSCR certification letter

### 2.6 Commission / payroll workflow
- [ ] `comp_plans` table
- [ ] `pay_runs` table
- [ ] `pay_run_items` table
- [ ] `payroll_events` table — verify INSERT-only RLS
- [ ] `calculateComp()` function — uses loan amount only, never loan terms
  (flag immediately if compensation varies by rate, points, or loan type — this is a
  CFPB Reg Z violation)
- [ ] Comp types supported: flat / BPS / percent_revenue
- [ ] Role enforcement: LO cannot approve their own pay run; HR cannot submit
- [ ] Pay stub PDF stored in private Supabase Storage bucket (not public)

### 2.7 Recruiting pipeline
- [ ] Accessible only to branch_manager / admin / team_lead roles — NOT to LO role
- [ ] `recruit_prospects` table
- [ ] `comp_scenarios` table
- [ ] `recruit_activities` table
- [ ] NMLS lookup: CredifyID API first, NMLS Consumer Access public API fallback
- [ ] `calculateScenario()` — monthly volume, gross revenue, LO comp, branch profit,
  breakeven months, 12-month ROI
- [ ] Kanban: Identified → Contacted → First Meeting → Second Meeting → Offer Sent →
  Offer Accepted / Passed / Rejected
- [ ] Claude Haiku outreach email draft generation
- [ ] Production data is manually entered (not pulled from any API — NMLS does not
  provide trailing 12 data)

### 2.8 LOS integration (Encompass / BytePro)
- [ ] `los_integrations` table (credentials stored encrypted, not plaintext)
- [ ] `los_loan_sync` table
- [ ] `los_sync_events` table — INSERT-only RLS
- [ ] `los_conflicts` table
- [ ] Encompass API base: `https://api.elliemae.com/encompass/v3`
- [ ] Token refresh logic (password grant OAuth)
- [ ] Webhook receiver with HMAC-SHA256 signature verification via `X-Elli-Signature`
- [ ] Key field mappings: 4000=FirstName, 4002=LastName, 4006=Email, 4008=Phone,
  1172=LoanAmount
- [ ] Conflict resolution rule: LOS wins on loan data; AshleyIQ wins on CRM data;
  simultaneous changes within 60 seconds → conflict table
- [ ] Rate limit: Encompass allows 25 req/sec — confirm no unbounded bulk sync loops

### 2.9 Call reports (7 reports)
- [ ] `GET /api/reports/production`
- [ ] `GET /api/reports/pl`
- [ ] `GET /api/reports/hmda`
- [ ] `GET /api/reports/pipeline-velocity`
- [ ] `GET /api/reports/compliance`
- [ ] `GET /api/reports/referral-source`
- [ ] `GET /api/reports/lo-scorecard`
- [ ] LO role enforcement: `effectiveLoId` forced to own ID (LOs cannot see other LOs' data)
- [ ] HMDA report: `ready_for_filing: true` only when zero issues
- [ ] DB views: `v_production`, `v_pipeline_velocity`, `v_referral_sources`
- [ ] `leads` table has: `application_submitted_at`, `loan_type`, `closed_date`, `close_price`

### 2.10 Equity tracker / DeedMine integration
- [ ] `property_valuations` table
- [ ] `equity_alerts` table
- [ ] `estimated_equity` as a GENERATED ALWAYS computed column (AVM minus mortgage balance)
- [ ] `lib/deedmine/client.ts` with `pullAVM()` function
- [ ] `GET /api/leads/[id]/equity` — returns latest valuation
- [ ] `POST /api/leads/[id]/equity` — triggers fresh AVM pull
- [ ] Monthly pg_cron: 1st of month, re-pulls AVM for all leads with active equity alerts
- [ ] LTV color thresholds: green <80%, yellow 80–95%, red >95%
- [ ] `DEEDMINE_API_KEY` in env (not hardcoded)

### 2.11 Credit repair
- [ ] Credit pull integration (Soft Pull Solutions or equivalent)
- [ ] SSN/DOB NEVER stored in DB — only passed to API in-flight. Verify with grep.
- [ ] Dispute letter generation
- [ ] CROA compliance: disclosure shown + e-signed before any charge
- [ ] 3-day cancellation window enforced

### 2.12 Campaigns / outreach
- [ ] Email campaigns (via Resend)
- [ ] SMS campaigns (via Twilio)
- [ ] TCPA opt-in required before SMS
- [ ] Opt-out / STOP handling
- [ ] `opt_ins` / `opt_outs` tables are INSERT-only (append-only audit)

---

## PHASE 3 — Route audit

1. List every file in `app/api/**/route.ts` (App Router) or `pages/api/**/*.ts` (Pages Router).
2. For each route file, check:
   - Does the handler export the correct HTTP methods? (GET, POST, PATCH, DELETE)
   - Is auth checked at the top before any DB operation?
   - Is there a try/catch with a meaningful error response?
   - Are there any `return` statements that might short-circuit without a response?
   - Is the response type correct (NextResponse.json, not res.json in App Router)?
3. Flag any route that:
   - Has a `TODO` comment in the handler body
   - Returns hardcoded mock/test data
   - Throws an unhandled promise rejection
   - Uses `createClient()` on a public route that should use `createAdminClient()`
   - Uses `createAdminClient()` on an authenticated route that should use `createClient()`

---

## PHASE 4 — Database audit

For each table in the migration files:

1. Does it have a corresponding Row Level Security policy? (`CREATE POLICY` statement)
2. For these tables, verify the RLS is INSERT-ONLY (no UPDATE, no DELETE, not even for
   service_role). Flag immediately if any of these have UPDATE or DELETE policies:
   - `condition_events`
   - `payroll_events`
   - `los_sync_events`
   - `opt_ins`
   - `opt_outs`
   - Any table named `*_audit` or `*_log` or `*_events`
3. Check every `leads` table column. Confirm it has:
   - `loan_type` (enum or text)
   - `lead_source` (to track referral origin including CLOSA)
   - `application_submitted_at` (timestamp)
   - `closed_date` (timestamp)
   - `close_price` (numeric)
   - `tcpa_consent` (boolean, default false)
   - `tcpa_consent_at` (timestamp)
   - `assigned_lo_id` (FK to LO user)
4. Flag any table that stores `ssn`, `social_security`, `date_of_birth`, `dob` as a column.
   These must not exist in any table.

---

## PHASE 5 — Security audit

1. Grep for `ssn` across all `.ts` and `.tsx` files. For each hit:
   - Is it in a form field? (OK — collected client-side only)
   - Is it in an INSERT or UPDATE statement? (CRITICAL VIOLATION — flag immediately)
   - Is it in an API call to a credit bureau? (OK — pass-through only)
2. Grep for `process.env` — list every env var referenced. Cross-check against
   `.env.example`. Flag any env var that is referenced in code but not in the example file.
3. Check Clerk middleware (`middleware.ts`). Confirm:
   - All `/app/*` routes are protected
   - `/apply/*` and `/api/borrower-portal/*` are explicitly PUBLIC
   - `/api/webhooks/*` is explicitly PUBLIC (webhook receivers cannot require auth)
4. Check for any hardcoded API keys, secrets, or credentials in source files.
5. Check Supabase Storage bucket policies. Any bucket storing user documents or pay stubs
   must NOT be public.

---

## PHASE 6 — Integration audit

For each integration, find the client file or SDK usage and report:

| Integration | Client file | Env var used | Real key or mock? |
|---|---|---|---|
| Twilio (SMS) | | `TWILIO_*` | |
| Resend (email) | | `RESEND_API_KEY` | |
| Stripe (billing) | | `STRIPE_*` | |
| Soft Pull Solutions | | `SOFT_PULL_API_KEY` | |
| DeedMine / ATTOM | | `DEEDMINE_API_KEY` | |
| CredifyID | | `CREDIFYID_API_KEY` | |
| Encompass LOS | | `ENCOMPASS_*` | |
| ElevenLabs (voice) | | `ELEVENLABS_*` | |
| Lob.com (mail) | | `LOB_API_KEY` | |

For each integration where the env var is set to `mock`, `test`, or is empty in the
example file, note it as "not yet live" — this is expected and acceptable as long as the
real integration code is written and the env var placeholder is documented.

---

## PHASE 7 — UI audit (buttons, forms, dead links)

1. Grep for `onClick` handlers across all `.tsx` files. For each onClick that calls a
   function, verify that function is defined. Flag any `onClick={handleXxx}` where
   `handleXxx` is undefined or empty.
2. Grep for `<form` tags. For each form:
   - Is there an `onSubmit` handler?
   - Does the handler call an API route or Supabase directly?
   - Is there loading state and error handling?
3. Grep for `href="/"`, `href="#"`, `href=""` — these are dead links. Flag them.
4. Grep for `disabled={true}` or `disabled` on buttons — list them. If a button is
   permanently disabled, it may be a placeholder for an unbuilt feature.
5. Find any `<button>` or `<Button>` without an `onClick`, `type="submit"`, or `form`
   attribute — these do nothing.

---

## PHASE 8 — TypeScript coverage

1. Run `npx tsc --noEmit` and report all type errors.
2. Grep for `as any` — list every occurrence. Each one is a potential runtime crash hiding
   behind a type cast.
3. Check `types/index.ts` or wherever global types are defined. Verify types exist for:
   - `Lead` (with all fields from Phase 4)
   - `LoanCondition`
   - `PayRun` / `PayRunItem`
   - `RecruitProspect`
   - `PropertyValuation`
   - `BorrowerPortalToken`
   - `LosIntegration`

---

## PHASE 9 — Edge Functions and cron jobs

1. List all files in `supabase/functions/`.
2. For each function, confirm it has a `serve()` handler and is not an empty file.
3. Check `supabase/config.toml` or migration SQL for `cron.schedule()` calls. Verify:
   - Speed-to-lead escalation cron exists (fires every 5 minutes or similar)
   - Monthly AVM refresh cron exists (1st of month, 9 AM ET)
   - Nightly condition reminder cron exists (8 AM ET daily)

---

## PHASE 10 — Output

Produce a structured report in this format:

### Summary
- Total routes found: N
- Routes with issues: N
- Tables found: N
- Tables missing RLS: N
- Security violations: N (SSN in DB, hardcoded secrets, etc.)
- Integrations live: N / N
- Broken UI elements: N

### Critical (fix before any user touches the product)
List each issue with: file path, line number if possible, description, fix.

### High (fix before first paying customer)
Same format.

### Medium (fix within first sprint post-launch)
Same format.

### Low / polish
Same format.

### Missing features not yet in codebase
List any feature from Phase 2 with STATUS = Missing, with a one-line description of
what needs to be built.

---

Start with Phase 1. Work sequentially. Do not skip phases. Report findings as you go.
