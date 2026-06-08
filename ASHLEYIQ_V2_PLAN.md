# AshleyIQ v2 — Execution Plan

Maps the 21-phase v2 build prompt onto the **actual** AshleyIQ codebase and sequences it
by value + feasibility. Read this before starting any phase.

---

## ✅ VERIFIED GROUND TRUTH — 2026-06-08 (checked against live DB + code)

Project ref `dhnxiijduycmzfjmohyp`. Verified via Supabase Management API (sbp token now in
`.env.local`) and direct code search. **This supersedes assumptions below where they conflict.**

### ✅ WAVE 1 BUILT 2026-06-08 (all 10 phases; tsc 0 errors, design freeze intact)
Migrations applied: `20260608_wave1_conditions_scoring`, `_wave1_pipeline`, `_wave1_borrower_nextstep`.
- **5.1** condition_events (append-only, verified) + `lib/conditions/autoSatisfy.ts` (Sonnet native PDF) + `/api/conditions/auto-satisfy` + "Auto-match docs" in ConditionsChecklist.
- **1.2** lead-score route bug-fixed (real columns + getOrgContext) + `ai_score_factors` persisted + factors UI on lead detail.
- **5.2** `condition_templates` (37 platform seeds FHA/Conv/VA/DSCR) + `lib/conditions/templates.ts`, auto-populated by the events route.
- **1.1** `stage_transition_rules` (8 seeds) + `leads.stage_changed_at` (auto-trigger, verified) + `lib/leads/stageTransitions.ts` + `POST /api/leads/[id]/events`.
- **1.3** `leads.merged_into_id/archived_at` + `lib/leads/duplicates.ts` + `GET /api/leads/duplicates` + `POST /api/leads/merge`. (Dup modal not yet wired into a create flow — API-complete.)
- **1.4** `stage_sla_config` (7 seeds) + velocity alerts folded into `/api/notifications` (also fixed that route's latent clerk-orgId-vs-uuid bug). (No pipeline-board banner yet.)
- **18** engine: `lib/forms/conditionalRules.ts` + `hooks/useConditionalForm.ts` + `components/forms/ConditionalField.tsx` (+FormSuggestions) + `lib/forms/suggestions.ts`. (No 1003 form exists to wrap yet — engine ready.)
- **4.5** `lib/borrower/nextStep.ts` (Haiku, cached on `leads.next_step_ai*`) wired into borrower portal.
- **4.1** already built (borrower pipelineSteps + MilestoneTimeline) — verified, not rebuilt.
- **16** `UWSubmissionChecklist` + `/api/processor/uw-readiness/[leadId]`, wired into processing page; fires `loan_submitted_to_uw` → auto stage advance.

Deferred follow-ups: weekly pg_cron score recalc (1.2); dup-modal wiring (1.3); full Smart-1003 form (18); template/SLA settings UI (5.2/1.4); pipeline stalled banner (1.4).

### ✅ RESOLVED 2026-06-08: pending migrations applied — live DB now at 71 tables
`APPLY_MISSING_MIGRATIONS.sql` was applied via the Management API. The live `public` schema went
**28 → 71 tables** (all 56 migration-file-defined tables now present; "defined-but-missing" diff is
empty). Base tables intact, storage buckets `borrower-docs`/`bureau-responses` created, RLS +
policies attached. Existing pages (lenders, credit-repair, processor, social, etc.) now have their
tables. **Three fixes were required in `APPLY_MISSING_MIGRATIONS.sql` to make it apply** (kept in the
file): (1) cron `DO $$…$$` block re-tagged `$do$` to stop a nested-`$$` collision; (2)
`idx_lo_performance_unique` changed `period_month`→`snapshot_date` to match the live base table +
the edge-function `onConflict`; (3) all `auth.get_org_id()` refs → `public.get_org_id()` and the 3
inline `public.get_org_id()` definitions canonicalized to the live org-lookup body (was missing
`auth.get_org_id`, plus one self-recursive def). Next prerequisite work is unchanged: build v2 phases.

> The text below documents the pre-migration state for history.

### 🚨 (historical) #1 blocker: the live DB was at the BASE schema only
The live `public` schema had **28 tables — exactly the `20260531_conduit_v2_schema.sql` set**:
`organizations, profiles, leads, lead_activities, lead_notes, lead_tasks, communications,
documents, document_requests, audit_events, tcpa_consent_log, pii_access_log, mfa_status,
rate_limits, campaigns, campaign_steps, hmda_data, morning_briefings, ai_agent_runs,
automations, automation_executions, org_ai_config, borrower_portal_tokens,
partner_portal_tokens, widget_tokens, rate_watch, lo_performance_snapshots, referral_partners`.

**The other 11 migration files AND `supabase/APPLY_MISSING_MIGRATIONS.sql` are NOT applied.**
Tables many *existing* pages already query are absent live: `lenders` (7 code files),
`credit_repair_enrollments` (11), `processor_assignments` (8), `loan_conditions` (4),
`commissions`, `social_posts`, `nonqm_analyses`, etc. → **roughly half the current app is
non-functional against the live DB until migrations are applied. This is the first action,
before ANY v2 phase.** Apply via Management API (`POST /v1/projects/{ref}/database/query`)
now that the token works, or the Supabase SQL editor.

> ⚠️ Note: live `leads` and migration files use DIFFERENT names than `APPLY_MISSING` in places
> (e.g. base schema has `campaigns`/`campaign_steps`/`communications`/`documents`, while later
> migrations add `nurture_sequences`/`inbound_messages`/`call_log`). Reconcile names against the
> live schema (not the migration files) before writing any query.

### Wave-1 phase reality (code-level, verified)
| Phase | Status | Evidence |
|---|---|---|
| 1.1 stage auto-progression | ❌ missing | no `evaluateStageTransitions`/`stage_transition_rules` anywhere |
| 1.2 lead scoring | 🟡 partial | `app/api/ai/lead-score/route.ts` exists; **no `score`/`score_factors` columns** on `leads` (not in code or DB) — add columns + persistence + weekly cron |
| 1.3 dup detection / 1.4 velocity | ❌ missing | no matching code/tables |
| 5.1 AI condition satisfaction | 🟡 partial | `app/api/ai/parse-conditions/route.ts` exists (extracts conditions from a doc) but NOT the open-condition **auto-match/auto-satisfy** flow — biggest-ROI gap, build on the existing route |
| 5.2 condition templates | ❌ missing | `loan_conditions` table itself not live yet |
| 16 processor suite | 🟡 code exists, tables missing | `app/(dashboard)/processor/*` + `app/api/processor/{accept,context,invite,revoke}` built on `processor_assignments`/`loan_conditions` — **needs migrations applied to function** |
| 18 Smart 1003 | ❌ missing | no `useConditionalForm`/`ConditionalField` |

### Schema-translation correction (immovable rule #1 conflicts with live schema)
The v2 prompt says "SSN/DOB are **never** written to the DB." The live `leads` table
**intentionally stores** `ssn_encrypted`/`ssn_iv`/`income_encrypted`/`income_iv` (AES-256-GCM at
the app layer, `lib/compliance/encryption.ts`) plus `date_of_birth` (encrypted) and
`credit_score`. **Keep the existing encrypt-at-app-layer model. Do NOT "fix" it to match the
prompt** — that would break working PII handling. Apply the prompt's "never store raw" rule only
to *new* surfaces (e.g. `borrower_application_sessions.partial_data` must reject SSN/DOB).

### Env / tooling state
- `.env.local` was **destroyed and partially recovered on 2026-06-08** — Supabase trio + sbp token
  restored from the Management API; **25 service secrets must be re-pasted** (Clerk, Stripe,
  Anthropic, Resend, Sentry, Twilio, Soft Pull, Lob, Stripe-credit-repair, `CURRENT_MARKET_RATE`).
  Vercel stores 14 of them but as **Sensitive** (un-pullable) → fetch from each service dashboard.
- Migration application channel: **Supabase Management API** with the `sbp_` token (no MCP). The
  v2 prompt's "verify via Supabase MCP" steps → translate to Management-API `database/query` calls.

---

## 0. Schema reconciliation (READ FIRST — the v2 prompt assumes a different schema)

The v2 prompt was written against a generic multi-tenant schema. Our codebase differs.
**Translate every v2 reference as follows before writing any SQL or query:**

| v2 prompt says | Our codebase actually uses |
|---|---|
| `tenants(id)`, `tenant_id` | `organizations(id)` (uuid), `org_id uuid` |
| `users(id)` (LOs/staff) | Clerk users + `profiles` table (`profiles.id` uuid, `profiles.clerk_user_id` text) |
| `lead.status` | `leads.stage` — CHECK values: `new_inquiry, pre_qual, application, processing, underwriting, conditional_approval, clear_to_close, closed, declined, withdrawn` |
| `loan_type = 'Conventional'/'FHA'` (capitalized) | lowercase: `conventional, fha, va, usda, jumbo, non_qm, heloc, construction, reverse, commercial, dscr` |
| RLS via `tenant_id = ...` | RLS via `auth.get_org_id()` helper; reads use **admin client + explicit `.eq('org_id', orgId)`** (Clerk isn't wired to Supabase RLS — see `lib/auth/orgContext.ts`) |
| `lead_events` / `conditions` | confirm exact table names against `supabase/migrations/` before use |

**Org/auth pattern:** every new server route/page uses `getOrgContext()` (`lib/auth/orgContext.ts`)
→ `{ userId, clerkOrgId, orgId(uuid), role }`, then `createAdminClient()` with `.eq('org_id', orgId)`.

**Anthropic model in use:** `claude-haiku-4-5-20251001` (fast/in-product). Use Sonnet for analysis/doc review.

---

## PREREQUISITE — apply the 10 pending migrations FIRST

Many phases extend tables that don't exist in the live DB yet (lenders, tasks, processing,
credit-repair, marketing, etc.). Apply `supabase/APPLY_MISSING_MIGRATIONS.sql` (Supabase SQL
Editor) or via the `sbp_` token **before** Wave 1. Without this, ~half the existing pages and
most v2 phases have no tables to build on.

---

## Dependency legend
- 🟢 **none** — pure code, builds on current stack (Supabase + Clerk + Next). Anthropic key is already set, so Claude features count as 🟢.
- 🟡 **have-it** — needs Twilio / Resend / Stripe (already in the stack; verify env keys).
- 🔴 **external** — needs a third-party partner application + API keys you do NOT have yet (lead time: days–weeks).
- 🗄️ **migration** — needs new tables (apply via sbp_ token / SQL editor).

---

## WAVE 1 — Highest value, no external vendors (do first, post-demo)

| Phase | Feature | Deps |
|---|---|---|
| 1.1 | Automated stage progression (`stage_transition_rules` + `evaluateStageTransitions`) | 🟢 🗄️ |
| 1.2 | Lead scoring 0–100 (Claude) + weekly pg_cron recalc | 🟢 🗄️ |
| 1.3 | Duplicate detection + merge | 🟢 🗄️ |
| 1.4 | Pipeline velocity / stale-lead alerts (pg_cron → notifications) | 🟢 🗄️ |
| 5.1 | **AI condition satisfaction** (Claude reads uploaded docs, auto-matches conditions) — highest ROI in the product | 🟢 🗄️ |
| 5.2 | Loan-program condition templates (FHA/Conv/VA/DSCR seed sets) | 🟢 🗄️ |
| 18 | Smart 1003 conditional fields (`useConditionalForm` hook + `<ConditionalField>`) + inline Claude suggestions | 🟢 |
| 4.1 | Borrower portal visual milestone tracker | 🟢 |
| 4.5 | "What happens next" plain-English card (Claude Haiku, cached per stage) | 🟢 |
| 16 | Processor suite (file pipeline board, conditions workflow, UW checklist, doc stacking) — uses `processor_assignments` from sprint2 | 🟢 🗄️ |

## WAVE 2 — Needs Twilio / Resend / Stripe (already in stack — verify keys)

| Phase | Feature | Deps |
|---|---|---|
| 2.1–2.3 | Capacity-aware routing, response-rate throttling, time-of-day rules | 🟢 🗄️ |
| 2.4 | AI pre-qualification agent (Twilio SMS + Claude) — **TCPA opt-in required** | 🟡 🗄️ |
| 2.5 | Lead accept/reject (60s) | 🟢 🗄️ |
| 4.2 | Two-way borrower↔LO messaging (Supabase Realtime + Resend) | 🟡 🗄️ |
| 7 | Recruiting 5-touch sequences + ramp tracking + interview scheduling | 🟡 🗄️ |
| 11.1/11.2/11.4/11.5 | Credit score simulator, AI roadmap, dispute timer, portal credit journey (Claude; Soft Pull stays mock) — **CROA gate if a fee is charged** | 🟢 🗄️ |
| 12.1 | Two-way SMS inbox (Twilio webhook + Claude draft replies) | 🟡 🗄️ |
| 12.2/12.3 | If/then drip sequences with branching | 🟡 🗄️ |
| 12.4/13 | Partner co-marketing portal + agent-safe condition package | 🟢 🗄️ |
| 12.5/12.6 | Campaign analytics + rate-alert opt-in | 🟡 🗄️ |
| 3.x | POS: short-form pre-qual, save-and-return, doc upload, DSCR POS | 🟢 🗄️ |
| 3.6 | Spanish i18n (next-intl) — pure code | 🟢 |

## WAVE 3 — Needs external partner credentials (APPLY NOW; long lead time)

| Phase | Feature | Apply at |
|---|---|---|
| 8.1 | Optimal Blue / **Polly** live pricing (PPE) | optimalblue.com/become-a-partner · polly.io (Polly is faster to onboard) |
| 8.2 | Dual AUS (Fannie DU + Freddie LP) | Fannie Mae / Freddie Mac technology integration programs |
| 8.3 | E-sign disclosures (initial LE within TRID 3-day window) | PrimeMind Sign SDK (`@primemind/sign-react`) |
| 11.3 | Rapid rescore | creditplus.com or corecredco.com |
| 14 | Ad/social center auto-post | Facebook & LinkedIn developer apps |

Until each is approved: build the route + a **real disabled state** with `TODO: set env var`. Never fake data.

## WAVE 4 — Large pure-code build-outs (sequence after Waves 1–2)

| Phase | Feature | Deps |
|---|---|---|
| 6 | Commissions: splits, manager overrides, clawbacks, projections, 1099/W2 export — **Reg Z 1026.36: comp keys on loan amount only (DB constraint)** | 🟢 🗄️ |
| 9 | Call reports: fallout, pull-through, market share, compare-periods, scheduled delivery, **HMDA LAR export** | 🟢 🗄️ |
| 10 | Equity tracker: refi opportunity scoring, rate-gap alerts (Freddie PMMS), home-value trend, cash-out modeler, annual report | 🟢 🗄️ |
| 15 | Training LMS (courses, quizzes, compliance certs, onboarding path) | 🟢 🗄️ |
| 17 | Income calculators (Fannie 1084 / Freddie 91, rental, SS gross-up) + expanded DSCR | 🟢 🗄️ |
| 19 | Buyer experience (closing countdown, moving checklist, first-payment reminder, referral program, shareable pre-approval certificate) | 🟢 🗄️ |
| 20 | Investor module (entity resolution, portfolio aggregation; ATTOM multi-property via DeedMine) | 🟢/🔴 🗄️ |
| 21 | Partner referral bridge (CLOSA inbound/outbound + generic partner API) | 🔴 🗄️ |

---

## NON-NEGOTIABLE security rules (enforce every phase)
1. **SSN/DOB never written to DB** — in-memory to Soft Pull only, then discarded. Grep before every commit.
2. **Audit tables INSERT-only RLS** (deny UPDATE/DELETE for ALL roles incl. service_role): `condition_events, payroll_events, los_sync_events, opt_ins, opt_outs, credit_pull_events, dispute_events, rate_lock_events, campaign_events, partner_events, score_events, clawback_events`.
3. **No mock data in production paths** — real disabled state + `TODO` instead.
4. **TCPA** — no SMS/voice without a verified `opt_in` (consent language + timestamp + IP).
5. **Reg Z 1026.36** — LO comp keys on loan amount only; enforce at DB constraint.
6. **CROA** — disclosure + e-sign + 3-day cancel window before any credit-repair charge.
7. `tsc --noEmit` clean (no `as any`) at the end of each phase; `npm run build` is the real gate (note: `next.config` has `ignoreBuildErrors` — so build catches only syntax/import errors, not types).

## Recommended order
Apply pending migrations → Wave 1 (1.2 lead scoring + 5.1 AI conditions first — biggest "wow") → Wave 2 → kick off Wave 3 partner applications in parallel → Wave 4.
