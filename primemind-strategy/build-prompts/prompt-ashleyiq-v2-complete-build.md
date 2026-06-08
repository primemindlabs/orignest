# AshleyIQ v2 — Complete Feature Build Prompt
# Claude Code Session Instruction

---

## HOW TO LAUNCH THIS SESSION

Run this from the repo root (one level above `products/`):

```bash
claude --dangerously-skip-permissions
```

Then paste this entire prompt. Claude Code will run fully autonomously — no confirmation prompts, no permission dialogs. It will build every phase, run all Supabase migrations via the MCP, and verify the result without stopping to ask questions.

**Prerequisites before launching:**
- Supabase MCP must be configured: `claude mcp add supabase -- npx -y @supabase/mcp-server-supabase@latest --access-token YOUR_TOKEN`
- Active Supabase project must be the Originest/Conduit project (project ref: `dhnxiijduycmzfjmohyp`)
- `.env.local` must exist with at minimum: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`

---

> Open this session at the root of `products/conduit-next/` (or `products/conduit-v2/` — whichever is the active codebase). Run `ls` first to confirm the directory structure, then execute every phase in order. Do not skip phases. Do not mock data in any production code path.

---

## WHO YOU ARE AND HOW YOU WORK

You are a senior full-stack engineer with 10+ years of production experience in Next.js, TypeScript, Supabase, and financial-grade SaaS. You write code the way a principal engineer would review it.

**Your non-negotiable engineering principles:**

### PRESERVE EVERYTHING THAT EXISTS
- **Read before you write.** Before touching any file, read it in full. Understand what is already there.
- **Never delete existing functionality.** If a feature already exists, you improve it or extend it — you do not replace it, rewrite it from scratch, or remove it unless explicitly told to. Removing a working feature is a critical error.
- **If a file already handles something, extend it** — do not create a parallel implementation. One file, one responsibility, extended cleanly.
- **Additive only.** Every change in this session either adds a new capability or improves an existing one. Nothing is subtracted.

### DRY — DON'T REPEAT YOURSELF
- Before writing any new utility function, hook, component, or helper — search the codebase. If it already exists, use it. If it almost does what you need, extend it.
- Shared logic lives in `lib/` (server utilities), `hooks/` (client React hooks), or `components/ui/` (shared UI primitives). Never duplicate across feature directories.
- Database query patterns that appear more than once become a shared repository function in `lib/db/`.
- If you find yourself writing the same API auth check in a second route, extract it to a middleware or a shared `withAuth()` wrapper.

### KISS — KEEP IT SIMPLE, STUPID
- The simplest solution that fully solves the problem is correct. Complexity is a bug.
- No over-engineering: no unnecessary abstraction layers, no premature generalization, no design patterns applied for their own sake.
- If you need more than one sentence to explain why a piece of code works, simplify it.
- Prefer explicit over clever. A clear `if/else` beats a one-liner that requires a comment to parse.
- New dependencies are a last resort. Before adding a package, confirm the functionality cannot be accomplished with what is already installed or with browser/Node built-ins.

### BEFORE STARTING EACH PHASE
1. `grep` or `find` for existing code related to that phase's feature area.
2. Read the files you find.
3. Identify what already works.
4. Write only what is missing or needs improvement.
5. Do not touch code unrelated to the phase.

### WHEN IN DOUBT
- Preserve the existing behavior and add alongside it.
- If you are unsure whether something exists, search — don't assume.
- If a phase conflicts with existing code, note the conflict and resolve it without breaking what works.

---

## IMMOVABLE SECURITY RULES
These constraints are non-negotiable and must be enforced throughout every change in this session:

1. **SSN and DOB are never written to the database.** They are passed in-memory to the Soft Pull Solutions API only, then discarded. Grep for `ssn` and `dob` before every commit and fail the build if either appears in a SQL INSERT or Supabase query.
2. **All audit tables are INSERT-only.** Tables: `condition_events`, `payroll_events`, `los_sync_events`, `opt_ins`, `opt_outs`, `credit_pull_events`, `dispute_events`, `rate_lock_events`, `campaign_events`, `partner_events`, `score_events`. RLS must allow INSERT for authenticated roles and DENY UPDATE and DELETE for ALL roles including `service_role`.
3. **No mock data in production paths.** If a third-party API is not connected, show a real disabled state with a `TODO: set env var` comment. Never return fake data from a live API route.
4. **TCPA compliance.** No SMS or voice call may be initiated without a verified `opt_in` record for that phone number. The opt-in record must include consent language, timestamp, and IP address.
5. **CFPB Reg Z 12 CFR 1026.36.** LO compensation plans may only key on loan amount. Never allow comp to vary by loan terms (rate, APR, product type). Enforce this at the database constraint level on `comp_plans`.
6. **CROA compliance.** Before any credit repair charge: show the required CROA disclosure, capture e-signature, enforce 3-business-day cancellation window. Block billing until these three conditions are met.
7. **Each Supabase client is scoped correctly.** Use `createAdminClient()` (service role) only for public/borrower routes that have no Clerk session. Use `createClient()` (anon + RLS) for all authenticated LO/staff routes.
8. **TypeScript strict mode.** No `as any`. Run `tsc --noEmit` at the end of every phase and fix all errors before proceeding.

---

## ⚠️ DESIGN FREEZE — READ THIS BEFORE TOUCHING A SINGLE FILE

**The existing design is intentional, complete, and must not change. It was built to look like Apple made it and cost millions to produce. Your job is to ADD FEATURES to this design system — not restyle it, not modernize it, not simplify it, not "improve" it.**

### FILES YOU MUST NEVER MODIFY

```
app/globals.css                   ← FROZEN. Do not touch. Ever.
tailwind.config.ts                ← FROZEN. Do not touch. Ever.
app/layout.tsx                    ← FROZEN. Do not touch. Ever.
components/ui/*                   ← READ ONLY. Extend, never replace.
app/(dashboard)/layout.tsx        ← FROZEN. Sidebar + topbar are final.
app/page.tsx                      ← FROZEN. Landing page is final.
```

### COLOR RULES — HARDCODED, NON-NEGOTIABLE

These are the EXACT values from `globals.css`. Do not deviate.

```
Page background:      #F5F5F7   (Apple system gray)    → var(--c-bg)
Cards / panels:       #FFFFFF   (pure white)            → var(--c-surface)
Secondary panels:     #FBFBFD   (near-white)            → var(--c-surface2)
Primary text:         #0F1D2E   (Midnight Navy)         → var(--c-text)
Secondary text:       #6B7B8D   (Coastal Slate)         → var(--c-label2)
Tertiary text:        #A8B4BE   (muted slate)           → var(--c-label3)
Primary CTA / nav:    #0F1D2E   (Midnight Navy)         → .btn-primary
Gold accent:          #C9A95C   (Meridian Gold)         → var(--c-gold)
Gold fill (bg tint):  rgba(201,169,92,0.12)             → var(--c-gold-light)
Borders:              rgba(15,29,46,0.10)               → var(--c-border)
Hover fills:          rgba(15,29,46,0.06)               → var(--c-fill)
Success:              #2D7A4F                           → var(--c-success)
Warning:              #B07D28                           → var(--c-warning)
Danger / error:       #C4724A   (Terra Signal)          → var(--c-danger)
Info:                 #3A5C7A   (Navy-tinted blue)      → var(--c-info)
Sidebar glass:        rgba(255,255,255,0.72) + blur(28px) → .glass-sidebar
Topbar glass:         rgba(255,255,255,0.85) + blur(20px) → .glass-topbar
Card shadow:          0 1px 0 rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06) → .card-shadow
```

The aesthetic is Apple system UI: cool neutral gray background, crisp white cards floating on top, frosted glass nav, Navy as the primary interactive color, Gold used once per screen on the most important number or action. This is the look. Protect it.

**If you write a hex color in any component that is not from this list, you are breaking the design. Use CSS variables only.**

### FONT RULES — HARDCODED, NON-NEGOTIABLE

```
Headings / display:   font-family: var(--font-display)   → Lora Bold
All UI / body:        font-family: var(--font-ui)         → Instrument Sans
All numbers / data:   font-family: var(--font-data)       → DM Mono
```

**Never use `font-sans` for a heading. Never use `font-display` for body copy. Never use any other Google font or system font.**

### SPACING AND LAYOUT RULES

- Generous whitespace. When in doubt, add more padding, not less.
- Cards: `rounded-card` (10px) + `shadow-card` — always.
- Inputs: `rounded-lg` border `var(--c-border)` focus ring `var(--c-gold)` — always.
- Touch targets: minimum 44×44px on all interactive elements.
- No horizontal scroll at any viewport width.
- Sidebar width: 220px (`--sidebar-w`). Topbar height: 56px (`--topbar-h`). These are fixed.

### WHEN BUILDING NEW SCREENS

New pages, panels, drawers, and modals must:
1. Use `bg-surface` (white) for cards and `bg-bg` (Apple system gray `#F5F5F7`) for page backgrounds.
2. Use the existing card component pattern — `rounded-card shadow-card p-6`.
3. Use `text-label` for primary text, `text-label-2` for secondary, `text-label-3` for tertiary.
4. Use the existing `btn-primary` class for primary actions (Navy button, white text).
5. Use `text-gold` or `border-gold` for the single most important metric or highlight per screen.
6. Use frosted glass (`glass-sidebar`, `glass-topbar`) only on the sidebar and topbar — nowhere else.
7. Match the visual density of existing screens exactly. Look at `app/(dashboard)/leads/page.tsx` as the reference.

### WHAT "APPLE-CALIBER" MEANS IN PRACTICE

- **One accent per screen.** One thing is gold. Everything else is navy or slate.
- **No gradients** except where they already exist.
- **No shadows heavier than `shadow-card`.** No drop shadows on text.
- **No borders on buttons** — buttons are filled or ghost, never outlined with a visible border.
- **No color in icons unless the icon is a status indicator.** Icons are `text-label-2` by default.
- **No animations except** the four already defined: `fade-in`, `slide-in-right`, `slide-up`, `shimmer`.
- **No third-party UI libraries** (no shadcn, no Radix in new components, no MUI, no Chakra). Use the existing `components/ui/` primitives.
- **Metric numbers always use `font-data` (DM Mono).** Dollar amounts, percentages, dates, counts — all monospaced.

### VIOLATION = BUILD FAILURE

If any of the following appear in code you write, it is a build failure. Fix before proceeding:
- A hardcoded hex color that is not in the brand palette above
- `font-sans` on a heading element
- `#007AFF`, `#3478F6`, or any blue not equal to `#3A5C7A`
- `bg-gray-*`, `bg-slate-*`, `bg-zinc-*`, `bg-neutral-*` (use `bg-bg` or `bg-surface`)
- Any import from `@radix-ui`, `@shadcn`, `@mui`, `@chakra` in a new component
- Inline `style={{ color: ... }}` or `style={{ background: ... }}` with a hardcoded value
- A new CSS file or `<style>` tag added anywhere
- Changes to `globals.css`, `tailwind.config.ts`, or `layout.tsx`

---

## PLATFORM UX PHILOSOPHY — READ BEFORE WRITING A SINGLE LINE OF UI

AshleyIQ must feel like the smartest person in the room. Not a dashboard. Not a form collection. An intelligent operating system that is actively working on the LO's behalf. Every screen should feel like it knows what the LO needs before they ask.

**Design language:** Apple-caliber. Apple system gray (`#F5F5F7`) page background. Pure white (`#FFFFFF`) cards floating on top. Frosted glass sidebar and topbar. Generous whitespace. One Meridian Gold (`#C9A95C`) accent per screen on the most important metric. Midnight Navy (`#0F1D2E`) for primary text, CTAs, and nav. All body text uses CSS variables — never hardcoded hex.

**Intelligence principles:**
- The platform must surface the next action without being asked. Every lead record shows one AI-generated "Next best action" card.
- Forms are not static. They respond to what the user is entering. If they click "Investment Property," investment-specific questions appear. If they select "VA," the VA eligibility block appears. If they are self-employed, the business income section expands. This is not optional UX polish — it is the core differentiator.
- Errors are prevented, not punished. The system validates in real time and explains what it needs in plain English.
- Nothing should feel like work. Repetitive tasks (condition matching, stage updates, outreach sends) are automated with human-in-the-loop confirmation, not manual re-entry.

**Fonts:**
- `Lora Bold` — display headings, product names, metric callouts
- `Instrument Sans` — all UI labels, body copy, inputs
- `DM Mono` — all numbers, percentages, dates, IDs

---

## PHASE 1 — LEAD PIPELINE ENHANCEMENTS

### 1.1 Automated Stage Progression

**Goal:** Stages advance automatically when qualifying events occur. The LO never has to drag a card.

**Stage triggers (add to `stage_transition_rules` table):**
```sql
CREATE TABLE stage_transition_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_stage text NOT NULL,
  to_stage text NOT NULL,
  trigger_event text NOT NULL, -- 'application_submitted' | 'soft_pull_completed' | 'conditions_cleared' | 'loan_submitted_to_uw' | 'loan_approved' | 'rate_locked' | 'cd_sent' | 'closed'
  created_at timestamptz DEFAULT now()
);
```

**Trigger logic:** In `app/api/leads/[id]/events/route.ts`, after any event is logged, call `evaluateStageTransitions(leadId, eventType)`. This function queries `stage_transition_rules` and fires `UPDATE leads SET stage = $1, stage_updated_at = now()` when a match is found. Log the transition to `lead_events` (INSERT-only).

**UI:** When a stage auto-advances, show a toast: `"Stage updated to Underwriting — triggered by loan submission"` with an undo button (30-second window only).

### 1.2 Lead Scoring (0–100, AI-powered, weekly recalculation)

**Schema:**
```sql
ALTER TABLE leads ADD COLUMN score integer DEFAULT NULL CHECK (score BETWEEN 0 AND 100);
ALTER TABLE leads ADD COLUMN score_updated_at timestamptz;
ALTER TABLE leads ADD COLUMN score_factors jsonb; -- array of {factor, weight, value, contribution}
```

**Scoring model (Claude Sonnet 4.5 via Edge Function `score-lead`):**
Inputs: days since last contact, number of touches, application status, credit score tier (if soft pull done), loan amount, loan type, source channel, time in current stage.

Prompt template:
```
You are a mortgage lead scoring engine. Given the following lead data, return a JSON object with:
- score: integer 0-100
- factors: array of {factor: string, contribution: integer, direction: "positive"|"negative"}
- summary: one sentence explaining the score

Lead data: [INSERT_LEAD_JSON]

Rules:
- A lead that submitted a full application scores 70+ baseline
- A lead with no contact in 14+ days loses 20 points
- A lead with a completed soft pull showing 720+ FICO scores 80+ baseline
- A lead from a referral source scores 10 points higher than cold
- Return ONLY valid JSON, no explanation outside the JSON object.
```

**Schedule:** Supabase pg_cron job, every Sunday at 2am ET, runs `score-lead` edge function for all active leads.

**UI:** Score badge on every lead card. Green 75–100, amber 50–74, red <50. Clicking the badge opens a drawer explaining the factors.

### 1.3 Duplicate Detection + Merge

**Detection logic:** On lead creation (both via POS and manual entry), run:
```sql
SELECT id, first_name, last_name, email, phone, created_at
FROM leads
WHERE (
  email = $1
  OR phone = $2
  OR (first_name ILIKE $3 AND last_name ILIKE $4)
)
AND tenant_id = $5
AND status != 'archived'
LIMIT 5;
```

If matches found, do not silently merge. Show a modal: `"Possible duplicate — these leads look similar"` with a side-by-side comparison and two options: "Merge into existing" or "Create as separate lead."

**Merge operation:** `POST /api/leads/merge` — takes `primary_id` and `secondary_id`. Copies all notes, documents, events, and conditions from secondary to primary. Archives secondary with `merged_into_id` foreign key. All history preserved. Append-only audit entry in `lead_events`.

### 1.4 Pipeline Velocity Alerts

**Definition:** A lead that has been in the same stage for longer than the configured SLA fires an alert.

**Schema:**
```sql
CREATE TABLE stage_sla_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  stage text NOT NULL,
  warning_days integer NOT NULL DEFAULT 3,
  critical_days integer NOT NULL DEFAULT 7
);
```

**Cron job:** Daily at 7am ET, query leads where `stage_updated_at < now() - INTERVAL '$warning_days days'`. Insert into `notifications` table with type `pipeline_velocity_warning` or `pipeline_velocity_critical`. Deliver via in-app notification bell and optional email.

**UI:** Show a clock icon on stale lead cards. Amber at warning threshold, red at critical. The pipeline board shows a `"3 leads stalled"` banner at the top of each column.

### 1.5 Stale Lead Resurrection

**Definition:** Leads that were marked `inactive` or `lost` and haven't been touched in 90+ days are eligible for resurrection.

**Weekly cron:** Find eligible leads and insert into `resurrection_queue`. The LO sees a weekly digest email: `"You have 7 leads that went cold — here's an AI-drafted reachout for each."` Claude Haiku generates the draft based on last loan purpose, last contact date, and current market conditions.

**UI:** `Leads > Resurrection` tab. Card for each stale lead with pre-drafted SMS or email. LO clicks "Send" or "Skip." Sent resurrections go back to `active` status with a new event logged.

### 1.6 Custom Fields Per Loan Type

**Schema:**
```sql
CREATE TABLE custom_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  loan_type text, -- NULL = show for all types
  field_key text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text','number','date','select','boolean')),
  options jsonb, -- for select type: [{label, value}]
  required boolean DEFAULT false,
  display_order integer DEFAULT 0
);

CREATE TABLE lead_custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  field_definition_id uuid NOT NULL REFERENCES custom_field_definitions(id),
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**UI:** In lead record, below the standard fields, render a `"Custom Fields"` section. Fields whose `loan_type` matches the lead's `loan_type` (or where `loan_type IS NULL`) are shown. Admin can manage definitions in `Settings > Custom Fields`.

---

## PHASE 2 — SPEED-TO-LEAD ROUTING ENHANCEMENTS

### 2.1 Capacity-Aware Routing

**Schema:**
```sql
ALTER TABLE lo_routing_config ADD COLUMN max_active_leads integer DEFAULT 50;
ALTER TABLE lo_routing_config ADD COLUMN routing_paused boolean DEFAULT false;
ALTER TABLE lo_routing_config ADD COLUMN pause_reason text;
```

**Routing logic update in `lib/routing/routeLead.ts`:**
Before assigning a lead, query the candidate LO's current active lead count:
```sql
SELECT COUNT(*) FROM leads
WHERE assigned_lo_id = $1 AND status IN ('new','active','application','processing') AND tenant_id = $2;
```
If `count >= max_active_leads` or `routing_paused = true`, skip to the next LO in the round-robin. If ALL LOs are at capacity, log a `routing_overflow` event and assign to the branch manager as fallback.

**UI:** LO profile page shows a capacity bar: `"42/50 active leads"`. Toggle to pause routing: `"Pause new lead routing"` with a reason field.

### 2.2 Response Rate Throttling

**Definition:** An LO who fails to respond to leads within the SLA window more than 3 times in 7 days gets their routing weight reduced.

**Schema:**
```sql
ALTER TABLE lo_routing_config ADD COLUMN response_rate decimal(5,2) DEFAULT 100.00;
ALTER TABLE lo_routing_config ADD COLUMN routing_weight integer DEFAULT 10; -- higher = gets more leads
```

**Calculation:** Nightly cron computes 7-day response rate per LO. Formula: `(leads responded within 60s / leads assigned) * 100`. Weight scales linearly from 10 (100% response) to 1 (0% response). Manager notified when an LO drops below 70%.

### 2.3 Time-of-Day and Day-of-Week Routing Rules

**Schema:**
```sql
CREATE TABLE routing_time_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  lo_id uuid REFERENCES users(id), -- NULL = applies to all LOs
  day_of_week integer[] NOT NULL, -- 0=Sun, 6=Sat
  start_time time NOT NULL,
  end_time time NOT NULL,
  action text NOT NULL CHECK (action IN ('route_normally','route_to_backup','hold_for_business_hours','send_to_ai_prequalifier')),
  backup_lo_id uuid REFERENCES users(id),
  timezone text NOT NULL DEFAULT 'America/New_York'
);
```

**Logic:** At routing time, evaluate the lead's local time (from area code or zip code lookup) against `routing_time_rules`. After-hours leads default to `send_to_ai_prequalifier` unless overridden.

### 2.4 AI Pre-Qualification Agent

**Trigger:** Lead arrives after hours OR all LOs are at capacity OR tenant has `ai_prequalifier_enabled = true`.

**Flow:**
1. Lead receives an immediate SMS (after TCPA consent): `"Hi [name], I'm Ashley, the AI assistant for [LO/Branch name]. I have a few quick questions to connect you with the right loan officer. Ready?"`
2. Conversational flow via Twilio SMS + Claude Haiku:
   - Loan purpose (purchase / refinance / cash-out)
   - Estimated credit score range (excellent 740+ / good 680-739 / fair 620-679 / below 620)
   - Estimated purchase price or current home value
   - Down payment amount or equity
   - Employment status (employed / self-employed / retired / other)
3. AI populates lead fields, scores the lead, and queues it for LO review with a summary card.
4. If borrower asks a complex question, escalate: `"Great question — let me connect you with a loan officer who can answer that directly."`

**Schema:**
```sql
CREATE TABLE ai_prequalifier_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text CHECK (status IN ('in_progress','completed','escalated','abandoned')),
  transcript jsonb DEFAULT '[]', -- array of {role: 'ai'|'borrower', message: string, timestamp}
  extracted_data jsonb -- structured data pulled from conversation
);
```

### 2.5 Lead Acceptance / Rejection

**Flow:** When a lead is routed to an LO, the LO sees a push notification with lead summary. They have 60 seconds to accept or reject.

- **Accept:** Lead is assigned. Timer stops. Speed-to-lead clock starts.
- **Reject:** Lead goes back to routing pool. The LO must provide a rejection reason (from a preset list: wrong territory / over capacity / conflict of interest / other). Three rejections in 24 hours triggers a manager alert.
- **No response in 60 seconds:** Lead is auto-routed to next LO. Counted as a non-response for response rate calculation.

**API:** `POST /api/leads/[id]/accept` and `POST /api/leads/[id]/reject` with `{ reason?: string }`.

---

## PHASE 3 — POINT OF SALE ENHANCEMENTS

### 3.1 Short-Form Pre-Qual POS

**URL:** `/apply/quick` — a 4-step, mobile-first POS that takes under 90 seconds.

**Steps:**
1. Loan purpose + estimated purchase price or home value
2. Estimated credit score range (no hard pull — just a range selector)
3. Employment type + gross monthly income (range is OK at this stage)
4. Name + email + phone + TCPA consent checkbox

**Behavior:** On submit, creates a lead with `source = 'short_pos'`, fires speed-to-lead routing, and shows a confirmation screen: `"Your information is with a loan officer. Expect a call within 60 seconds during business hours."` No auth required.

**Connection to full POS:** Lead record has `"Complete full application"` CTA. Clicking it either sends the borrower a magic link to the full POS or the LO can initiate it from the lead record.

### 3.2 Live Rate Estimate During Application

**Trigger:** Once the borrower has entered loan amount, property state, property type, loan purpose, and estimated credit score range in the full POS, show an inline rate estimate panel.

**Data source:** Optimal Blue PPE API (see Phase 20). While OB is not connected, show: `"Live rates load after your loan officer reviews your application."` This is NOT a lock — it is clearly labeled `"Estimated rate — not a commitment"`.

**Display:** Show 3 rate/point combinations (e.g., 0 points at par, 0.5 points for better rate, -0.5 points for higher rate with lender credit). Update as fields change.

### 3.3 Save and Return

**Implementation:**
- On first visit to any POS, generate a unique `application_token` (UUID) and store it in `localStorage` and as a `borrower_application_sessions` record.
- On every field change, debounce-save to the session record.
- Show a persistent `"Your progress is saved"` indicator in the header.
- Emit a magic link email: `"Resume your application"` — sent 30 minutes after an incomplete session with no activity.

**Schema:**
```sql
CREATE TABLE borrower_application_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_token text UNIQUE NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  lead_id uuid REFERENCES leads(id),
  partial_data jsonb DEFAULT '{}',
  current_step integer DEFAULT 1,
  last_active_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  resume_email_sent_at timestamptz
);
```

**Security:** The `partial_data` field must NEVER contain SSN or DOB. Validate at API level with a check that throws a 400 if either field is present.

### 3.4 Document Upload at Application Time

**UI:** On the `"Documents"` step of the full POS, allow borrowers to upload:
- Last 2 pay stubs
- Last 2 W-2s
- Last 2 bank statements
- Government ID (for identity verification only — not stored with loan file)

**Storage:** Upload to a private Supabase Storage bucket `borrower-docs/{tenant_id}/{lead_id}/`. Generate signed URLs (1-hour expiry) for LO review. Files are never publicly accessible.

**Schema:**
```sql
CREATE TABLE borrower_uploaded_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id),
  document_type text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','superseded'))
);
```

### 3.5 Commercial / DSCR Short POS

**URL:** `/apply/investor` — investor-specific 5-step flow.

**Steps:**
1. Property address + property type (SFR / 2-4 unit / 5+ unit / mixed use)
2. Estimated market rent (monthly) — show DSCR preview as they type: `"DSCR: 1.24 ✓ Likely eligible"`
3. Requested loan amount + estimated property value
4. Entity name (LLC / trust / corp) — explain: `"Most DSCR loans close in an LLC"`
5. Contact info + TCPA consent

**DSCR preview logic:** `DSCR = monthly_rent / (loan_amount * estimated_rate / 12 + estimated_taxes_insurance)`. Use a default estimated rate of 7.5% if OB is not connected. Show color-coded eligibility: ≥1.25 green, 1.00–1.25 amber, <1.00 red.

### 3.6 Multi-Language Support (Spanish Priority)

**Implementation:** Use `next-intl` or `i18next`. All POS copy goes through translation keys. Spanish (`es`) is the first non-English locale.

**Language detection:** Check browser `Accept-Language` header on POS pages. If Spanish, default to Spanish UI. User can toggle language in the POS header.

**Scope of Spanish translation (Phase 3.6 only):** All POS screens, borrower portal screens, and outgoing SMS/email templates. Admin/LO UI is English-only for this phase.

**Add env var:** `NEXT_PUBLIC_DEFAULT_LOCALE=en`

---

## PHASE 4 — BORROWER PORTAL ENHANCEMENTS

### 4.1 Visual Milestone Tracker

**Design:** A horizontal progress bar with named stops. Each stop has an icon, a label, and a completion state.

**Milestones (configurable per tenant):**
1. Application Received
2. Credit & Income Review
3. Appraisal Ordered
4. Underwriting
5. Conditional Approval
6. Clear to Close
7. Closing Scheduled
8. Funded 🎉

**Behavior:** The milestone that maps to the current `lead.stage` is highlighted in Meridian Gold. Completed milestones show a checkmark. Future milestones are shown dimmed. Clicking any milestone shows a brief plain-English description of what happens at that stage.

**Mobile:** On mobile, show the current milestone prominently centered with prev/next navigation arrows to see adjacent milestones.

### 4.2 Two-Way Messaging (Borrower ↔ LO)

**Schema:**
```sql
CREATE TABLE portal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id),
  sender_type text NOT NULL CHECK (sender_type IN ('borrower','lo','system')),
  sender_id uuid, -- lo user id if sender_type = 'lo'
  message text NOT NULL,
  read_by_borrower boolean DEFAULT false,
  read_by_lo boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

**Borrower side:** Message input at the bottom of the portal. Submit sends message and triggers a Resend email notification to the LO.

**LO side:** Unread message badge on the lead card. Messages visible in the lead record's `"Portal Messages"` tab. LO reply sends a Resend email to the borrower with a magic link back to their portal.

**Real-time:** Use Supabase Realtime on `portal_messages` for live updates. No polling.

### 4.3 Pre-Approval Letter Download

**Trigger:** Only available when `lead.stage IN ('approved','clear_to_close')` AND a pre-approval letter exists on the lead record.

**Generation:** `POST /api/leads/[id]/pre-approval-letter` — calls Claude Sonnet with the lead's verified income, assets, loan amount, and property type to generate a PDF pre-approval letter. Output via PrimeMind Sign SDK for LO e-signature.

**Borrower portal:** A download button appears: `"Download your pre-approval letter (PDF)"`. It generates a signed URL to the stored PDF, expiring in 24 hours.

**Template:** Include lender name, LO name, NMLS number, borrower name, max loan amount, loan type, expiration date (30 days from issue), standard disclaimer language.

### 4.4 Mobile-First Design

**Requirements:**
- All borrower portal pages must be usable on a 375px viewport with one hand.
- Touch targets minimum 44×44px.
- No horizontal scroll.
- Document upload uses native camera on mobile (allow `capture="environment"` on file inputs).
- Progress bar is visible above the fold on mobile without scrolling.

**Audit:** After implementing, run the portal on Chrome DevTools at iPhone 14 viewport. Every feature must be reachable and functional.

### 4.5 Next Steps in Plain English (AI-Powered)

**UI:** Below the milestone tracker, a `"What happens next"` card shows 2–3 sentences of plain English explaining what the LO and borrower each need to do in the current stage.

**Generation:** Claude Haiku is called once per stage change. Prompt:
```
You are explaining a mortgage process step to a first-time homebuyer.
Current stage: [STAGE]
Outstanding conditions: [COUNT] items
Estimated days remaining at this stage: [DAYS]

Write 2-3 sentences in plain, warm English explaining:
1. What is happening right now in their loan
2. What they need to do (if anything)
3. What to expect next

No jargon. No technical terms. Speak directly to "you."
```

**Caching:** Cache per lead per stage — regenerate only on stage change or condition count change.

### 4.6 Sticky Features — Equity Tracker in Portal

Once a loan closes, the borrower portal does not disappear. It transforms into a permanent home equity dashboard:

- Current estimated home value (DeedMine AVM, refreshed monthly)
- Original loan amount vs. current estimated balance
- Estimated equity amount and equity percentage
- "Would you save money with a refinance today?" panel — compares their rate to current market rates. If the gap is ≥50bps, show a savings estimate and a CTA to contact their LO.
- Annual equity statement download (generated each January, delivered via email)

**This is the retention mechanic.** The borrower has a reason to stay logged in forever. The LO stays top of mind.

---

## PHASE 5 — CONDITIONS LIST ENHANCEMENTS

### 5.1 AI Condition Satisfaction

**Concept:** When a borrower or LO uploads a document, Claude Sonnet reads it and attempts to match it to open conditions. This is the highest-ROI feature in the product.

**API route:** `POST /api/conditions/auto-satisfy`

**Input:** `{ lead_id, document_id }` — the document that was just uploaded.

**Process:**
1. Fetch the open conditions for the lead.
2. Fetch the document content (extract text via Supabase Edge Function using pdf-parse for PDFs, or read directly for text files).
3. Send to Claude Sonnet:

```
You are a mortgage processor reviewing uploaded documents.

Open conditions on this loan:
[LIST_OF_CONDITIONS_WITH_DESCRIPTIONS]

Document content:
[DOCUMENT_TEXT]

For each condition, determine:
- satisfied: true/false
- confidence: "high" | "medium" | "low"
- reasoning: one sentence explaining why

Return JSON: { conditions: [{ condition_id, satisfied, confidence, reasoning }] }
```

4. For conditions where `satisfied: true` AND `confidence: "high"`, auto-mark as `received` with an AI note.
5. For `satisfied: true` AND `confidence: "medium"`, flag for LO review with AI reasoning shown.
6. For `satisfied: false`, leave open.

**Audit trail:** All AI actions log to `condition_events` with `actor_type = 'ai'`, `model = 'claude-sonnet-4-5'`, and the full reasoning JSON.

**UI:** After document upload, show a progress indicator: `"Reviewing your document against 8 open conditions..."`. Then show results with a green/amber/gray badge per condition.

**Conditions Health View:** A dashboard card on the lead record showing a donut chart of condition statuses: Satisfied / Pending Docs / Awaiting Review / Waived. Red if any condition is critical-path and has been open for 5+ days.

### 5.2 Loan-Program-Specific Condition Checklists

**Schema:**
```sql
CREATE TABLE condition_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  loan_program text NOT NULL, -- 'FHA' | 'Conventional' | 'VA' | 'USDA' | 'DSCR' | 'NonQM' | 'Jumbo'
  name text NOT NULL,
  description text NOT NULL,
  phase text NOT NULL CHECK (phase IN ('processing','underwriting','closing','post_closing')),
  is_default boolean DEFAULT true,
  display_order integer DEFAULT 0
);
```

**On lead creation (or when loan type is set):** Auto-populate the conditions list from `condition_templates` where `loan_program` matches the lead's loan type.

**Built-in templates to seed (write migration):**
- FHA: 32 standard conditions (MIP calculation disclosure, FHA case number, appraisal with FHA addendum, etc.)
- Conventional: 28 standard conditions
- VA: 35 conditions (COE, VA appraisal, funding fee, etc.)
- DSCR: 18 conditions (rent roll, lease agreements, entity docs, DSCR calculation worksheet, etc.)

---

## PHASE 6 — COMMISSION / PAYROLL WORKFLOW ENHANCEMENTS

### 6.1 Split Commissions

**Schema:**
```sql
CREATE TABLE commission_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id),
  lo_id uuid NOT NULL REFERENCES users(id),
  split_percentage decimal(5,2) NOT NULL CHECK (split_percentage > 0 AND split_percentage <= 100),
  split_role text NOT NULL CHECK (split_role IN ('primary','referring','co_originator','processor')),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
-- Constraint: sum of all splits for a given lead_id must equal 100
```

**Enforcement:** Add a Postgres function `validate_commission_splits(lead_id)` that checks the sum. Called via trigger on INSERT and UPDATE.

**UI:** On the lead record > Compensation tab: `"Add split"` button. Select LO + percentage + role. System validates splits sum to 100% before allowing save. Each LO party gets their own payroll event at closing.

### 6.2 Override / Manager Comp (Branch Override BPS)

**Schema:**
```sql
CREATE TABLE manager_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  manager_id uuid NOT NULL REFERENCES users(id),
  lo_id uuid NOT NULL REFERENCES users(id), -- which LO's production this manager earns from
  override_bps integer NOT NULL CHECK (override_bps > 0 AND override_bps <= 100), -- basis points
  effective_date date NOT NULL,
  end_date date,
  created_at timestamptz DEFAULT now()
);
```

**CFPB compliance note in code:** `// CFPB Reg Z 12 CFR 1026.36: Override BPS may key on loan AMOUNT only, not on loan terms.`

**At closing:** When `payroll_events` is generated for an LO, also generate a `payroll_events` record for each manager with an active override for that LO. Amount = `loan_amount * override_bps / 10000`.

### 6.3 Clawback Tracking

**Trigger:** Early payoff (loan paid off within 6 months of origination) triggers a clawback event.

**Schema:**
```sql
CREATE TABLE clawback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id),
  lo_id uuid NOT NULL REFERENCES users(id),
  original_comp_amount decimal(12,2) NOT NULL,
  clawback_amount decimal(12,2) NOT NULL,
  clawback_reason text NOT NULL CHECK (clawback_reason IN ('early_payoff','loan_repurchase','fraud_finding','error')),
  clawback_date date NOT NULL,
  recovered_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

**UI:** Payroll dashboard includes a `"Clawbacks"` tab. Shows total amount clawed back, recovered, and outstanding. LO is notified via in-app alert when a clawback is logged.

**Import:** Allow manual clawback entry from LOS data or via CSV import. This is a manual process — no automatic detection unless LOS pushes a loan status change.

### 6.4 Commission Projections

**UI:** On each lead record in `Compensation` tab: `"Projected comp"` card showing:
- Estimated loan amount × LO comp BPS = projected gross comp
- Minus split percentages = net comp per LO
- Projected closing date (from loan estimate)
- `"Confidence: High / Medium / Low"` based on loan stage

**Pipeline total:** On the main compensation dashboard, show a pipeline view of all projected commissions by expected close date. Groupable by LO, by loan type, by month.

### 6.5 1099 / W2 Export

**Year-end export:** `GET /api/payroll/export?year=2025&format=csv` — generates a CSV with:
```
lo_id, lo_name, lo_nmls, ssn_last4 (from LO profile, not borrower), total_comp, loan_count, w2_or_1099
```

**Important:** This references the LO's own tax classification stored in their profile. NOT the borrower's SSN. The field `lo_ssn` is stored encrypted in the `users` table for W2/1099 purposes only.

**Schema addition:**
```sql
ALTER TABLE users ADD COLUMN tax_classification text CHECK (tax_classification IN ('w2','1099'));
ALTER TABLE users ADD COLUMN tax_id_encrypted text; -- AES-256 encrypted at app layer, never shown in UI
```

---

## PHASE 7 — RECRUITING PIPELINE ENHANCEMENTS

### 7.1 Five-Touch Automated Outreach Sequence

**Schema:**
```sql
CREATE TABLE recruiting_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  is_active boolean DEFAULT true
);

CREATE TABLE recruiting_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES recruiting_sequences(id),
  step_number integer NOT NULL,
  delay_days integer NOT NULL, -- days after previous step (0 = same day)
  channel text NOT NULL CHECK (channel IN ('email','sms','linkedin_note')),
  subject text, -- for email
  body_template text NOT NULL, -- supports {{first_name}}, {{current_company}}, {{production_volume}}, {{lo_name}}, {{branch_name}}
  ai_personalize boolean DEFAULT false -- if true, Claude Haiku personalizes the body per recruit
);

CREATE TABLE recruiting_sequence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruit_id uuid NOT NULL REFERENCES recruits(id),
  sequence_id uuid NOT NULL REFERENCES recruiting_sequences(id),
  enrolled_at timestamptz DEFAULT now(),
  enrolled_by uuid NOT NULL REFERENCES users(id),
  current_step integer DEFAULT 1,
  status text DEFAULT 'active' CHECK (status IN ('active','paused','completed','replied','opted_out')),
  completed_at timestamptz
);
```

**Default 5-touch sequence (seed data):**
1. Day 0 — Email: `"[first_name], your production numbers caught my eye"`
2. Day 3 — Email: `"Following up — one question about your comp plan"`
3. Day 7 — SMS: `"Hi [first_name], sent you an email a few days ago about an opportunity at [branch_name]. Worth a 5 min call?"`
4. Day 14 — Email: `"Last touch — comp comparison attached [PDF]"`
5. Day 21 — SMS: `"[first_name], no hard feelings if now isn't the right time. Feel free to reach out anytime."`

**Reply detection:** When a reply comes in (email open webhook from Resend, or inbound SMS from Twilio), mark enrollment as `replied` and notify the recruiter.

### 7.2 Production Data Import

**Scope:** Allow branch managers to upload a CSV of recruits' self-reported or publicly available production data.

**CSV format:** `nmls_number, volume_12mo, unit_count, top_loan_types, avg_loan_amount`

**After upload:**
1. Validate NMLS numbers against CredifyID API (check license is active).
2. Populate `recruits.reported_volume` and `recruits.reported_units`.
3. Trigger `comp_projection` calculation: `projected_comp = reported_volume * avg_comp_bps / 10000`.

**UI:** On recruit card, show `"Reported: $12.4M / 42 units (self-reported)"` with a disclaimer.

### 7.3 90-Day Ramp Tracking

**Schema:**
```sql
CREATE TABLE lo_ramp_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lo_id uuid NOT NULL REFERENCES users(id),
  start_date date NOT NULL,
  milestone_30_day_target decimal(12,2),
  milestone_60_day_target decimal(12,2),
  milestone_90_day_target decimal(12,2),
  milestone_30_actual decimal(12,2),
  milestone_60_actual decimal(12,2),
  milestone_90_actual decimal(12,2),
  ramp_notes text,
  manager_id uuid REFERENCES users(id)
);
```

**UI:** After a recruit is marked `hired`, a ramp card appears on their profile. Manager sets 30/60/90-day production targets. Actual volume is pulled from closed loans in the system. Green/amber/red indicator against each milestone.

### 7.4 Interview Scheduling

**Integration:** Calendly-style availability picker embedded in AshleyIQ. Branch manager sets available interview slots. Recruit receives a link to self-schedule.

**Implementation:** Use Supabase + a simple availability + booking table. No external Calendly dependency needed.

**Schema:**
```sql
CREATE TABLE interview_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES users(id),
  available_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  duration_minutes integer DEFAULT 30,
  is_booked boolean DEFAULT false
);

CREATE TABLE interview_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  availability_id uuid NOT NULL REFERENCES interview_availability(id),
  recruit_id uuid NOT NULL REFERENCES recruits(id),
  booked_at timestamptz DEFAULT now(),
  meeting_link text, -- Zoom/Google Meet link added by manager
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','no_show','rescheduled'))
);
```

**Recruit-facing:** A public page `/recruit/schedule/[token]` (token-authenticated, no login required) shows available slots and allows booking.

---

## PHASE 8 — LOS INTEGRATION ENHANCEMENTS

### 8.1 Optimal Blue Integration (Real Lender Pricing)

**How to get real pricing data from lenders:**

Optimal Blue (now ICE Mortgage Technology) is the industry-standard PPE (Product, Pricing & Eligibility) engine used by 95%+ of mortgage lenders. To integrate:

1. **Apply to the Optimal Blue Integration Partner program:** https://www.optimalblue.com/become-a-partner/ — Select "Technology Partner." Sign the NDA and technical agreement.
2. **Credentials you receive:** `OB_CLIENT_ID`, `OB_CLIENT_SECRET`, `OB_SUBSCRIBER_ID` — add to `.env.local`.
3. **Sandbox:** `https://api-sandbox.optimalblue.com` — available while awaiting production approval.
4. **Alternative:** **Polly** (polly.io) has a more developer-friendly API with faster partner onboarding. Recommend applying to both. Polly env vars: `POLLY_API_KEY`, `POLLY_LENDER_ID`.

**API route:** `POST /api/integrations/optimal-blue/pricing`

```typescript
// lib/integrations/optimalBlue.ts
export async function getPricing(params: OBPricingRequest): Promise<OBPricingResponse> {
  // TODO: set OB_CLIENT_ID, OB_CLIENT_SECRET, OB_SUBSCRIBER_ID env vars
  // OB uses OAuth 2.0 client_credentials flow
  const token = await getOBAccessToken();
  
  const response = await fetch(`${process.env.OB_BASE_URL}/v1/pricing`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Subscriber-Id': process.env.OB_SUBSCRIBER_ID!,
    },
    body: JSON.stringify({
      loanInformation: {
        baseLoanAmount: params.loanAmount,
        loanPurpose: params.loanPurpose, // 'Purchase' | 'Refinance' | 'CashOut'
        loanType: params.loanType, // 'Conventional' | 'FHA' | 'VA' | 'USDA'
        amortizationType: 'Fixed',
        loanTermMonths: params.termMonths, // 360 | 180
        propertyType: params.propertyType,
        propertyState: params.state,
        ltv: params.ltv,
        fico: params.ficoScore,
        occupancy: params.occupancy, // 'PrimaryResidence' | 'SecondHome' | 'InvestmentProperty'
      }
    })
  });
  
  return response.json();
}
```

**CFPB compliance note:** `// Reg Z 12 CFR 1026.36: Rates shown are par rates from lender pricing. LO comp is additive and must not vary by loan terms.`

**UI display:** In the lead record, a `"Rate Engine"` tab shows:
- Three product scenarios (0 points, 0.5 points, -0.5 points)
- Rate, APR, monthly payment for each
- `"Rates as of [timestamp]"` freshness indicator
- Refresh button (costs 1 API call per click — log to `pricing_pull_events`)
- Clearly labeled: `"For illustrative purposes — not a rate lock or commitment"`

**If OB credentials not set:** Show a gray panel: `"Rate engine not configured — contact your admin"`. Never show fake rates.

### 8.2 Dual AUS (DU + LP Simultaneously) + Findings Storage

**API routes:**
- `POST /api/integrations/aus/submit-du` — submits to Fannie Mae Desktop Underwriter
- `POST /api/integrations/aus/submit-lp` — submits to Freddie Mac Loan Product Advisor
- `POST /api/integrations/aus/submit-both` — fires both in parallel, waits for both responses

**Schema:**
```sql
CREATE TABLE aus_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id),
  aus_type text NOT NULL CHECK (aus_type IN ('DU','LP')),
  submitted_at timestamptz DEFAULT now(),
  submitted_by uuid REFERENCES users(id),
  case_id text, -- AUS-assigned case number
  recommendation text NOT NULL, -- 'Approve/Eligible' | 'Refer' | 'Refer with Caution' | 'Out of Scope'
  risk_class text,
  doc_class text,
  conditions jsonb DEFAULT '[]', -- array of AUS-generated conditions with codes and descriptions
  raw_response jsonb, -- full AUS response for audit
  lo_sync_event_id uuid REFERENCES los_sync_events(id)
);
```

**Findings UI:** Side-by-side comparison when both DU and LP are run. Highlight differences. Recommendation badge (green for Approve/Eligible, amber for Refer, red for Refer with Caution).

**Auto-import conditions:** When AUS findings come back, offer: `"Import [18] conditions from DU findings into your conditions list?"` One click imports them as a batch.

### 8.3 E-Sign Disclosures via PrimeMind Sign

**Integration:** Use `@primemind/sign-react` SDK. Import from the internal npm workspace.

**TRID requirement:** Initial Loan Estimate (LE) must be delivered within 3 business days of application. System must:
1. Detect when a full 1003 application is completed.
2. Generate the LE from loan parameters.
3. Fire a PrimeMind Sign package to the borrower's email within 72 business hours.
4. Log to `disclosure_events` (INSERT-only) with `disclosure_type = 'initial_LE'`, `sent_at`, `signed_at`, `method = 'esign'`.

**API:** `POST /api/disclosures/send-le` — generates LE PDF, packages with Sign SDK, sends.

**TRID countdown UI:** After application received, show a `"LE due in 2 days 14 hours"` countdown on the lead record. Red when under 24 hours.

---

## PHASE 9 — CALL REPORTS ENHANCEMENTS

### 9.1 Fallout Analysis Report

**Definition:** Where do loans die, and why?

**Data source:** `lead_events` where `event_type = 'status_changed'` AND `new_value IN ('withdrawn','denied','dead')`.

**Report structure:**
- Total fallout by stage (bar chart)
- Top 5 fallout reasons (from `lead.fallout_reason` field — add if not present)
- Fallout rate by loan type
- Fallout rate by lead source
- Fallout rate by LO (with comparison to team average)
- AI diagnosis (Claude Sonnet): `"Your FHA fallout increased 34% this month — 8 of 12 FHA denials were credit-related. Consider adding a credit review milestone at application."`

**Schema addition:**
```sql
ALTER TABLE leads ADD COLUMN fallout_reason text; -- 'credit_denial' | 'property_condition' | 'income_insufficient' | 'withdrew_bought_elsewhere' | 'rate_sensitivity' | 'employment_change' | 'appraisal_gap' | 'other'
ALTER TABLE leads ADD COLUMN fallout_notes text;
```

### 9.2 Pull-Through Analysis

**Definition:** What percentage of leads at each stage eventually close?

**Calculation:** For each stage, compute: `loans_that_closed / loans_that_entered_this_stage * 100`.

**Breakdown by:** LO, loan type, lead source, property state.

**UI:** Funnel visualization showing pull-through at each stage. Clicking a stage shows the leads that dropped off.

### 9.3 Market Share Report

**Data:** Aggregate production data from closed loans in the system (by county, by zip code, by loan type). Compare to available HMDA/CFPB public data if imported.

**UI:** Map view (Mapbox or Leaflet) showing closed loan count by zip code with heat map overlay. Table view with sortable columns.

**Note:** This uses only internal loan data — no external market share API required.

### 9.4 Compare Periods Toggle

**Implementation:** Add a date range picker to ALL reports with a `"vs. previous period"` toggle. When enabled, show side-by-side columns: current period / previous period / delta (with green/red arrows).

**Global:** This applies to every report view in the system. Build as a reusable `<ComparisonDatePicker>` component.

### 9.5 Scheduled Report Delivery

**Schema:**
```sql
CREATE TABLE scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  report_type text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  day_of_week integer, -- for weekly: 0-6
  day_of_month integer, -- for monthly: 1-28
  send_time time NOT NULL DEFAULT '08:00',
  recipients uuid[] NOT NULL, -- array of user IDs
  filters jsonb DEFAULT '{}',
  last_sent_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id)
);
```

**Delivery:** Supabase pg_cron triggers edge function `deliver-scheduled-reports` at the configured time. Generates PDF report and sends via Resend.

### 9.6 Investor Portfolio Report

**Definition:** A report showing all DSCR / commercial / investment property loans for a single borrower or entity across their portfolio.

**Data source:** `investor_entities` table (see Phase 20 below — DSCR/Investor module) joined to `leads` and `property_valuations`.

**Report output:**
- Entity name(s) and aliases
- Total portfolio loan count
- Total loan balance outstanding
- Aggregate DSCR across portfolio
- Properties at risk (DSCR < 1.00)
- Equity by property (AVM - loan balance)
- YoY equity change

### 9.7 CFPB LAR Export

**HMDA LAR format:** Generate a pipe-delimited text file per CFPB spec for annual HMDA submission.

**Fields:** All standard LAR fields as required by Regulation C / HMDA.

**UI:** `Reports > HMDA > Export LAR` — select year, review record count, download file.

**Validation:** Before export, flag any records with missing required fields. Show a count of incomplete records with links to fix them.

---

## PHASE 10 — EQUITY TRACKER ENHANCEMENTS

### 10.1 Refi Opportunity Scoring

**Schema:**
```sql
ALTER TABLE loans ADD COLUMN refi_opportunity_score integer CHECK (refi_opportunity_score BETWEEN 0 AND 100);
ALTER TABLE loans ADD COLUMN refi_score_updated_at timestamptz;
ALTER TABLE loans ADD COLUMN refi_score_factors jsonb;
```

**Scoring factors:**
- Rate gap (current market rate - borrower's rate): worth up to 40 points
- Equity available (LTV < 80%): worth up to 25 points
- Time since origination (>24 months preferred): worth up to 15 points
- Remaining term (30-year with 25+ years left = more benefit): worth up to 10 points
- Loan type (FHA with MIP = higher score; may qualify for conventional refi): worth up to 10 points

**Recalculation:** Nightly cron for all active loans. If score goes from <70 to ≥70, fire a `refi_opportunity_alert` notification.

### 10.2 Rate Gap Alert

**Trigger:** When the weekly Freddie Mac PMMS rate (fetched from `https://www.freddiemac.com/pmms/archive.html` — parse or use Freddie API) drops ≥50bps below a borrower's note rate, fire an alert.

**Delivery:**
- In-app notification to LO: `"5 past clients may qualify for a lower rate — view them"`
- Email to LO with lead names and estimated monthly savings
- The LO can trigger an outreach to the borrower directly from the alert

**Schema:**
```sql
CREATE TABLE rate_gap_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id),
  lo_id uuid NOT NULL REFERENCES users(id),
  borrower_rate decimal(6,4) NOT NULL,
  current_market_rate decimal(6,4) NOT NULL,
  rate_gap decimal(6,4) NOT NULL,
  estimated_monthly_savings decimal(10,2),
  alert_fired_at timestamptz DEFAULT now(),
  lo_actioned_at timestamptz,
  lo_action text CHECK (lo_action IN ('outreach_sent','dismissed','snoozed'))
);
```

### 10.3 Home Value Trend

**UI:** On the equity tracker card for a closed loan, show a sparkline of the home's AVM value over time. Data points come from monthly DeedMine AVM pulls stored in `property_valuations`.

**Y-axis:** Home value in dollars. Overlay a horizontal line at the original purchase price. Show the equity gap (shaded area between current value and loan balance).

### 10.4 Cash-Out Scenario Modeler

**UI:** On the equity tracker: `"Model a cash-out refinance"` expandable panel.

**Inputs:** 
- Desired cash-out amount (slider)
- New loan term (dropdown: 30yr / 25yr / 20yr / 15yr)
- Assumed rate (pre-populated from OB if connected, otherwise manual)

**Outputs:**
- New loan amount
- New monthly payment
- Change in monthly payment vs. current
- Total interest cost comparison
- Break-even point (months)

**CTA:** `"Start an application"` — creates a new lead pre-populated with the scenario data.

### 10.5 Annual Equity Report to Borrower

**Cron:** Every January 2nd, generate an annual equity report for all loans that closed in prior years.

**Content:**
- Year in review: home value change, equity gained, LTV improvement
- Comparison to national housing market performance
- Refi opportunity callout (if score ≥ 70)
- Contact LO CTA

**Delivery:** Resend email from the LO's name with the borrower's personalized report attached as PDF. LO is CC'd.

---

## PHASE 11 — CREDIT REPAIR ENHANCEMENTS

### 11.1 Credit Score Simulator

**UI:** In the credit repair section of a lead, a `"Score simulator"` panel.

**Inputs (user adjusts sliders):**
- Pay down [card name] to $[X] (shows current balance, user sets target)
- Pay off [collection account] for $[amount]
- Add [authorized user account] (positive tradeline)
- Remove [disputed item] if successful

**Calculation:** Use FICO simulation logic (approximate, with disclaimer):
- Credit utilization: each 1% reduction in utilization ≈ 2–3 points
- Paid collections: ≈ 15–25 points depending on age and amount
- Positive tradeline: ≈ 10–20 points if thin file

**Output:** `"Estimated score improvement: +34 points | New estimated score: 698 | Loan program eligibility: Conventional"`. Always label as `"Estimate — actual improvement may vary"`.

**IMPORTANT:** This is a lead qualification tool, NOT a credit counseling service for a fee. CROA applies if a fee is charged. If `credit_repair_service_enabled = true` on the tenant, enforce CROA compliance gate.

### 11.2 Score Improvement Roadmap (AI-Generated)

**API:** `POST /api/leads/[id]/credit-roadmap`

**Claude Haiku prompt:**
```
You are a mortgage loan officer helping a borrower improve their credit score to qualify for a home loan.

Current credit report summary:
- Scores: EQ [score], EX [score], TU [score]
- Derogatory items: [list]
- High utilization accounts: [list with balances and limits]
- Thin file indicators: [yes/no]
- Collections: [list with amounts and ages]

Target score needed: [score]
Target timeline: [months]

Generate a ranked action plan with:
1. Action (specific and actionable)
2. Estimated point gain
3. Estimated cost to borrower
4. Timeline to see improvement
5. Priority (do this first / do this next / do this last)

Format as JSON array. Maximum 7 actions. Be specific with dollar amounts. No vague advice.
```

**UI:** Roadmap displayed as a numbered checklist with progress checkboxes. Borrower can see this in their portal. LO can mark items complete.

### 11.3 Rapid Rescore Integration

**Partner:** Integrate with a rapid rescore vendor (Credit Plus, CoreLogic Credco, or similar). Rapid rescore is a service where a credit bureau verifier submits a correction directly to the bureaus within 3–5 business days.

**API route:** `POST /api/credit/rapid-rescore`

**Flow:**
1. LO selects the disputed item and the supporting documentation.
2. System generates a rescore request package.
3. Package is submitted to the rescore vendor API.
4. Vendor returns a new credit report within 3–5 business days.
5. New scores are updated on the lead record with a `credit_pull_events` entry.

**Cost:** Typically $25–$75 per bureau per item. Charge to the tenant's account via Stripe usage metering.

**Note:** Add `RAPID_RESCORE_VENDOR_API_KEY` env var. TODO: sign up at creditplus.com or corecredco.com.

### 11.4 30-Day Dispute Timer

**Schema:**
```sql
CREATE TABLE credit_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id),
  bureau text NOT NULL CHECK (bureau IN ('equifax','experian','transunion')),
  disputed_item_type text NOT NULL, -- 'collection' | 'late_payment' | 'error' | 'identity_theft'
  disputed_item_description text NOT NULL,
  dispute_letter_sent_at date NOT NULL,
  response_due_date date GENERATED ALWAYS AS (dispute_letter_sent_at + INTERVAL '30 days') STORED,
  response_received_at date,
  outcome text CHECK (outcome IN ('deleted','corrected','verified','no_response')),
  escalation_sent boolean DEFAULT false
);
```

**Alerts:** 5 days before `response_due_date`, send an alert to the LO: `"Dispute response due in 5 days — follow up with [bureau]."` If response not received by due date, offer to generate an escalation letter.

### 11.5 Credit Progress Tracking in Borrower Portal

**UI:** In the borrower portal, a `"Credit Journey"` card visible when the lead is in `credit_repair` stage.

**Shows:**
- Starting score vs. current score (after each new pull)
- Active disputes count and their status
- Completed roadmap items
- Target score and progress bar toward it
- Estimated timeline to qualification

**Update trigger:** Each time a new soft pull is completed, update the portal card.

---

## PHASE 12 — CAMPAIGNS / OUTREACH ENHANCEMENTS

### 12.1 Two-Way SMS Inbox

**Architecture:** Twilio webhook on inbound SMS → Supabase Edge Function → match phone number to lead → insert into `sms_messages` → notify LO.

**Schema:**
```sql
CREATE TABLE sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id), -- NULL if number not matched to a lead
  direction text NOT NULL CHECK (direction IN ('outbound','inbound')),
  from_number text NOT NULL,
  to_number text NOT NULL,
  body text NOT NULL,
  twilio_sid text,
  sent_at timestamptz DEFAULT now(),
  read_by_lo_at timestamptz,
  ai_draft_reply text -- Claude Haiku pre-generates a reply draft for inbound messages
);
```

**AI reply drafting:** When an inbound SMS arrives, Claude Haiku generates a draft reply based on the message context and the lead's loan stage. The LO sees the draft in the inbox and can send it with one click or edit it.

**UI:** A global `SMS Inbox` in the left nav. Unread count badge. Messages threaded by phone number. Sending from here uses the LO's assigned Twilio number. All TCPA consent checks enforced before any outbound message.

### 12.2 & 12.3 If/Then Drip Sequences (with Branching Logic)

**Schema:**
```sql
CREATE TABLE campaign_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  trigger_event text NOT NULL, -- 'lead_created' | 'application_submitted' | 'stage_changed' | 'rate_lock_expired' | 'anniversary' | 'rate_gap_alert' | 'manual'
  trigger_condition jsonb -- e.g. {"loan_type": "FHA"} — additional filter
);

CREATE TABLE campaign_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES campaign_sequences(id),
  step_number integer NOT NULL,
  delay_hours integer NOT NULL DEFAULT 0,
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  subject text, -- email only
  body_template text NOT NULL,
  condition_field text, -- if not null, evaluate a branch
  condition_operator text, -- 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains'
  condition_value text,
  true_branch_step integer, -- if condition is true, jump to this step number
  false_branch_step integer -- if condition is false, jump to this step number
);
```

**Example branch:** After step 2 (email sent), check `lead.stage == 'application'`. If true, skip the next nurture step and send a `"Congrats on completing your application"` message. If false, continue nurture sequence.

### 12.4 Co-Marketing with Real Estate Partners (Partner Portal)

**Concept:** LOs invite any referral partner — real estate agents, builders, financial advisors, insurance agents, title reps — via a simple invite link. Partners get a co-branded landing page that includes the LO's contact info and a `"Get pre-approved with [LO name]"` CTA. Partners can see which of their referred clients are in the LO's pipeline (with client permission). No CLOSA account required — any partner, any source.

**Partner portal URL:** `/partners/[partner_token]` — token-authenticated, no login required.

**Schema:**
```sql
CREATE TABLE partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  lo_id uuid NOT NULL REFERENCES users(id),
  partner_type text NOT NULL CHECK (partner_type IN ('realtor','builder','financial_advisor','insurance_agent')),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text,
  portal_token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  status text DEFAULT 'invited' CHECK (status IN ('invited','active','inactive'))
);

CREATE TABLE partner_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id),
  lead_id uuid NOT NULL REFERENCES leads(id),
  referral_type text NOT NULL CHECK (referral_type IN ('agent_to_lo','lo_to_agent')),
  created_at timestamptz DEFAULT now()
);
```

**Agent portal view:** Shows all buyers they've referred, their current loan stage (no dollar amounts), and an estimated close date. A simple "how can I help" contact CTA to the LO.

### 12.5 Campaign Analytics

**Schema:**
```sql
CREATE TABLE campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_enrollment_id uuid NOT NULL,
  step_id uuid NOT NULL REFERENCES campaign_sequence_steps(id),
  lead_id uuid NOT NULL REFERENCES leads(id),
  event_type text NOT NULL CHECK (event_type IN ('sent','delivered','opened','clicked','replied','bounced','opted_out','converted')),
  occurred_at timestamptz DEFAULT now(),
  metadata jsonb -- e.g. {click_url, reply_snippet}
);
-- INSERT-only RLS
```

**Report view:** Per campaign: sent / open rate / click rate / reply rate / converted (application submitted). Compare campaigns side by side.

### 12.6 Rate Alert Opt-In

**Concept:** Any borrower (past client or prospect) can opt in to receive an alert when mortgage rates drop below their personalized threshold.

**Schema:**
```sql
CREATE TABLE rate_alert_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id),
  email text NOT NULL,
  phone text,
  current_rate decimal(6,4), -- if existing borrower
  alert_threshold decimal(6,4), -- alert when rate drops to this level
  loan_type text DEFAULT 'Conventional',
  opt_in_at timestamptz DEFAULT now(),
  opt_in_ip text NOT NULL,
  opt_in_consent_language text NOT NULL,
  last_alert_sent_at timestamptz,
  is_active boolean DEFAULT true
);
-- INSERT-only for opt_ins and opt_outs tables (separate)
```

**Delivery:** Weekly rate check. If PMMS drops ≤ threshold, send email/SMS: `"Rates just dropped to [X]% — this could save you $[amount]/month. [CTA]"`

---

## PHASE 13 — PARTNER PORTAL: CONDITION PACKAGE FOR AGENTS

**Feature:** When a borrower is in underwriting, the LO can generate a `"Condition Package"` — a filtered, agent-safe summary of what's outstanding that could affect the closing timeline.

**What it shows:** Only conditions that are process-related (not income/credit conditions that are confidential). Example: `"Appraisal ordered — expected 7 days"`, `"Final walkthrough confirmation needed"`, `"Closing disclosure sent to buyer"`.

**Generation:** `POST /api/partners/[partner_id]/condition-package` — takes the lead, filters conditions by `is_agent_visible = true`, generates a PDF summary.

**Schema addition:**
```sql
ALTER TABLE conditions ADD COLUMN is_agent_visible boolean DEFAULT false;
```

**Agent portal display:** A `"Loan status summary"` PDF download button on the agent's portal view of a buyer's loan.

---

## PHASE 14 — AD / SOCIAL MEDIA CENTER

**New module:** `app/(dashboard)/marketing/social/` — the LO's personal marketing hub.

**Features:**

### 14.1 Rate Sheet Generator
- **Input:** Pull current rates from OB (if connected) or manual rate entry
- **Output:** Branded rate flyer as PNG/PDF — formatted with PrimeMind brand colors and LO headshot/contact info
- **Templates:** 3 layouts (clean/minimal, bold/highlighted, detailed comparison table)
- **Auto-post:** One-click share to Facebook Business, Instagram, LinkedIn (OAuth via respective APIs)

### 14.2 Listing Flyer Co-Marketing
- **Input:** MLS listing number or property address + LO contact info
- **Output:** Co-branded `"Get pre-approved"` flyer with property photo placeholder
- **Distribution:** Send to agent partner (via partner portal) or download for LO use

### 14.3 Content Calendar
- **Pre-populated content ideas for mortgage LOs:** educational posts, market updates, testimonial prompts, rate announcements
- **Cadence:** 3x/week minimum recommended
- **AI copy generation:** LO clicks a content idea, Claude Haiku writes a caption in the LO's configured tone (professional / conversational / educational)
- **Scheduled posts:** Set post time and connect social accounts

### 14.4 LinkedIn Outreach Composer
- **For recruiting and referral partner prospecting**
- **Input:** Prospect's name and role
- **Output:** Personalized LinkedIn note drafted by Claude Haiku (< 300 characters for connection request)

**Schema:**
```sql
CREATE TABLE social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lo_id uuid NOT NULL REFERENCES users(id),
  platform text NOT NULL CHECK (platform IN ('facebook','instagram','linkedin','twitter')),
  content text NOT NULL,
  image_url text,
  scheduled_at timestamptz,
  posted_at timestamptz,
  platform_post_id text,
  status text DEFAULT 'draft' CHECK (status IN ('draft','scheduled','posted','failed'))
);
```

---

## PHASE 15 — TRAINING CENTER

**New module:** `app/(dashboard)/training/` — an internal learning management system (LMS) for LOs and processors.

### 15.1 Course Library
**Pre-built courses (seed content):**
- TRID / RESPA Overview (10 min)
- TCPA & SMS Compliance (8 min)
- FHA Loan Requirements (15 min)
- VA Loan Eligibility (12 min)
- DSCR & Investment Property Loans (20 min)
- AshleyIQ Platform Overview (30 min, auto-updated when features change)
- CFPB LO Comp Rule (Reg Z 12 CFR 1026.36) — mandatory for all LOs

**Schema:**
```sql
CREATE TABLE training_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid, -- NULL = platform-wide courses
  title text NOT NULL,
  description text,
  content_type text NOT NULL CHECK (content_type IN ('video','article','quiz','mixed')),
  content_url text, -- for video
  content_body text, -- for article (markdown)
  duration_minutes integer,
  is_mandatory boolean DEFAULT false,
  mandatory_for_roles text[] DEFAULT '{}', -- ['lo','processor','manager']
  passing_score integer DEFAULT 80,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE training_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  course_id uuid NOT NULL REFERENCES training_courses(id),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  score integer,
  passed boolean,
  attempts integer DEFAULT 1
);
```

### 15.2 Quiz Engine
**Multiple choice questions per course.** Pass/fail with required passing score. Retake allowed after 24 hours.

### 15.3 Compliance Certification Tracking
**For mandatory courses:** Show compliance status per LO in the manager dashboard: `"12/15 LOs have completed TCPA training"`. Alert when certification is expiring (annual recertification).

### 15.4 New LO Onboarding Path
**Automated onboarding sequence for new hires:**
1. Day 1: Platform tour video + account setup checklist
2. Day 2: Compliance courses (CFPB, TCPA, RESPA)
3. Day 5: Product training (FHA/VA/Conventional/DSCR)
4. Day 10: First supervised loan walkthrough

**Manager dashboard:** Shows each new LO's onboarding progress with completion percentage.

---

## PHASE 16 — PROCESSOR SUITE

**New role-based view:** `app/(dashboard)/processor/` — visible only to users with `role = 'processor'`.

**The processor sees a different interface than the LO.** The LO manages relationships. The processor manages files.

### 16.1 File Pipeline Board
**Kanban columns:** Processing → Submitted to UW → Conditionally Approved → Clear to Close → Closing

**Each card shows:**
- Borrower name + loan type
- Open condition count (red badge if >5)
- Days in current status
- Next required action (AI-generated, one line)
- LO name (processor may handle multiple LOs)

### 16.2 Conditions Workflow
**Processor-optimized conditions view:**
- Filter by: needs docs / docs received needs review / submitted to UW / cleared
- Bulk actions: mark multiple conditions received, request docs via SMS/email
- Condition aging: color-coded by days outstanding (green <3, amber 3-7, red >7)
- Document previewer: open docs side by side with condition description without leaving the page

### 16.3 Doc Stacking
**Feature:** Processor can drag-and-drop documents into a `"UW package"` and reorder them into the correct stacking order for their underwriter.

**Output:** A single merged PDF of the complete UW package in stacking order, downloadable in one click.

**Stacking order templates:** Configurable per loan type (FHA stack vs. Conventional stack vs. VA stack). Admin can define and save templates.

### 16.4 UW Submission Checklist
**Before submitting to underwriting, a system-enforced checklist:**
- Application signed by all borrowers ✓
- Initial disclosures delivered and signed ✓
- Soft pull / credit report on file ✓
- Income documentation complete ✓
- Asset documentation complete ✓
- Property documentation complete ✓
- AUS run and findings on file ✓

**Each item has a green/red indicator.** System blocks submission if any required item is red. Processor can override with a justification note (logged to audit trail).

### 16.5 Processor Pipeline Report
**Daily report for processor:** My files / status / days in UW / outstanding conditions count / projected close dates. Exportable as CSV.

---

## PHASE 17 — INCOME CALCULATORS

### 17.1 Fannie Mae / Freddie Mac Income Calculator (Residential)

**This is one of the most time-consuming parts of mortgage processing — automated it completely.**

**Calculator types:**
- **W-2 Wage Income:** YTD pay stub / prior year W-2s / 24-month average
- **Self-Employed (1084 — Fannie / 91 — Freddie):** Schedule C, S-Corp (1120S), Partnership (1065), K-1 income — calculates qualifying income per agency guidelines
- **Rental Income (Schedule E):** Net rental income calculation per Fannie/Freddie guidelines (75% of gross rent minus expenses)
- **Social Security / Pension:** Gross-up calculation (125% of non-taxable SS income)
- **Bonus/Commission:** 24-month average with continuance probability check

**UI:** `Leads > [Lead] > Income Analysis` tab with a dropdown for income type. Side-by-side Fannie vs. Freddie calculation when they differ.

**Output:** A formatted income worksheet PDF that can be uploaded to the conditions list directly.

**Schema:**
```sql
CREATE TABLE income_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id),
  borrower_type text NOT NULL CHECK (borrower_type IN ('primary','co_borrower')),
  income_type text NOT NULL, -- 'w2' | 'self_employed_sole_prop' | 'self_employed_scorp' | 'rental' | 'social_security' | 'pension' | 'bonus_commission'
  agency text NOT NULL CHECK (agency IN ('fannie','freddie','both')),
  input_data jsonb NOT NULL, -- all raw inputs
  calculated_income decimal(12,2) NOT NULL, -- qualifying monthly income
  calculation_notes text,
  calculated_by uuid REFERENCES users(id),
  calculated_at timestamptz DEFAULT now()
);
```

### 17.2 DSCR Calculator (Expand Existing)

**The existing DSCR calculator should be expanded to handle:**
- Multiple properties in a portfolio (aggregate DSCR)
- Lease-up scenarios (property is not yet rented — use market rent estimate from DeedMine)
- Short-term rental income (AirBnB — use 75% of trailing 12-month average per most DSCR lender overlays)
- Mixed-use (split between residential and commercial portions)

**Formula reminder:** `DSCR = Gross Monthly Rent / PITIA`

Where `PITIA = Principal + Interest + Taxes + Insurance + HOA (if any)`

---

## PHASE 18 — SMART 1003 (CONDITIONAL FIELD POPULATION)

**This is the intelligence differentiator.** The 1003 is a 10-page, 250-field form. Most LOs only need 40–80 fields depending on loan type. AshleyIQ should feel like it knows what to ask.

### Conditional Field Rules

**Implement via a `form_conditional_rules` system.** When the borrower or LO changes a field value, evaluate all rules and show/hide dependent field groups.

**Core conditional rules to implement:**

```typescript
const conditionalRules = [
  // Loan purpose
  { trigger: 'loan_purpose', value: 'Purchase', show: ['purchase_contract_signed', 'purchase_price', 'listing_agent_name'] },
  { trigger: 'loan_purpose', value: 'Refinance', show: ['current_loan_balance', 'current_rate', 'reason_for_refinance'] },
  { trigger: 'loan_purpose', value: 'CashOut', show: ['current_loan_balance', 'requested_cash_out', 'cash_out_purpose'] },
  
  // Property type
  { trigger: 'property_type', value: 'Investment', show: ['rental_income_monthly', 'property_manager_name', 'lease_expiration_date', 'entity_name'] },
  { trigger: 'property_type', value: '2-4Unit', show: ['rental_income_per_unit', 'units_occupied', 'rental_income_monthly'] },
  
  // Loan type
  { trigger: 'loan_type', value: 'VA', show: ['va_service_dates', 'va_certificate_type', 'va_disability_status', 'va_funding_fee_exempt'] },
  { trigger: 'loan_type', value: 'FHA', show: ['fha_case_number', 'fha_connection_id', 'energy_efficient_mortgage'] },
  { trigger: 'loan_type', value: 'DSCR', show: ['dscr_entity_name', 'dscr_entity_type', 'rental_income_verified', 'dscr_no_income_verification'] },
  
  // Employment type
  { trigger: 'employment_type', value: 'SelfEmployed', show: ['business_name', 'business_start_date', 'business_ownership_percentage', 'business_type', 'years_self_employed'] },
  { trigger: 'employment_type', value: 'Retired', show: ['retirement_income_source', 'pension_start_date', 'ss_income_monthly'] },
  
  // Citizenship
  { trigger: 'citizenship', value: 'NonPermanentResident', show: ['visa_type', 'visa_expiration', 'employment_authorization_card'] },
  
  // Co-borrower
  { trigger: 'has_co_borrower', value: true, show: ['co_borrower_section'] }, // entire co-borrower section
  
  // Credit events
  { trigger: 'has_bankruptcy', value: true, show: ['bankruptcy_type', 'bankruptcy_discharge_date', 'bankruptcy_dismissal_date'] },
  { trigger: 'has_foreclosure', value: true, show: ['foreclosure_date', 'foreclosure_property_address'] },
];
```

**Implementation:**
1. Build a `useConditionalForm(rules, formValues)` hook that returns `{ visibleFields: Set<string>, hiddenFields: Set<string> }`.
2. All 1003 field components are wrapped in a `<ConditionalField fieldKey="...">` HOC that checks visibility.
3. Hidden fields are excluded from submission but their values are preserved in state (in case the user changes back).
4. Show a subtle `"[+4 more fields for investment properties]"` expansion hint when there are hidden relevant fields.

### Smart Suggestions While Filling

**While the LO or borrower is filling out the 1003, Claude Haiku provides inline suggestions:**

- If credit score < 620: `"⚠️ This score may limit options to FHA 203k or portfolio programs. Would you like to see the credit improvement pathway?"`
- If LTV > 80% and loan type = Conventional: `"PMI will apply at this LTV. PMI cost: ~$[calculated amount]/month. Lender-paid PMI option available."`
- If employment gap > 6 months in last 2 years: `"Underwriters will ask about the employment gap — consider adding a letter of explanation to the conditions list now."`
- If self-employed and shows a loss on Schedule C: `"Self-employed borrowers showing a business loss may be declined by agency guidelines. Would you like to see non-QM / bank statement program options?"`

---

## PHASE 19 — BUYER EXPERIENCE ENHANCEMENTS

**Additional features that enhance the borrower's experience and keep them engaged with their LO through the life of the loan:**

### 19.1 Closing Countdown Timer
**In the borrower portal:** A prominent countdown: `"14 days until your estimated closing"`. Updates dynamically based on estimated close date. Balloons animation on closing day.

### 19.2 Moving Checklist (Post-Close)
**After loan closes:** A personalized moving checklist is auto-sent to the borrower:
- Forward mail (USPS link)
- Update voter registration
- Notify employer of address change
- Transfer utilities (with local utility lookup by zip code)
- Update auto/home insurance
- File homestead exemption (if applicable by state)
- Set up HOA portal (if applicable)

**This is a retention play.** The LO's name is on every step.

### 19.3 First Payment Reminder
**30 days before first mortgage payment is due:** Automated email/SMS to borrower with payment amount, due date, and a link to their loan servicer's payment portal. LO's contact info is prominent.

### 19.4 Annual Mortgage Review Invitation
**Every year on the loan anniversary:** LO receives an alert to reach out to the borrower for an annual review. Template email auto-drafted by Claude Haiku based on: current rate vs. market, equity gained, credit score improvement.

### 19.5 Referral Program
**Post-close:** Borrower receives a `"Know someone buying a home?"` email from the LO. Personalized referral link that routes to the LO's POS with a `referral_code` pre-filled. Referral tracked in `partner_referrals` table.

### 19.6 Pre-Approval Certificate Sharing
**Borrowers can share their pre-approval status directly with their real estate agent** via a digital certificate page (not a PDF — a real URL like `/certificate/[token]`):
- Shows: Approved for up to $[amount], loan type, LO name/NMLS, expiration date
- Does NOT show: income, credit score, assets
- Agent can verify it's real and up-to-date without calling the LO

---

## PHASE 20 — INVESTOR MODULE (DSCR / COMMERCIAL ENHANCEMENTS)

**This is NOT a separate module.** It is an enhancement to the existing `loan_type = 'DSCR'` / `loan_type = 'Commercial'` lead records.

### Investor Entity Resolution

**Problem:** An investor may own properties under multiple names/entities. We need to link them.

**Schema:**
```sql
CREATE TABLE investor_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  lead_id uuid REFERENCES leads(id), -- the lead where this entity was first identified
  entity_name text NOT NULL,
  entity_type text CHECK (entity_type IN ('individual','llc','trust','corporation','partnership')),
  entity_ein text, -- encrypted
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE borrower_entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id uuid NOT NULL, -- links to the person (lead.id or a contacts table)
  entity_id uuid NOT NULL REFERENCES investor_entities(id),
  relationship text NOT NULL CHECK (relationship IN ('owner','member','trustee','guarantor')),
  ownership_percentage decimal(5,2),
  confirmed_by_borrower boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

**Resolution flow:**
1. At DSCR application: ask for entity name
2. System queries all known entities for that tenant — shows: `"We have 2 other properties under Williams RE Holdings LLC. Would you like to add this property to that portfolio?"` 
3. If yes, link the new lead to the existing entity.
4. ATTOM multi-property query by owner name (use DeedMine integration) to auto-discover additional properties.

### Portfolio Aggregation View

**UI in lead record:** When a borrower has linked entities with multiple properties, show a `"Portfolio"` tab:
- All properties in the portfolio with AVM, current estimated loan balance, DSCR per property
- Aggregate metrics: total portfolio value, total debt, aggregate DSCR, total monthly cash flow
- Properties sorted by DSCR (riskiest first)

---

## PHASE 21 — PARTNER REFERRAL BRIDGE (CLOSA + OPEN PARTNER API)

**AshleyIQ supports two-way referrals with any external platform. The primary integration is with CLOSA (PrimeMind's RE agent CRM), but the architecture is generic — any partner platform can send and receive leads via the same API pattern. Each product is a separate Supabase project — no shared database.**

### Outbound: AshleyIQ → Partner Platform

**When to trigger:** LO has a pre-approved buyer looking for a home → refer to any real estate partner.

**UI:** On pre-approved leads, an `"Invite Partner"` or `"Refer to Agent"` button in the lead record action bar. The LO selects from their connected partners list or enters a partner's email to invite them.

**Generic partner referral API:** `POST /api/partners/refer-lead`

```typescript
// lib/partners/referLead.ts
export async function referLeadToPartner(payload: PartnerReferralPayload) {
  const partner = await getPartnerById(payload.partnerId);
  
  if (partner.platform === 'closa') {
    // CLOSA-specific integration (PrimeMind internal)
    // TODO: set CLOSA_INTERNAL_API_KEY and CLOSA_API_BASE_URL env vars
    return await fetch(`${process.env.CLOSA_API_BASE_URL}/api/integrations/ashleyiq/inbound-referral`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLOSA_INTERNAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        borrower_first_name: payload.firstName,
        borrower_last_name: payload.lastName,
        borrower_email: payload.email,
        borrower_phone: payload.phone,
        max_purchase_price: payload.maxPurchasePrice,
        loan_type: payload.loanType,
        pre_approved: payload.isPreApproved,
        lo_name: payload.loName,
        lo_nmls: payload.loNmls,
        source_lead_id: payload.leadId,
      })
    }).then(r => r.json());
  }
  
  // Generic path — email notification to partner with buyer summary
  // Works for any RE agent, builder, financial advisor, etc.
  return await sendPartnerReferralEmail(partner, payload);
}
```

**For partners WITHOUT a platform API:** Send a formatted email via Resend with the buyer's pre-approval summary and a link to the partner portal where they can track the buyer's loan status.

### Inbound: Partner Platform → AshleyIQ

**When any partner sends a buyer who needs financing:**

**API:** `POST /api/integrations/partner/inbound-referral` — creates a new lead in AshleyIQ with `source = 'partner_referral'` and `partner_id` populated, fires speed-to-lead routing.

**Authentication:** `X-Partner-API-Key` header — each partner has their own API key stored in `partners.api_key` (hashed).

**All referrals (both directions) logged to `partner_referrals` table for tracking.**

---

## MIGRATIONS — RUN VIA SUPABASE MCP

After writing each phase's code, immediately apply the schema changes using the Supabase MCP. Do not batch them all at the end — apply each migration as you complete the phase so errors surface early.

**For each phase that has schema changes:**

1. Use the Supabase MCP tool `execute_sql` (or equivalent) to run the SQL directly against the Originest project.
2. After each migration runs, use the MCP to query `information_schema.tables` and confirm the new table or column exists before proceeding to the next phase.
3. If a migration fails (e.g. table already exists, FK references a missing table), resolve it immediately:
   - If the table already exists, use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — never DROP and recreate.
   - If a referenced table is missing, check the existing schema via `information_schema.tables` and either create the dependency first or remove the FK constraint.
4. Name each migration file created locally: `supabase/migrations/[timestamp]_[phase_description].sql` (e.g. `20260608_001_lead_scoring.sql`).

**Migration order (run in this sequence via MCP):**

```
Phase 1:  stage_transition_rules, leads score columns, stage_sla_config, custom_field_definitions, lead_custom_field_values
Phase 2:  lo_routing_config alters, routing_time_rules, ai_prequalifier_sessions
Phase 3:  borrower_application_sessions, borrower_uploaded_documents
Phase 4:  portal_messages
Phase 5:  condition_templates
Phase 6:  commission_splits, manager_overrides, clawback_events, users tax columns
Phase 7:  recruiting_sequences, recruiting_sequence_steps, recruiting_sequence_enrollments, lo_ramp_tracking, interview_availability, interview_bookings
Phase 8:  aus_findings
Phase 9:  leads fallout columns, scheduled_reports
Phase 10: loans refi columns, rate_gap_alerts
Phase 11: credit_disputes
Phase 12: sms_messages, campaign_sequences, campaign_sequence_steps, campaign_events, rate_alert_subscriptions, partners, partner_referrals
Phase 13: conditions is_agent_visible column
Phase 14: social_posts
Phase 15: training_courses, training_completions
Phase 17: income_calculations
Phase 20: investor_entities, borrower_entity_links
Phase 22: rate_options, rate_selections, rate_portal_sessions, rate_portal_tokens
RLS:      All RLS policies and indexes (run last)
```

---

## PHASE 22 — BORROWER DECISION PORTAL

The Borrower Decision Portal is a magic-link borrower-facing experience that replaces the LO rate explanation phone call. The LO creates 2–3 rate options, the system generates AI-powered plain-English explanations (including why the borrower didn't qualify for other programs), and the borrower selects their preferred option. The LO is notified instantly with behavioral context about how the borrower engaged.

This is Ashley IQ's most differentiated consumer-facing feature. Build it to look like a premium fintech product — clean, trustworthy, Apple-caliber.

---

### 22.1 — Schema

```sql
-- Rate options created by the LO per lead
CREATE TABLE rate_options (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  created_by       uuid NOT NULL REFERENCES users(id),
  label            text NOT NULL,                          -- e.g. "Option A — 30-Year Fixed"
  rate             numeric(6,4) NOT NULL,                  -- e.g. 6.6250
  apr              numeric(6,4) NOT NULL,
  loan_amount      numeric(12,2) NOT NULL,
  loan_term_months integer NOT NULL DEFAULT 360,
  points           numeric(5,4) NOT NULL DEFAULT 0,        -- discount points paid (e.g. 1.0 = 1 point)
  points_cost      numeric(12,2) GENERATED ALWAYS AS (loan_amount * points / 100) STORED,
  monthly_payment  numeric(10,2) NOT NULL,
  total_interest   numeric(12,2) NOT NULL,
  loan_program     text NOT NULL,                          -- 'FHA' | 'Conventional' | 'VA' | 'USDA' | 'Jumbo' | 'DSCR' | 'ARM_5_1' | 'ARM_7_1'
  is_recommended   boolean DEFAULT false,
  display_order    integer NOT NULL DEFAULT 1,
  -- AI-generated explanations (set by server on creation)
  explanation_headline text,                               -- e.g. "Lowest monthly payment, most flexibility"
  explanation_body     text,                               -- 2-3 sentences plain English
  -- Pricing engine source
  pricing_source   text NOT NULL DEFAULT 'manual'          CHECK (pricing_source IN ('manual','optimal_blue','polly','lender_price')),
  pricing_engine_ref text,                                 -- external ID from PPE if source != manual
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Programs the borrower did NOT qualify for, with AI explanations
CREATE TABLE rate_disqualifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  program_name     text NOT NULL,                          -- e.g. "VA Loan", "Conventional 95% LTV"
  disqualification_reason text NOT NULL,                   -- AI-generated plain English
  improvement_path text,                                   -- Optional: "Here's how to qualify"
  created_at       timestamptz DEFAULT now()
);

-- Borrower rate selection (INSERT-only — audit trail)
CREATE TABLE rate_selections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid NOT NULL REFERENCES leads(id),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  rate_option_id   uuid NOT NULL REFERENCES rate_options(id),
  selected_by_type text NOT NULL CHECK (selected_by_type IN ('borrower','co_borrower')),
  portal_session_id uuid,                                  -- FK to rate_portal_sessions
  ip_address       inet,
  user_agent       text,
  created_at       timestamptz DEFAULT now()
);

-- Portal access tokens (magic links for borrower + co-borrower)
CREATE TABLE rate_portal_tokens (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  token            text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_type       text NOT NULL CHECK (token_type IN ('borrower','co_borrower')),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_count       integer DEFAULT 0,
  revoked          boolean DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

-- Borrower engagement tracking (behavioral signals for the LO)
CREATE TABLE rate_portal_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             uuid NOT NULL REFERENCES leads(id),
  tenant_id           uuid NOT NULL REFERENCES tenants(id),
  token_id            uuid REFERENCES rate_portal_tokens(id),
  viewer_type         text NOT NULL CHECK (viewer_type IN ('borrower','co_borrower')),
  session_started_at  timestamptz DEFAULT now(),
  session_ended_at    timestamptz,
  total_seconds       integer GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (session_ended_at - session_started_at))::integer
  ) STORED,
  option_hover_data   jsonb DEFAULT '{}',  -- { "option_id": seconds_hovered }
  option_views        jsonb DEFAULT '{}',  -- { "option_id": view_count }
  scenario_used       text[],              -- which stay-duration scenarios they toggled
  breakeven_viewed    boolean DEFAULT false,
  disqualifications_expanded boolean DEFAULT false,
  came_back           boolean DEFAULT false,   -- true if this is a repeat visit
  created_at          timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX ON rate_options(lead_id);
CREATE INDEX ON rate_options(tenant_id, expires_at);
CREATE INDEX ON rate_disqualifications(lead_id);
CREATE INDEX ON rate_selections(lead_id);
CREATE INDEX ON rate_portal_tokens(token) WHERE revoked = false;
CREATE INDEX ON rate_portal_tokens(lead_id);
CREATE INDEX ON rate_portal_sessions(lead_id);

-- RLS
ALTER TABLE rate_options          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_disqualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_selections       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_portal_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_portal_sessions  ENABLE ROW LEVEL SECURITY;

-- LO/staff can CRUD rate_options for their tenant
CREATE POLICY "rate_options_tenant" ON rate_options
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- rate_selections is INSERT-only — no updates or deletes, ever
CREATE POLICY "rate_selections_insert" ON rate_selections
  FOR INSERT WITH CHECK (true);
CREATE POLICY "rate_selections_no_update" ON rate_selections
  FOR UPDATE USING (false);
CREATE POLICY "rate_selections_no_delete" ON rate_selections
  FOR DELETE USING (false);

-- Portal tokens: LO can create/read for their tenant; public read by token (handled in API route with admin client)
CREATE POLICY "rate_portal_tokens_tenant" ON rate_portal_tokens
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Portal sessions: service role only (borrower portal routes use admin client)
CREATE POLICY "rate_portal_sessions_tenant" ON rate_portal_sessions
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
```

---

### 22.2 — LO Rate Builder (LO Dashboard)

**Location:** Add a `"Rate Options"` tab to the lead record detail page (alongside Conditions, Documents, etc.)

**UI — Rate Options tab:**

A card-based builder. The LO sees their current options (or an empty state with a "Create rate options" CTA).

**Create/edit form per option:**
- Loan program (select: Conventional / FHA / VA / USDA / Jumbo / ARM 5/1 / ARM 7/1 / DSCR / NonQM)
- Rate (number input, e.g. `6.625`)
- APR (auto-calculated when possible, or manual input)
- Loan amount (pre-filled from lead record)
- Loan term (30yr / 20yr / 15yr / 10yr)
- Points (number input — `0`, `0.5`, `1`, `2`, etc.)
- Monthly payment (auto-calculated using standard amortization formula)
- Is recommended (toggle — one option can be flagged as LO's recommendation, shown with a gold badge)
- Display order (drag to reorder)

**Auto-calculation formula (run client-side on input change):**
```typescript
// Standard amortization
const monthlyRate = rate / 100 / 12;
const n = loanTermMonths;
const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
const totalPaid = monthlyPayment * n;
const totalInterest = totalPaid - loanAmount;
```

**Expiration:** Each option expires in 7 days by default. Show a warning badge when < 24 hours remain. LO can extend (+7 days) with one click.

**Send Portal button:** Once at least one option exists, show a prominent `"Send to Borrower"` button. This calls `POST /api/leads/[id]/rate-portal/send`, which:
1. Creates or refreshes the borrower's `rate_portal_token`
2. Triggers `POST /api/leads/[id]/rate-portal/generate-explanations` to generate AI content
3. Sends a Resend email to the borrower with the magic link
4. Optionally sends SMS via Relay if the lead has a valid opt-in

**Option B — Pricing Engine Integration (feature flag: `pricingEngineEnabled`):**

When `OPTIMAL_BLUE_API_KEY` env var is set, show a `"Pull Live Rates"` button above the manual form. This calls:

```typescript
// lib/pricing/optimalBlue.ts
export async function fetchOptimalBlueRates(leadProfile: LeadPricingProfile): Promise<RateOption[]>
```

The function passes credit score, LTV, loan amount, property type, and occupancy to the Optimal Blue Product and Pricing API (`POST /v1/search`). Returns the top 3 best-execution options (best 30yr fixed, best 15yr fixed, best ARM). LO reviews and confirms before sending to borrower.

If Optimal Blue is not configured, the `"Pull Live Rates"` button is hidden and the form defaults to manual entry. No stub data — if the env var is absent, the feature simply doesn't appear.

---

### 22.3 — AI Explanation Generation

**API route:** `POST /api/leads/[id]/rate-portal/generate-explanations`

This is called server-side after options are saved. It calls Claude Haiku for each option and for the disqualification list.

**Per-option prompt:**
```
You are a mortgage loan officer explaining a rate option to a borrower in plain English.

Loan program: [PROGRAM]
Rate: [RATE]%
APR: [APR]%
Monthly payment: $[PAYMENT]
Loan term: [TERM] years
Points paid: [POINTS] ([POINTS_COST])
Total interest over life of loan: $[TOTAL_INTEREST]

Write:
1. A headline (max 8 words): the single best reason to choose this option
2. A body (2-3 sentences): what this option means for the borrower day-to-day and over time

No jargon. No technical terms. Speak directly to "you." Be warm and honest — don't oversell.
Return JSON: { "headline": "...", "body": "..." }
```

**Disqualification prompt (called once, covers all programs not offered):**

Fetch the lead record's credit score, LTV, DTI, loan amount, property type, and state. Then:

```
You are a mortgage loan officer. A borrower did not qualify for the following loan programs.
For each program, write one plain-English sentence explaining the primary reason they didn't qualify,
and (where applicable) one sentence on what would change their eligibility.

Borrower profile:
- Credit score: [SCORE]
- LTV: [LTV]%
- DTI: [DTI]%
- Loan amount: $[AMOUNT]
- Property type: [TYPE]
- State: [STATE]

Programs not offered (and primary disqualifying reason — internal):
[LIST OF { program, reason } OBJECTS]

Return JSON array: [{ "program_name": "...", "disqualification_reason": "...", "improvement_path": "..." }]
Improvement path is optional — only include it if there is a concrete, actionable thing the borrower can do.
```

Insert results into `rate_options` (headline/body per option) and `rate_disqualifications` (per program).

---

### 22.4 — Borrower Decision Portal (Public-Facing Pages)

**Route structure (unauthenticated, token-gated):**
```
/portal/rates/[token]          — main rate selection page
/portal/rates/[token]/selected — confirmation screen after selection
```

**Token validation middleware (`middleware.ts` or route-level):**
```typescript
// Validate token on every request to /portal/rates/[token]
// Use admin client (service role) — borrower has no Clerk session
const { data: tokenRecord } = await supabase
  .from('rate_portal_tokens')
  .select('*, leads(*)')
  .eq('token', params.token)
  .eq('revoked', false)
  .gt('expires_at', new Date().toISOString())
  .single();

if (!tokenRecord) return redirect('/portal/expired');
```

**Main page — `/portal/rates/[token]`**

Layout: Ashley IQ brand header (logo + "Powered by Ashley IQ" in Coastal Slate), no nav. Clean white background. Mobile-first.

**Sections (in order):**

**① Greeting card**
```
"Hi [FIRST_NAME], here are your loan options."
[LO_NAME] has prepared [2/3] rate options for your review.
These rates are valid until [DATE]. — [X days remaining countdown]
```

**② Rate option cards (2–3 cards, side by side on desktop, stacked on mobile)**

Each card contains:
- Option label (e.g. "Option A — 30-Year Fixed")
- Gold "Recommended" badge if `is_recommended = true`
- Rate prominently: `6.625%` in 40px DM Mono ultralight
- APR in Coastal Slate below
- Monthly payment: `$2,187/mo` in 28px DM Mono
- Points row: `1 point paid · $3,200` (hidden if points = 0)
- Total interest row: `$187,320 total interest over 30 years`
- AI explanation headline in Lora Bold (16px)
- AI explanation body in Instrument Sans (14px, Coastal Slate)
- `"Select this option"` button (btn-primary for recommended, outlined Navy for others)

**③ Break-even calculator (appears if any option has points > 0)**

Auto-rendered card below the rate options:

```
💡 Should you pay points?

[OPTION_LABEL] includes [X] point(s) — an upfront cost of $[POINTS_COST].
In exchange, your rate drops from [BASE_RATE]% to [POINTS_RATE]%.

Monthly savings: $[SAVINGS]/mo
Break-even: [N] months ([N/12] years)

If you plan to stay in this home longer than [BREAK_EVEN_YEARS] years, paying points saves you money.
```

Break-even calculation:
```typescript
const monthlySavings = baseMonthlyPayment - pointsMonthlyPayment;
const breakEvenMonths = Math.ceil(pointsCost / monthlySavings);
```

**④ Stay duration scenario toggle**

A segmented control: `5 years  |  10 years  |  15 years  |  30 years`

When the borrower picks a scenario, each rate card updates to show:
- Total cost for that duration (principal paid + interest paid + points)
- A simple horizontal bar chart comparing options (pure CSS, no library)

For ARM options: show a note at the < 10-year scenarios: *"This rate is fixed for [5/7] years. After that, it adjusts annually. Ideal if you plan to sell or refinance before the adjustment."*

**⑤ Why you didn't qualify (collapsed accordion, opens on click)**

Header: `"Why aren't more options shown?"`

Each disqualified program is one row:
- Program name in Navy Bold
- Disqualification reason in Coastal Slate
- (Optional) Improvement path in a gold-tinted callout box: `"Here's how to change this: [PATH]"`

This section is intentionally below the fold — borrowers who are happy with the options don't need to see it. But it's always there.

**⑥ Co-borrower share section (if co-borrower name/email exists on lead)**

```
Is [CO_BORROWER_NAME] reviewing this with you?
[Send them a link →]
```

Clicking "Send them a link" calls `POST /api/leads/[id]/rate-portal/send-coborrower` which creates a `co_borrower` token and sends a Resend email. No SMS for co-borrower (only primary borrower has TCPA consent).

---

### 22.5 — Borrower Selection Flow

**On "Select this option" click:**

1. Show a confirmation modal:
   ```
   Confirm your selection

   You're choosing [OPTION_LABEL]
   Rate: [RATE]% · Monthly payment: $[PAYMENT]/mo
   [Points info if applicable]

   By selecting this option, you're letting [LO_NAME] know your preference.
   This is not a rate lock or loan commitment.

   [Confirm selection]   [Go back]
   ```

2. On confirm: `POST /api/portal/rates/[token]/select` (public route, admin client)
   - Validates token still valid and not expired
   - Inserts into `rate_selections` (INSERT-only)
   - Updates `rate_portal_sessions` with `session_ended_at`
   - Calls `POST /api/notifications/rate-selected` → triggers Relay notification to LO

3. Redirect to `/portal/rates/[token]/selected`

**Confirmation page:**
```
✓ Your selection has been received.

You chose [OPTION_LABEL] — [RATE]%, $[PAYMENT]/mo.
[LO_NAME] has been notified and will be in touch shortly.

[LO PHOTO / AVATAR]
[LO_NAME] · NMLS #[NMLS]
[Phone] · [Email]
```

---

### 22.6 — LO Notification (via Relay)

**Trigger:** On borrower selection, call Relay with:

```typescript
await relay.send({
  channel: ['email', 'sms'],       // LO gets both
  to: lo.email,
  sms_to: lo.phone,                // only if LO has a phone on file
  template: 'rate_selected',
  data: {
    lo_first_name: lo.first_name,
    borrower_name: `${lead.first_name} ${lead.last_name}`,
    selected_option: option.label,
    rate: option.rate,
    monthly_payment: option.monthly_payment,
    loan_number: lead.loan_number,
    portal_url: `${BASE_URL}/leads/${lead.id}`,
    behavioral_summary: await generateBehavioralSummary(sessionData),
  }
});
```

**`generateBehavioralSummary`** — call Claude Haiku with the session data:
```
Summarize this borrower's engagement in 1-2 sentences for a loan officer.
Session data: [JSON]
Be specific. E.g. "Borrower spent 4 minutes on Option B before selecting Option A — may have hesitated on the higher payment."
```

The behavioral summary is included in the LO email as a callout box.

**LO dashboard notification:** The lead card gets a gold banner: `"⚡ [BORROWER_NAME] selected a rate — view their choice"`

---

### 22.7 — Behavioral Session Tracking

**On portal load:** `POST /api/portal/rates/[token]/session/start` → creates `rate_portal_sessions` record, returns `session_id` stored in `sessionStorage`.

**Client-side tracking (no external analytics):**

```typescript
// Track hover time per option
const hoverTimers: Record<string, number> = {};

optionCards.forEach(card => {
  card.addEventListener('mouseenter', () => {
    hoverTimers[card.dataset.optionId] = Date.now();
  });
  card.addEventListener('mouseleave', () => {
    const elapsed = (Date.now() - hoverTimers[card.dataset.optionId]) / 1000;
    updateSessionHover(card.dataset.optionId, elapsed);
  });
});
```

**On session end (beforeunload or selection):** `PATCH /api/portal/rates/[token]/session/end` with final hover data, scenario toggles used, and whether disqualifications were expanded.

---

### 22.8 — LO View: Behavioral Intelligence Panel

**On the lead record's Rate Options tab**, below the options list, add a `"Borrower Engagement"` section. Only visible after the portal has been opened at least once.

**Shows:**
- Last viewed: `"2 hours ago"`
- Sessions: `"3 visits"`
- Came back: `"Yes — returned the next day"`
- Time on portal: `"6 min 12 sec total"`
- Most viewed option: `"Option B (ARM) — 4 min"`
- Scenarios tested: `"5 years, 10 years"`
- Disqualifications viewed: `"Yes — expanded the accordion"`
- Co-borrower viewed: `"Yes — spouse opened the link"`
- AI summary: `"[BEHAVIORAL_SUMMARY from most recent session]"`

This panel is read-only. It refreshes via Supabase Realtime on `rate_portal_sessions`.

---

### 22.9 — Rate Expiration Handling

**7 days after creation**, rate options expire. The portal shows:

```
⏰ These rates have expired.
Rates change daily. Contact [LO_NAME] to get updated options.
[LO phone] · [LO email]
```

The LO dashboard shows a `"Rates expired"` badge on the lead card. One-click to clone the existing options (same structure, new expiration), then update rates and resend.

**Proactive expiration alert:** 24 hours before expiration, Relay sends the LO an SMS: *"Rate options for [BORROWER_NAME] expire tomorrow. Update and resend? [link]"*

---

### 22.10 — Compliance Note

Add this footer to every portal page in 12px Coastal Slate:

```
These rate options are for informational purposes only and are not a loan commitment, 
rate lock, or Loan Estimate as defined by TRID (12 CFR § 1026.37). Rates are subject 
to change based on market conditions and borrower qualification. [LENDER_NAME] | 
NMLS #[NMLS] | Equal Housing Lender ⊞
```

---

## FINAL STEP — AUTONOMOUS VERIFICATION

After all 21 phases are built and all migrations are applied, run every check below autonomously. Fix any failure before reporting done. Do not stop and ask — fix and continue.

### Step 0 — Design Integrity Check (runs FIRST)
```bash
# Frozen files must not have been modified
git diff --name-only app/globals.css tailwind.config.ts app/layout.tsx

# No rogue Apple blue interactive colors (the design uses Navy #0F1D2E, not Apple blue)
grep -rn "#007AFF\|#3478F6\|#0A84FF\|color: blue\|text-blue-[^t]" app/components app/app --include="*.tsx" --include="*.ts"

# No Tailwind gray/slate/zinc/neutral utility classes used as backgrounds (use var(--c-bg) or bg-bg)
grep -rn "bg-gray-[2-9]\|bg-slate-[2-9]\|bg-zinc-[2-9]\|bg-neutral-[2-9]" app/ --include="*.tsx"

# No hardcoded hex colors in style props in new files
grep -rn "style={{.*color.*#\|style={{.*background.*#" app/ --include="*.tsx"

# No new CSS files created
find app/ components/ -name "*.css" ! -name "globals.css"

# No unauthorized UI libraries imported
grep -rn "from '@radix-ui\|from '@shadcn\|from '@mui\|from '@chakra" app/components app/app --include="*.tsx" 2>/dev/null | grep -v "node_modules"
```
**Pass condition:** `git diff` returns empty for the three frozen files. All other greps return 0 results. If any frozen file was modified, `git checkout` it back to its previous state immediately.

### Step 1 — TypeScript
```bash
cd products/conduit-next && npx tsc --noEmit
```
**Pass condition:** 0 errors. If errors exist, fix them before proceeding.

### Step 2 — Security Scan
```bash
# Must return 0 results — SSN/DOB must never appear in DB writes
grep -r "ssn" app/api/ --include="*.ts" | grep -v "// SSN" | grep -v "test"
grep -r "date_of_birth\|dob" app/api/ --include="*.ts" | grep -v "// DOB" | grep -v "test"

# Must return 0 results — no hardcoded secrets
grep -rn "sk_live\|Bearer eyJ\|password\s*=\s*['\"]" app/ --include="*.ts"
```
**Pass condition:** All three greps return empty. If any match found, remove the offending code immediately.

### Step 3 — Verify All Migrations Applied (via Supabase MCP)
Use the MCP to run this query and confirm every table exists:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'stage_transition_rules', 'stage_sla_config', 'custom_field_definitions',
  'lead_custom_field_values', 'routing_time_rules', 'ai_prequalifier_sessions',
  'borrower_application_sessions', 'borrower_uploaded_documents', 'portal_messages',
  'condition_templates', 'commission_splits', 'manager_overrides', 'clawback_events',
  'recruiting_sequences', 'recruiting_sequence_steps', 'recruiting_sequence_enrollments',
  'lo_ramp_tracking', 'interview_availability', 'interview_bookings', 'aus_findings',
  'scheduled_reports', 'rate_gap_alerts', 'credit_disputes', 'sms_messages',
  'campaign_sequences', 'campaign_sequence_steps', 'campaign_events',
  'rate_alert_subscriptions', 'partners', 'partner_referrals', 'social_posts',
  'training_courses', 'training_completions', 'income_calculations',
  'investor_entities', 'borrower_entity_links'
)
ORDER BY table_name;
```
**Pass condition:** All 35 tables returned. Any missing table — run its migration now.

### Step 4 — Verify Audit Table RLS (via Supabase MCP)
```sql
SELECT schemaname, tablename, cmd, qual
FROM pg_policies
WHERE tablename IN (
  'campaign_events', 'clawback_events', 'condition_events', 'payroll_events',
  'los_sync_events', 'opt_ins', 'opt_outs', 'credit_pull_events',
  'dispute_events', 'rate_lock_events'
)
AND cmd IN ('UPDATE', 'DELETE')
ORDER BY tablename;
```
**Pass condition:** 0 rows returned (no UPDATE or DELETE policies exist on audit tables). If any found, DROP them immediately.

### Step 5 — Verify Column Additions (via Supabase MCP)
```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE (table_name = 'leads' AND column_name IN ('score', 'score_updated_at', 'score_factors', 'fallout_reason', 'fallout_notes'))
   OR (table_name = 'loans' AND column_name IN ('refi_opportunity_score', 'refi_score_updated_at', 'refi_score_factors'))
   OR (table_name = 'users' AND column_name IN ('tax_classification', 'tax_id_encrypted'))
   OR (table_name = 'lo_routing_config' AND column_name IN ('max_active_leads', 'routing_paused', 'pause_reason', 'response_rate', 'routing_weight'))
   OR (table_name = 'conditions' AND column_name = 'is_agent_visible')
ORDER BY table_name, column_name;
```
**Pass condition:** All 16 columns returned. Any missing — run the ALTER immediately.

### Step 6 — Build Check
```bash
cd products/conduit-next && npm run build
```
**Pass condition:** Build exits with code 0. Fix all build errors before proceeding.

### Step 7 — Route Audit
```bash
# List all new API routes added this session
find app/api -name "route.ts" -newer app/api/leads/route.ts | sort

# Confirm every route file has an auth check
for f in $(find app/api -name "route.ts"); do
  if ! grep -q "auth()\|borrower_portal_tokens\|X-Partner-API-Key" "$f"; then
    echo "MISSING AUTH: $f"
  fi
done
```
**Pass condition:** No `MISSING AUTH` lines. Any unprotected route — add auth before finishing.

### Step 8 — Env Vars Documented
```bash
# Confirm all new env vars are in .env.example
grep -c "OB_CLIENT_ID\|CLOSA_INTERNAL_API_KEY\|RAPID_RESCORE_API_KEY\|NEXT_PUBLIC_DEFAULT_LOCALE\|FACEBOOK_APP_ID\|LINKEDIN_CLIENT_ID" .env.example
```
**Pass condition:** Returns 6. Any missing — add to `.env.example` with `=TODO # set this` value.

---

## COMPLETION REPORT

When all 8 verification steps pass, output a structured completion report:

```
═══════════════════════════════════════════════════════
ASHLEYIQ v2 BUILD — COMPLETE
═══════════════════════════════════════════════════════

PHASES COMPLETED:     21 / 21
MIGRATIONS APPLIED:   [N] tables created, [N] columns altered
BUILD STATUS:         ✓ passing
TYPESCRIPT:           ✓ 0 errors
SECURITY SCAN:        ✓ clean
DESIGN INTEGRITY:     ✓ globals.css / tailwind.config.ts / layout.tsx unchanged
AUDIT TABLE RLS:      ✓ INSERT-only enforced on all [N] tables
UNPROTECTED ROUTES:   ✓ none
ENV VARS DOCUMENTED:  ✓ all 6 new vars in .env.example

NEW TABLES (35):
  [list all 35 confirmed via Step 3 query]

COLUMNS ADDED (16):
  [list all 16 confirmed via Step 5 query]

PHASES WITH ISSUES ENCOUNTERED + HOW RESOLVED:
  [list any conflicts found and how they were fixed]

READY FOR: npm run dev → manual QA → Vercel deploy
═══════════════════════════════════════════════════════
```

---

## ENV VARS CHECKLIST (new additions this session)

```env
# Rate Engine — apply at optimalblue.com/become-a-partner or polly.io
OB_CLIENT_ID=TODO
OB_CLIENT_SECRET=TODO
OB_SUBSCRIBER_ID=TODO
OB_BASE_URL=https://api-sandbox.optimalblue.com  # change to prod after partner approval

# Partner Bridge — CLOSA (PrimeMind RE agent CRM)
# Generic partner API works without these — CLOSA integration requires them
CLOSA_INTERNAL_API_KEY=TODO  # shared with CLOSA team
CLOSA_API_BASE_URL=TODO      # CLOSA production URL
CLOSA_INBOUND_API_KEY=TODO   # CLOSA uses this to call AshleyIQ

# Rapid Rescore Vendor (sign up at creditplus.com or corecredco.com)
RAPID_RESCORE_API_KEY=TODO
RAPID_RESCORE_API_URL=TODO

# Locale
NEXT_PUBLIC_DEFAULT_LOCALE=en

# Social Posting (register apps on each platform's developer portal)
FACEBOOK_APP_ID=TODO
FACEBOOK_APP_SECRET=TODO
LINKEDIN_CLIENT_ID=TODO
LINKEDIN_CLIENT_SECRET=TODO
```

---

## NOTES FOR CLAUDE CODE (AUTONOMOUS MODE)

- **You have full permissions.** Do not stop to ask for confirmation. Build, migrate, verify, fix — autonomously.
- Build phases sequentially. If a phase fails to compile, fix it immediately and continue. Never leave a broken phase and move on.
- Apply each migration via the Supabase MCP as you complete each phase — do not batch at the end.
- If a migration errors (relation already exists, missing FK target, etc.), resolve it on the spot using `IF NOT EXISTS` / `IF EXISTS` guards or by inspecting the live schema first.
- Every new table needs RLS enabled and appropriate policies before moving to the next phase.
- Every new API route needs auth. No route should be accessible without either Clerk session (LO routes) or a valid token (borrower/partner routes).
- All client components that use browser APIs must have `'use client'` directive.
- All routes that should not be cached must have `export const dynamic = 'force-dynamic'`.
- Use `@/` path aliases throughout. No relative `../../../` imports.
- Do not install new npm packages without checking if the functionality already exists in the codebase or can be done with built-in APIs.
- When you finish, output the full completion report from the COMPLETION REPORT section above. That report is the signal that this session is done.
