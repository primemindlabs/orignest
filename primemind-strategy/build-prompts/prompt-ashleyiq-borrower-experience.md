# Ashley IQ — Borrower Experience Build Prompt
# Claude Code Session Instruction

---

## HOW TO LAUNCH THIS SESSION

Run this from the repo root (`products/conduit-next/`):

```bash
claude --dangerously-skip-permissions
```

Then paste this entire prompt. Claude Code will run fully autonomously — no confirmation prompts, no permission dialogs. It will build both phases, apply all Supabase migrations via the MCP, and verify the result without stopping.

**Prerequisites before launching:**
- Supabase MCP configured: `claude mcp add supabase -- npx -y @supabase/mcp-server-supabase@latest --access-token YOUR_TOKEN`
- Active Supabase project: Originest/Conduit (project ref: `dhnxiijduycmzfjmohyp`)
- `.env.local` with: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- Main v2 build prompt (`prompt-ashleyiq-v2-complete-build.md`) must have been run first — this prompt extends the schema and UI from that session.

> Open this session at the root of `products/conduit-next/`. Run `ls` first to confirm structure, then execute Phase 22 followed by Phase 23 in order. Do not skip phases. Do not mock data in any production code path.

---

## WHO YOU ARE AND HOW YOU WORK

You are a senior full-stack engineer with 10+ years of production experience in Next.js, TypeScript, Supabase, and financial-grade SaaS.

### PRESERVE EVERYTHING THAT EXISTS
- Read before you write. Before touching any file, read it in full.
- Never delete existing functionality. Extend — do not replace.
- Additive only. Nothing is subtracted.

### DRY — DON'T REPEAT YOURSELF
- Search the codebase before writing any new utility, hook, or component.
- Shared logic lives in `lib/`, `hooks/`, or `components/ui/`. Never duplicate.

### KISS — KEEP IT SIMPLE, STUPID
- The simplest solution that fully solves the problem is correct.
- No over-engineering. Prefer explicit over clever.
- New dependencies are a last resort.

### BEFORE STARTING EACH PHASE
1. `grep` or `find` for existing code related to that phase.
2. Read the files you find.
3. Identify what already works.
4. Write only what is missing.
5. Do not touch code unrelated to the phase.

---

## IMMOVABLE SECURITY RULES

1. **SSN and DOB are never written to the database.** Grep for `ssn` and `dob` before every commit.
2. **All audit tables are INSERT-only.** `rate_selections`, `celebration_events`, and all existing audit tables: RLS must DENY UPDATE and DELETE for ALL roles including `service_role`.
3. **No mock data in production paths.** If an API is not connected, show a disabled state with a `TODO: set env var` comment.
4. **TCPA compliance.** No SMS without a verified `opt_in` record for that phone number.
5. **Each Supabase client is scoped correctly.** Use `createAdminClient()` for borrower portal routes (no Clerk session). Use `createClient()` for all authenticated LO routes.
6. **TypeScript strict mode.** No `as any`. Run `tsc --noEmit` at the end of every phase.

---

## ⚠️ DESIGN FREEZE — READ THIS BEFORE TOUCHING A SINGLE FILE

The following files are **frozen**. Do not modify them under any circumstances:

```
app/globals.css
tailwind.config.ts
app/layout.tsx
```

### EXACT COLOR PALETTE — USE ONLY THESE VALUES

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
Sidebar glass:        rgba(255,255,255,0.72) + blur(28px)
Topbar glass:         rgba(255,255,255,0.85) + blur(20px)
Card shadow:          0 1px 0 rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06)
```

### FONT RULES
- `Lora Bold` — display headings, product names, certificate titles
- `Instrument Sans` — all UI text, labels, body copy
- `DM Mono` — all numbers, rates, dollar amounts, metrics, percentages

### DESIGN VIOLATIONS = BUILD FAILURE
These are immediate errors — fix before proceeding:
- Any Apple blue (`#007AFF`, `#3478F6`, `#0A84FF`) anywhere in new code
- Any Tailwind `bg-gray-*`, `bg-slate-*`, `bg-zinc-*` as a background color
- Any hardcoded hex color in a `style={{}}` prop
- Any new `.css` file created (other than globals.css)
- Any new UI library imported (shadcn, MUI, Chakra, Radix standalone, etc.)
- Any `#F5EFE0` (old Linen Ivory) used anywhere

---

## PHASE 22 — BORROWER DECISION PORTAL

The Borrower Decision Portal is a magic-link borrower-facing experience that replaces the LO rate explanation phone call. The LO creates 2–3 rate options, the system generates AI-powered plain-English explanations (including why the borrower didn't qualify for other programs), and the borrower selects their preferred option. The LO is notified instantly with behavioral context about how the borrower engaged.

Build it to look like a premium fintech product — clean, trustworthy, Apple-caliber.

---

### 22.1 — Schema

```sql
-- Rate options created by the LO per lead
CREATE TABLE rate_options (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  created_by       uuid NOT NULL REFERENCES users(id),
  label            text NOT NULL,
  rate             numeric(6,4) NOT NULL,
  apr              numeric(6,4) NOT NULL,
  loan_amount      numeric(12,2) NOT NULL,
  loan_term_months integer NOT NULL DEFAULT 360,
  points           numeric(5,4) NOT NULL DEFAULT 0,
  points_cost      numeric(12,2) GENERATED ALWAYS AS (loan_amount * points / 100) STORED,
  monthly_payment  numeric(10,2) NOT NULL,
  total_interest   numeric(12,2) NOT NULL,
  loan_program     text NOT NULL,
  is_recommended   boolean DEFAULT false,
  display_order    integer NOT NULL DEFAULT 1,
  explanation_headline text,
  explanation_body     text,
  pricing_source   text NOT NULL DEFAULT 'manual' CHECK (pricing_source IN ('manual','optimal_blue','polly','lender_price')),
  pricing_engine_ref text,
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Programs the borrower did NOT qualify for
CREATE TABLE rate_disqualifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  program_name     text NOT NULL,
  disqualification_reason text NOT NULL,
  improvement_path text,
  created_at       timestamptz DEFAULT now()
);

-- Borrower rate selection — INSERT-only, no UPDATE or DELETE ever
CREATE TABLE rate_selections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid NOT NULL REFERENCES leads(id),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  rate_option_id   uuid NOT NULL REFERENCES rate_options(id),
  selected_by_type text NOT NULL CHECK (selected_by_type IN ('borrower','co_borrower')),
  portal_session_id uuid,
  ip_address       inet,
  user_agent       text,
  created_at       timestamptz DEFAULT now()
);

-- Portal access tokens (magic links)
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

-- Borrower engagement tracking
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
  option_hover_data   jsonb DEFAULT '{}',
  option_views        jsonb DEFAULT '{}',
  scenario_used       text[],
  breakeven_viewed    boolean DEFAULT false,
  disqualifications_expanded boolean DEFAULT false,
  came_back           boolean DEFAULT false,
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
ALTER TABLE rate_options           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_disqualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_selections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_portal_tokens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_portal_sessions   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_options_tenant" ON rate_options
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- rate_selections: INSERT-only, no exceptions
CREATE POLICY "rate_selections_insert" ON rate_selections
  FOR INSERT WITH CHECK (true);
CREATE POLICY "rate_selections_no_update" ON rate_selections
  FOR UPDATE USING (false);
CREATE POLICY "rate_selections_no_delete" ON rate_selections
  FOR DELETE USING (false);

CREATE POLICY "rate_portal_tokens_tenant" ON rate_portal_tokens
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "rate_portal_sessions_tenant" ON rate_portal_sessions
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
```

---

### 22.2 — LO Rate Builder (LO Dashboard)

**Location:** Add a `"Rate Options"` tab to the lead record detail page.

**Per-option form fields:**
- Loan program (Conventional / FHA / VA / USDA / Jumbo / ARM 5/1 / ARM 7/1 / DSCR / NonQM)
- Rate (number, e.g. `6.625`)
- APR (manual or auto-calculated)
- Loan amount (pre-filled from lead)
- Loan term (30yr / 20yr / 15yr / 10yr)
- Points (0, 0.5, 1, 2)
- Monthly payment (auto-calculated client-side)
- Is recommended (toggle — shows gold badge on borrower portal)
- Display order (drag to reorder)

**Auto-calculation (client-side, runs on input change):**
```typescript
const monthlyRate = rate / 100 / 12;
const n = loanTermMonths;
const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
const totalInterest = (monthlyPayment * n) - loanAmount;
```

**Expiration:** Options expire in 7 days. Show warning badge when < 24 hours remain. One-click extend (+7 days).

**Send Portal button:** Once one option exists, show `"Send to Borrower"` which:
1. Creates/refreshes the borrower `rate_portal_token`
2. Calls `POST /api/leads/[id]/rate-portal/generate-explanations`
3. Sends Resend email with magic link
4. Sends SMS via Relay if borrower has a valid opt-in

**Option B — Pricing Engine (feature flag `pricingEngineEnabled`):**

When `OPTIMAL_BLUE_API_KEY` env var is set, show `"Pull Live Rates"` button. Call:
```typescript
// lib/pricing/optimalBlue.ts
export async function fetchOptimalBlueRates(leadProfile: LeadPricingProfile): Promise<RateOption[]>
```
Pass credit score, LTV, loan amount, property type, occupancy. Return top 3 best-execution options. LO reviews and confirms before sending. If env var absent, button is hidden — no stub.

---

### 22.3 — AI Explanation Generation

**API route:** `POST /api/leads/[id]/rate-portal/generate-explanations`

**Per-option (Claude Haiku):**
```
You are a mortgage loan officer explaining a rate option to a borrower in plain English.

Loan program: [PROGRAM]
Rate: [RATE]% | APR: [APR]% | Monthly payment: $[PAYMENT]
Loan term: [TERM] years | Points: [POINTS] ($[POINTS_COST])
Total interest over life of loan: $[TOTAL_INTEREST]

Write:
1. A headline (max 8 words): the single best reason to choose this option
2. A body (2-3 sentences): what this means day-to-day and over time

No jargon. Speak directly to "you." Be warm and honest — don't oversell.
Return JSON: { "headline": "...", "body": "..." }
```

**Disqualification explanations (Claude Haiku, one call covering all missed programs):**
```
You are a mortgage loan officer. A borrower did not qualify for the following programs.
For each, write one plain-English sentence explaining why, and (where applicable) one
sentence on what would change their eligibility.

Borrower profile:
- Credit score: [SCORE] | LTV: [LTV]% | DTI: [DTI]%
- Loan amount: $[AMOUNT] | Property type: [TYPE] | State: [STATE]

Programs not offered (with internal reason):
[{ program, reason }]

Return JSON: [{ "program_name", "disqualification_reason", "improvement_path" }]
improvement_path is optional — only include if there is a concrete, actionable step.
```

---

### 22.4 — Borrower Decision Portal (Public Pages)

**Routes (unauthenticated, token-gated):**
```
/portal/rates/[token]           — main rate selection page
/portal/rates/[token]/selected  — confirmation after selection
/portal/expired                 — shown when token is expired or revoked
```

**Token validation (route-level, admin client):**
```typescript
const { data: tokenRecord } = await supabase
  .from('rate_portal_tokens')
  .select('*, leads(*)')
  .eq('token', params.token)
  .eq('revoked', false)
  .gt('expires_at', new Date().toISOString())
  .single();

if (!tokenRecord) return redirect('/portal/expired');
```

**Main page layout (mobile-first, 375px min-width):**

**① Greeting card**
```
"Hi [FIRST_NAME], here are your loan options."
[LO_NAME] prepared [N] options for your review.
Valid until [DATE] — [X days] remaining
```

**② Rate option cards (side-by-side desktop, stacked mobile)**

Each card:
- Option label (e.g. "Option A — 30-Year Fixed")
- Gold "Recommended" badge if `is_recommended = true`
- Rate: 40px DM Mono ultralight
- APR in Coastal Slate below rate
- Monthly payment: 28px DM Mono
- Points row (hidden if points = 0): `1 point · $3,200`
- Total interest row
- AI explanation headline (Lora Bold 16px)
- AI explanation body (Instrument Sans 14px, Coastal Slate)
- `"Select this option"` (btn-primary for recommended, outlined for others)

**③ Break-even calculator (only when any option has points > 0)**
```typescript
const monthlySavings = baseMonthlyPayment - pointsMonthlyPayment;
const breakEvenMonths = Math.ceil(pointsCost / monthlySavings);
```
Display: *"Paying [X] point(s) saves $[SAVINGS]/mo. Break-even: [N] months ([Y] years). If you stay longer than [Y] years, paying points saves you money."*

**④ Stay duration scenario toggle**

Segmented control: `5 years | 10 years | 15 years | 30 years`

On selection, each rate card updates to show total cost for that scenario. ARM options show: *"This rate is fixed for [5/7] years. Ideal if you plan to sell or refinance before the adjustment."*

Pure CSS horizontal bar chart comparing total costs — no charting library.

**⑤ Why you didn't qualify (collapsed accordion)**

Header: `"Why aren't more options shown?"`

Each row: program name (Navy Bold) + disqualification reason (Coastal Slate) + optional improvement path (gold-tinted callout).

**⑥ Co-borrower share (if co-borrower on lead)**
```
Is [CO_BORROWER_NAME] reviewing this with you?
[Send them a link →]
```
Calls `POST /api/leads/[id]/rate-portal/send-coborrower` → creates `co_borrower` token → Resend email only (no SMS for co-borrower).

**⑦ Compliance footer (12px Coastal Slate, every portal page)**
```
These rate options are for informational purposes only and are not a loan commitment,
rate lock, or Loan Estimate as defined by TRID (12 CFR § 1026.37). Rates are subject
to change. [LENDER_NAME] | NMLS #[NMLS] | Equal Housing Lender ⊞
```

---

### 22.5 — Borrower Selection Flow

**On "Select this option":**

1. Confirmation modal:
   ```
   Confirm your selection

   You're choosing [OPTION_LABEL]
   Rate: [RATE]% · $[PAYMENT]/mo
   [Points info if applicable]

   By selecting this option, you're letting [LO_NAME] know your preference.
   This is not a rate lock or loan commitment.

   [Confirm selection]   [Go back]
   ```

2. On confirm: `POST /api/portal/rates/[token]/select` (public route, admin client)
   - Validates token still valid
   - INSERT into `rate_selections`
   - Updates `rate_portal_sessions.session_ended_at`
   - Triggers LO notification via Relay

3. Redirect to `/portal/rates/[token]/selected`

**Confirmation page:**
```
✓  Your selection has been received.

You chose [OPTION_LABEL] — [RATE]%, $[PAYMENT]/mo.
[LO_NAME] has been notified and will be in touch shortly.

[LO PHOTO / AVATAR]
[LO_NAME] · NMLS #[NMLS]
[Phone]  ·  [Email]
```

---

### 22.6 — LO Notification via Relay

```typescript
await relay.send({
  channel: ['email', 'sms'],
  to: lo.email,
  sms_to: lo.phone,
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

**`generateBehavioralSummary`** — Claude Haiku, 1–2 sentences:
```
Summarize this borrower's engagement for a loan officer.
Session data: [JSON]
Be specific. E.g. "Borrower spent 4 minutes on Option B before selecting Option A — may have hesitated on the higher payment."
```

LO dashboard: gold banner on lead card: `"⚡ [NAME] selected a rate — view their choice"`

---

### 22.7 — Behavioral Session Tracking

**On portal load:** `POST /api/portal/rates/[token]/session/start` → creates session, returns `session_id` stored in `sessionStorage`.

**Client-side hover tracking (no external analytics):**
```typescript
const hoverTimers: Record<string, number> = {};

optionCards.forEach(card => {
  card.addEventListener('mouseenter', () => {
    hoverTimers[card.dataset.optionId!] = Date.now();
  });
  card.addEventListener('mouseleave', () => {
    const elapsed = (Date.now() - hoverTimers[card.dataset.optionId!]) / 1000;
    updateSessionHover(card.dataset.optionId!, elapsed);
  });
});
```

**On session end (beforeunload or selection):** `PATCH /api/portal/rates/[token]/session/end`

---

### 22.8 — LO Behavioral Intelligence Panel

On the lead's Rate Options tab, after portal is opened at least once, show a `"Borrower Engagement"` read-only panel:

- Last viewed · Sessions · Came back
- Time on portal · Most viewed option (with seconds)
- Scenarios tested · Disqualifications viewed · Co-borrower viewed
- AI summary from most recent session

Refreshes via Supabase Realtime on `rate_portal_sessions`.

---

### 22.9 — Rate Expiration

After 7 days, portal shows the expired state. LO dashboard shows `"Rates expired"` badge. One-click to clone options (same structure, new expiration), update rates, resend.

**Proactive alert:** 24h before expiry, Relay SMS to LO: *"Rate options for [NAME] expire tomorrow. Update and resend? [link]"*

---

## PHASE 23 — BORROWER CELEBRATION EXPERIENCE

This is the emotional design layer. When a borrower goes under contract or closes their loan, Ashley IQ celebrates with them — in the portal and via email. Milestone explainer videos reduce LO call volume by making borrowers feel informed at every stage. The congrats certificate is a shareable, frameable artifact that turns closings into word-of-mouth referrals.

---

### 23.1 — Schema

```sql
-- Milestone explainer videos (one per milestone, optional per-tenant override)
CREATE TABLE milestone_videos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid REFERENCES tenants(id),  -- NULL = Ashley IQ default (applies to all tenants)
  milestone_key text NOT NULL,               -- matches lead stage values
  title        text NOT NULL,
  subtitle     text,
  video_url    text NOT NULL,                -- Supabase Storage public URL or external CDN
  thumbnail_url text NOT NULL,
  duration_seconds integer NOT NULL,
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  -- Unique: one video per milestone per tenant (NULL tenant = default)
  CONSTRAINT milestone_videos_unique UNIQUE (tenant_id, milestone_key)
);

-- Celebration events (INSERT-only audit trail)
CREATE TABLE celebration_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  event_type      text NOT NULL CHECK (event_type IN (
    'under_contract_portal',
    'under_contract_email',
    'funded_portal',
    'funded_email',
    'certificate_generated',
    'certificate_downloaded',
    'certificate_shared'
  )),
  certificate_url text,   -- populated for certificate_generated events
  share_platform  text,   -- 'linkedin' | 'instagram' | 'copy_link' for certificate_shared events
  created_at      timestamptz DEFAULT now()
);

-- Congrats certificates
CREATE TABLE closing_certificates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  certificate_type text NOT NULL CHECK (certificate_type IN ('purchase','refinance')),
  borrower_name    text NOT NULL,
  co_borrower_name text,
  property_address text NOT NULL,
  closing_date     date NOT NULL,
  loan_amount      numeric(12,2) NOT NULL,
  lo_name          text NOT NULL,
  lo_nmls          text NOT NULL,
  lender_name      text NOT NULL,
  pdf_url          text,          -- populated after generation
  generated_at     timestamptz,
  created_at       timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX ON milestone_videos(milestone_key) WHERE is_active = true;
CREATE INDEX ON milestone_videos(tenant_id, milestone_key);
CREATE INDEX ON celebration_events(lead_id);
CREATE INDEX ON closing_certificates(lead_id);

-- RLS
ALTER TABLE milestone_videos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE celebration_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE closing_certificates ENABLE ROW LEVEL SECURITY;

-- milestone_videos: LO can read defaults (tenant_id IS NULL) and their own tenant's overrides
CREATE POLICY "milestone_videos_read" ON milestone_videos
  FOR SELECT USING (
    tenant_id IS NULL
    OR tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- LO/admin can manage their tenant's custom videos
CREATE POLICY "milestone_videos_tenant_manage" ON milestone_videos
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- celebration_events: INSERT-only
CREATE POLICY "celebration_events_insert" ON celebration_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY "celebration_events_no_update" ON celebration_events
  FOR UPDATE USING (false);
CREATE POLICY "celebration_events_no_delete" ON celebration_events
  FOR DELETE USING (false);

-- closing_certificates: tenant-scoped
CREATE POLICY "closing_certificates_tenant" ON closing_certificates
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));
```

**Seed default milestone videos** (insert with `tenant_id = NULL`):
```sql
INSERT INTO milestone_videos (tenant_id, milestone_key, title, subtitle, video_url, thumbnail_url, duration_seconds) VALUES
  (NULL, 'application_received',  'Application Received',    'What happens in the first 24 hours',             'https://cdn.ashleyiq.com/videos/milestone-01-application.mp4',    'https://cdn.ashleyiq.com/videos/thumbs/milestone-01.jpg',    75),
  (NULL, 'credit_income_review',  'Credit & Income Review',  'How we verify your financial picture',           'https://cdn.ashleyiq.com/videos/milestone-02-credit.mp4',        'https://cdn.ashleyiq.com/videos/thumbs/milestone-02.jpg',    90),
  (NULL, 'appraisal_ordered',     'Appraisal Ordered',       'Why the appraisal matters and what to expect',  'https://cdn.ashleyiq.com/videos/milestone-03-appraisal.mp4',     'https://cdn.ashleyiq.com/videos/thumbs/milestone-03.jpg',    80),
  (NULL, 'underwriting',          'Underwriting',            'What underwriters actually do all day',          'https://cdn.ashleyiq.com/videos/milestone-04-underwriting.mp4',  'https://cdn.ashleyiq.com/videos/thumbs/milestone-04.jpg',   100),
  (NULL, 'conditional_approval',  'Conditional Approval',    'You''re almost there — here''s what''s left',   'https://cdn.ashleyiq.com/videos/milestone-05-conditional.mp4',   'https://cdn.ashleyiq.com/videos/thumbs/milestone-05.jpg',    70),
  (NULL, 'clear_to_close',        'Clear to Close',          'The finish line is in sight',                    'https://cdn.ashleyiq.com/videos/milestone-06-ctc.mp4',           'https://cdn.ashleyiq.com/videos/thumbs/milestone-06.jpg',    65),
  (NULL, 'closing_scheduled',     'Closing Scheduled',       'What to expect on closing day',                 'https://cdn.ashleyiq.com/videos/milestone-07-closing.mp4',       'https://cdn.ashleyiq.com/videos/thumbs/milestone-07.jpg',    85),
  (NULL, 'funded',                'You''re Funded! 🎉',      'Congratulations — here''s what happens next',   'https://cdn.ashleyiq.com/videos/milestone-08-funded.mp4',        'https://cdn.ashleyiq.com/videos/thumbs/milestone-08.jpg',    60);
```

Note: The video URLs above use placeholder CDN paths. On first deploy, upload the actual MP4s to Supabase Storage under the `milestone-videos` bucket and update these URLs. The system works without videos — if a URL returns 404, the video player shows a graceful empty state and does not error.

---

### 23.2 — Milestone Video Player (Borrower Portal)

**Integration:** Extend the Phase 4.1 Visual Milestone Tracker in the borrower portal.

Each milestone stop gains a `"Learn more ▶"` button (Coastal Slate, 12px, below the milestone label). Clicking opens a bottom sheet (mobile) or modal (desktop).

**Video modal/sheet content:**
- Thumbnail with a centered play button (rendered with HTML5 `<video>` tag, no library)
- Title in Lora Bold 20px
- Subtitle in Instrument Sans 14px Coastal Slate
- Duration badge: `"2 min"` in DM Mono
- Video player fills the modal width, 16:9 aspect ratio
- Close button top-right

**Video resolution query:**
```typescript
// Fetch the video for this milestone:
// 1. Try tenant-specific override first
// 2. Fall back to default (tenant_id IS NULL)
const { data: video } = await supabase
  .from('milestone_videos')
  .select('*')
  .eq('milestone_key', milestoneKey)
  .eq('is_active', true)
  .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
  .order('tenant_id', { nullsLast: true })  // tenant override wins over default
  .limit(1)
  .single();
```

**If no video exists for a milestone:** do not show the `"Learn more"` button. No empty state, no error — simply absent.

**View tracking:** When a video is played (on `play` event), log to `celebration_events` with `event_type = 'video_viewed'` (add this value to the CHECK constraint) via `POST /api/portal/events`.

---

### 23.3 — LO Video Management (LO Dashboard)

**Location:** Settings → Borrower Portal → Milestone Videos

A table showing all 8 milestones. Each row:
- Milestone name
- Current video source: `"Ashley IQ Default"` or `"Custom"`
- Thumbnail preview (small, 48px wide)
- Duration
- `"Upload custom video"` button → opens a file input (accepts `.mp4`, `.mov`, max 100MB)
- `"Reset to default"` link (only shown when custom video exists)

**Upload flow:**
1. Client selects file
2. `POST /api/tenant/milestone-videos/upload` → streams file to Supabase Storage (`milestone-videos/{tenant_id}/{milestone_key}.mp4`)
3. Upserts a `milestone_videos` row with the tenant's `tenant_id`
4. Returns the public URL

**Storage bucket policy:** `milestone-videos` bucket is public-read, authenticated-write.

---

### 23.4 — Celebration Triggers

Two celebration moments, each firing portal + email experiences:

**Trigger 1 — Under Contract** (`lead.stage = 'under_contract'`)
**Trigger 2 — Funded / Closed** (`lead.stage = 'funded'`)

Wire these triggers in the existing stage transition logic (wherever `lead.stage` is updated). After a successful stage update:

```typescript
if (newStage === 'under_contract') {
  await triggerCelebration(lead, 'under_contract');
}
if (newStage === 'funded') {
  await triggerCelebration(lead, 'funded');
  await generateCongatsCertificate(lead);  // only on funded
}
```

`triggerCelebration` lives in `lib/celebration/index.ts`:
```typescript
export async function triggerCelebration(lead: Lead, type: 'under_contract' | 'funded') {
  // 1. Set a celebration flag on the portal session (borrower sees confetti on next visit)
  await supabase.from('leads').update({ celebration_pending: type }).eq('id', lead.id);

  // 2. Send celebration email via Resend
  await sendCelebrationEmail(lead, type);

  // 3. Log event
  await supabase.from('celebration_events').insert({
    lead_id: lead.id,
    tenant_id: lead.tenant_id,
    event_type: `${type}_email`,
  });
}
```

Add column to `leads`:
```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS celebration_pending text
  CHECK (celebration_pending IN ('under_contract', 'funded'));
```

When the borrower loads the portal and `celebration_pending` is set, the portal fires confetti, clears the flag, and logs the portal celebration event.

---

### 23.5 — Confetti (Portal)

**Package:** `canvas-confetti` — add to dependencies (`npm install canvas-confetti @types/canvas-confetti`).

**Implementation in the borrower portal layout:**

```typescript
// components/portal/CelebrationConfetti.tsx
'use client';
import { useEffect } from 'react';
import confetti from 'canvas-confetti';

interface Props {
  type: 'under_contract' | 'funded' | null;
}

export function CelebrationConfetti({ type }: Props) {
  useEffect(() => {
    if (!type) return;

    if (type === 'under_contract') {
      // Burst — celebratory but measured
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#C9A95C', '#0F1D2E', '#FFFFFF', '#F5F5F7'],
      });
    }

    if (type === 'funded') {
      // Full celebration — two-cannon burst
      const end = Date.now() + 3000;
      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#C9A95C', '#0F1D2E', '#2D7A4F'],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#C9A95C', '#0F1D2E', '#2D7A4F'],
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }

    // Clear the celebration flag after firing
    fetch('/api/portal/celebration/clear', { method: 'POST' });
  }, [type]);

  return null; // renders nothing — side-effect only
}
```

Render `<CelebrationConfetti type={lead.celebration_pending} />` in the borrower portal layout, passing the value from the lead record.

**Confetti colors:** Meridian Gold + Midnight Navy + white. Never Apple blue.

---

### 23.6 — Celebration Email Templates

Two Resend email templates. Both use HTML with an animated GIF header for confetti (static image fallback for Outlook). No external CSS frameworks — inline styles only in email HTML.

**Template 1 — Under Contract (`under_contract_celebration`)**

Subject: `"🏠 You're under contract, [FIRST_NAME]!"`

```html
<!-- Email structure (inline styles, no external CSS) -->
<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #FFFFFF;">

  <!-- Animated confetti GIF header -->
  <img src="https://cdn.ashleyiq.com/emails/confetti-header.gif"
       alt="Congratulations!"
       width="600"
       style="width: 100%; display: block;" />

  <!-- Gold accent bar -->
  <div style="background: #C9A95C; height: 4px;"></div>

  <!-- Body -->
  <div style="padding: 40px 48px;">
    <h1 style="font-family: Georgia, serif; font-size: 28px; color: #0F1D2E; margin: 0 0 8px;">
      You're under contract! 🎉
    </h1>
    <p style="font-size: 16px; color: #6B7B8D; margin: 0 0 24px;">
      Big news, [FIRST_NAME] — your offer was accepted.
      Here's what happens next on the path to closing.
    </p>

    <!-- Next steps (3 items, icon + text) -->
    <div style="background: #F5F5F7; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <p style="font-size: 14px; color: #0F1D2E; margin: 0 0 12px;">
        <strong>🔍 Appraisal</strong> — We've ordered an appraisal of the property.
        You'll hear back within 5–10 business days.
      </p>
      <p style="font-size: 14px; color: #0F1D2E; margin: 0 0 12px;">
        <strong>📋 Underwriting</strong> — Your file goes to underwriting next.
        They may request a few additional documents — respond quickly to keep things moving.
      </p>
      <p style="font-size: 14px; color: #0F1D2E; margin: 0;">
        <strong>📅 Closing date</strong> — Your target closing date is [CLOSING_DATE].
        We'll confirm the exact time and location as we get closer.
      </p>
    </div>

    <!-- CTA -->
    <a href="[PORTAL_URL]"
       style="display: inline-block; background: #0F1D2E; color: #FFFFFF;
              padding: 14px 32px; border-radius: 8px; font-size: 15px;
              font-family: system-ui, sans-serif; text-decoration: none;">
      View your loan status →
    </a>
  </div>

  <!-- LO signature -->
  <div style="padding: 24px 48px 40px; border-top: 1px solid rgba(15,29,46,0.10);">
    <p style="font-size: 13px; color: #6B7B8D; margin: 0;">
      Questions? I'm here.<br />
      <strong style="color: #0F1D2E;">[LO_NAME]</strong> · NMLS #[LO_NMLS]<br />
      [LO_PHONE] · [LO_EMAIL]
    </p>
  </div>
</div>
```

**Template 2 — Funded (`funded_celebration`)**

Subject: `"🏡 Congratulations, [FIRST_NAME] — you're a homeowner!"`

Same structure as the under-contract email, but:
- Headline: `"You're officially a homeowner! 🏡"` (purchase) or `"Your refinance is complete! 🎉"` (refi)
- Body: 2 sentences celebrating the moment, plus a reminder that the equity tracker in their portal is now live
- Include a preview thumbnail of their congrats certificate: `"Your certificate is ready to download ↓"`
- CTA: `"Download your certificate →"` linking to the portal

---

### 23.7 — Congrats Certificate (PDF)

**Generation trigger:** Automatically when `lead.stage` transitions to `'funded'`.

**API route:** `POST /api/leads/[id]/certificate/generate` (server-side, admin client)

**Two certificate variants:**
- `purchase` — "Congratulations on Your New Home!"
- `refinance` — "Congratulations on Your Refinance!" (detect by `lead.loan_purpose`)

**PDF generation approach — HTML template → PDF via Puppeteer (Supabase Edge Function):**

```typescript
// supabase/functions/generate-certificate/index.ts
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const html = buildCertificateHtml({
  type: certificate.certificate_type,
  borrowerName: certificate.borrower_name,
  coBorrowerName: certificate.co_borrower_name,
  propertyAddress: certificate.property_address,
  closingDate: certificate.closing_date,
  loanAmount: certificate.loan_amount,
  loName: certificate.lo_name,
  loNmls: certificate.lo_nmls,
  lenderName: certificate.lender_name,
});

const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath() });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });
const pdf = await page.pdf({ format: 'Letter', printBackground: true });
await browser.close();

// Upload to Supabase Storage
const { data } = await supabase.storage
  .from('certificates')
  .upload(`${tenantId}/${leadId}/certificate.pdf`, pdf, { contentType: 'application/pdf', upsert: true });
```

**`buildCertificateHtml` design spec:**

The certificate is a premium, print-quality 8.5"×11" document. Design language: elegant, minimal, frameable.

```
┌─────────────────────────────────────────────┐
│                                             │
│   [Ashley IQ Logo — top center]             │
│                                             │
│   ─────── Meridian Gold rule ───────        │
│                                             │
│   [LENDER_NAME]                             │
│   Proudly Presents                          │
│                                             │
│   ✦  Congratulations on Your New Home!  ✦  │
│      (or: Congratulations on Your Refi!)    │
│                                             │
│   Presented to                              │
│                                             │
│   [BORROWER NAME]                           │
│   [& CO-BORROWER NAME if present]           │
│                                             │
│   On the occasion of the successful         │
│   [purchase / refinance] of                 │
│                                             │
│   [PROPERTY ADDRESS]                        │
│                                             │
│   Closing Date: [DATE]                      │
│   Loan Amount:  $[AMOUNT]                   │
│                                             │
│   ─────── Meridian Gold rule ───────        │
│                                             │
│   [LO NAME]              Equal Housing      │
│   NMLS #[NMLS]           Lender  ⊞          │
│   [LENDER_NAME]                             │
│                                             │
└─────────────────────────────────────────────┘
```

**Typography in the certificate HTML:**
- "Congratulations on Your New Home!" — Lora Bold, 32px, Midnight Navy `#0F1D2E`
- "Presented to" — Instrument Sans, 14px, Coastal Slate `#6B7B8D`, letter-spacing 0.15em, uppercase
- Borrower name — Lora Bold, 28px, Midnight Navy
- Property address — Instrument Sans Regular, 18px, Midnight Navy
- Closing date + loan amount — DM Mono, 15px, Midnight Navy
- Gold rule: `border-top: 2px solid #C9A95C; width: 200px; margin: 24px auto;`

**Storage:** Store PDF in Supabase Storage bucket `certificates` (private). Generate a signed URL (1-year expiry) for download links. Update `closing_certificates.pdf_url` and `generated_at` after upload.

---

### 23.8 — Certificate in Borrower Portal

After `lead.stage = 'funded'`, the borrower portal home screen adds a permanent **Congrats section** above the milestone tracker:

```
┌──────────────────────────────────────────────┐
│  🏡  You're a homeowner, [NAME]!              │
│      Your closing certificate is ready.       │
│                                               │
│  [Download Certificate PDF]   [Share →]       │
└──────────────────────────────────────────────┘
```

Gold border (`border: 1.5px solid var(--c-gold)`), gold-tinted background (`var(--c-gold-light)`).

**Download button:** Calls `GET /api/portal/certificate/[token]` → returns a signed URL → browser downloads the PDF.

**Share button:** Opens a share sheet with 3 options:
1. **LinkedIn** — opens `https://www.linkedin.com/sharing/share-offsite/?url=[ENCODED_PORTAL_URL]` with pre-filled text: *"Just closed on my new home! Grateful for [LO_NAME] at [LENDER_NAME] for making it happen. 🏡 #NewHomeowner #[CITY]"*
2. **Copy link** — copies the portal URL to clipboard, shows `"Copied!"` for 2 seconds
3. **Download as image** — calls `POST /api/portal/certificate/[token]/image` which uses Puppeteer to render the certificate as a PNG (for Instagram), returns a download

Log each share action to `celebration_events` with `event_type = 'certificate_shared'` and `share_platform`.

---

### 23.9 — LO Dashboard — Celebration Overview

On the lead record, add a `"Celebration"` section in the activity timeline showing:

- 🎉 `"Under contract email sent"` + timestamp
- 🎉 `"Borrower viewed confetti celebration in portal"` + timestamp
- 📜 `"Closing certificate generated"` + timestamp + `[Preview]` link
- 📤 `"Certificate downloaded by borrower"` + timestamp
- 🔗 `"Shared to LinkedIn"` + timestamp (if applicable)

This is read-only, pulled from `celebration_events`.

---

## MIGRATIONS — RUN VIA SUPABASE MCP

Apply schema changes immediately after completing each phase. Do not batch at the end.

```
Phase 22: rate_options, rate_disqualifications, rate_selections, rate_portal_tokens, rate_portal_sessions
Phase 23: milestone_videos (+ seed defaults), celebration_events, closing_certificates
          ALTER leads ADD COLUMN celebration_pending
RLS:      All RLS policies and indexes (run after both phases)
```

For each migration:
1. Run SQL via Supabase MCP `execute_sql`
2. Confirm via `information_schema.tables` query
3. If table already exists, use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — never DROP

---

## FINAL STEP — AUTONOMOUS VERIFICATION

After both phases are built and all migrations applied, run every check below. Fix any failure before reporting done.

### Step 0 — Design Integrity Check (runs FIRST)
```bash
# Frozen files must not have been modified
git diff --name-only app/globals.css tailwind.config.ts app/layout.tsx

# No Apple blue
grep -rn "#007AFF\|#3478F6\|#0A84FF\|color: blue\|text-blue-[^t]" app/ components/ --include="*.tsx"

# No Tailwind gray backgrounds
grep -rn "bg-gray-[2-9]\|bg-slate-[2-9]\|bg-zinc-[2-9]" app/ components/ --include="*.tsx"

# No hardcoded hex in style props
grep -rn "style={{.*color.*#\|style={{.*background.*#" app/ --include="*.tsx"

# No new CSS files
find app/ components/ -name "*.css" ! -name "globals.css"

# No old Linen Ivory color
grep -rn "#F5EFE0" app/ components/ --include="*.tsx" --include="*.ts" --include="*.css"
```
If any of the above returns results: **STOP. Fix before proceeding.**

### Step 1 — TypeScript
```bash
npx tsc --noEmit
```
Fix every error. Zero tolerance.

### Step 2 — Schema Verification
```sql
-- Run via Supabase MCP
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'rate_options','rate_disqualifications','rate_selections',
  'rate_portal_tokens','rate_portal_sessions',
  'milestone_videos','celebration_events','closing_certificates'
);
-- Must return all 8 tables
```

### Step 3 — RLS Verification
```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN (
  'rate_selections','celebration_events'
)
ORDER BY tablename, cmd;
-- rate_selections: INSERT only (no UPDATE, no DELETE policies)
-- celebration_events: INSERT only (no UPDATE, no DELETE policies)
```

### Step 4 — Security: No SSN/DOB in new code
```bash
grep -rn "ssn\|dob\|date_of_birth\|social_security" \
  app/api/portal/ app/api/leads/ lib/pricing/ lib/celebration/ \
  --include="*.ts" --include="*.tsx"
# Must return zero results
```

### Step 5 — Portal Routes Exist
```bash
find app/portal -type f -name "*.tsx" | sort
# Must include: rates/[token]/page.tsx, rates/[token]/selected/page.tsx, expired/page.tsx
find app/api/portal -type f -name "route.ts" | sort
# Must include API routes for: session/start, session/end, select, celebration/clear
```

### Step 6 — Certificate Generation
```bash
# Confirm Edge Function exists
ls supabase/functions/generate-certificate/
# Must contain index.ts
```

### Step 7 — canvas-confetti installed
```bash
grep "canvas-confetti" package.json
# Must be present in dependencies
```

### Step 8 — Build Check
```bash
npm run build
# Must complete with zero errors
```

---

## COMPLETION REPORT

When all phases are built and all verification steps pass, output this report:

```
═══════════════════════════════════════════════════════════
ASHLEY IQ — BORROWER EXPERIENCE BUILD COMPLETE
═══════════════════════════════════════════════════════════

PHASE 22 — BORROWER DECISION PORTAL
  Schema:         [ ] rate_options  [ ] rate_disqualifications  [ ] rate_selections
                  [ ] rate_portal_tokens  [ ] rate_portal_sessions
  LO Rate Builder:  [ ] Manual entry (Option A)  [ ] Optimal Blue flag (Option B)
  AI Explanations:  [ ] Per-option  [ ] Disqualifications
  Portal pages:     [ ] /portal/rates/[token]  [ ] /selected  [ ] /expired
  Selection flow:   [ ] Confirmation modal  [ ] INSERT to rate_selections  [ ] LO notification
  Behavioral:       [ ] Session tracking  [ ] Hover data  [ ] LO intelligence panel
  Expiration:       [ ] 7-day expiry  [ ] Proactive alert  [ ] One-click extend

PHASE 23 — BORROWER CELEBRATION EXPERIENCE
  Schema:           [ ] milestone_videos (+ 8 defaults seeded)
                    [ ] celebration_events  [ ] closing_certificates
                    [ ] leads.celebration_pending column
  Milestone videos: [ ] Video player in portal  [ ] Tenant override upload
  Celebration:      [ ] Under contract trigger  [ ] Funded trigger
  Confetti:         [ ] Portal (canvas-confetti)  [ ] Under contract burst  [ ] Funded cannon
  Emails:           [ ] Under contract template  [ ] Funded template
  Certificate:      [ ] PDF generation (Puppeteer Edge Function)
                    [ ] Purchase variant  [ ] Refi variant
                    [ ] Download in portal  [ ] Share flow (LinkedIn / copy / image)
  LO Dashboard:     [ ] Celebration timeline on lead record

VERIFICATION
  [ ] Design freeze — no frozen files modified
  [ ] No Apple blue in any new file
  [ ] TypeScript: zero errors
  [ ] All 8 tables confirmed in schema
  [ ] rate_selections INSERT-only (RLS verified)
  [ ] celebration_events INSERT-only (RLS verified)
  [ ] No SSN/DOB in new code
  [ ] npm run build — zero errors

Issues encountered and resolved:
  1. [describe any issue and how it was fixed]

Ready for QA: YES / NO
═══════════════════════════════════════════════════════════
```
