# Ashley IQ — Complete Gap Report
**Date:** 2026-06-28
**Codebase:** /Users/ashley/primemindlabs/conduit-next/
**Method:** Every page.tsx, route.ts, and lib/*.ts read directly via automated agents. Phase grep sweeps run across all app/ and lib/ directories.

---

## Executive Summary

Ashley IQ is a large, deeply built mortgage platform with 218 dashboard pages, 685+ API routes, 179 Supabase tables (all with RLS), and 340+ lib files. The **core LOS, TRID engine, compliance layer, CRM, and borrower portal are substantially real** — built with production-quality patterns. The platform is approximately 78% built-to-production-standard and 22% gated/stubbed/static. The top three risks before first customer: (1) the `applications` phantom table breaks the entire borrower application flow at submit; (2) e-signature (PrimeMind Sign SDK) is a non-functional stub regardless of env var configuration; (3) AWS Textract document extraction also throws unconditionally. Launch readiness requires fixing the phantom table bug plus activating 6–8 third-party integrations via environment variables.

---

## Part 1: Pages — Status Map

### Dashboard Pages (218 pages read)

#### Summary by area

| Status | Count | Notes |
|---|---|---|
| REAL | ~180 | Full Supabase queries, real business logic |
| THIN | ~28 | Auth shell delegates entirely to client component; client may be real |
| PARTIAL | ~6 | Real server data but some hardcoded values or env-var-dependent features |
| PLACEHOLDER / STUB | 2 | Fully static with hardcoded mock data, no live connection |

#### Confirmed STUB pages (hardcoded data, no live API)

| Route | Status | Notes |
|---|---|---|
| `ai-agents/page.tsx` | STUB | `const AGENTS = [...]` — 100% hardcoded. Status fields (`active`, `idle`, `2`), lastRun times, and metricValues are all static TypeScript constants. No Supabase queries, no API calls. Presents agent statuses as if live. |
| `automations/page.tsx` | STUB | `const MOCK_AUTOMATIONS: Automation[] = [...]` drives all state via `useState(MOCK_AUTOMATIONS)`. No fetch, no Supabase. Toggle interactions affect local state only and do not persist. |

#### THIN pages (notable ones — auth guard + client component, no server data)

| Route | Status | Notes |
|---|---|---|
| `settings/widget/page.tsx` | THIN | `useState('demo_widget_token_abc123')` hardcoded. Widget stats show `—`. No persisted token. |
| `prospecting/page.tsx` | THIN | `MARKET_RATES` array hardcoded. No live rate feed. |
| `pricing/page.tsx` | THIN | Shell to `PricingClient` |
| `pricing/best-execution/page.tsx` | THIN | Shell to `BestExecutionClient` |
| `commercial/page.tsx` | THIN | Pure local calculator, no Supabase |
| `dscr/page.tsx` | THIN | Pure local calculator, hardcoded defaults |
| `dscr-calculator/page.tsx` | THIN | Pure local calculator |
| `income/page.tsx` | THIN | Client-side calculator only |
| `marketing/market-update/page.tsx` | THIN | Delegates to client component |
| `my-book/arm-watch/page.tsx` | THIN | Delegates to `ARMResetClient` |
| `outreach/page.tsx` | THIN | Delegates to `OutreachClient` |
| `referral-attribution/page.tsx` | THIN | Shell |
| `refi-watch/page.tsx` | THIN | Delegates to two components |
| `relationships/heat/page.tsx` | THIN | Shell to `BorrowerHeatGrid` |
| `settings/automations/page.tsx` | THIN | Shell to `AutomationsClient` |
| `settings/concierge/page.tsx` | THIN | Shell |
| `settings/integrations/page.tsx` | THIN | Shell to 5 sub-components |
| `settings/notifications/page.tsx` | THIN | Pure static alert-type list |
| `settings/team-billing/page.tsx` | THIN | Shell |
| `settings/text-to-apply/page.tsx` | THIN | Shell |
| `social/ideas/page.tsx` | THIN | Shell to `ContentStudioClient` |
| `speed-to-lead/page.tsx` | THIN | Shell |
| `team-chat/page.tsx` | THIN | Shell |
| `training/ask/page.tsx` | THIN | Shell to `AskAshley` |
| `training/library/page.tsx` | THIN | Shell to `TrainingLibrary` |
| `reports/mcr/page.tsx` | THIN | Role check + `McrClient` |
| `rate-locks/page.tsx` | THIN | Shell to `ExpiringLocksWidget` |
| `rate-sheets/page.tsx` | THIN | Shell to `RateSheetParser` |

#### PARTIAL pages (real but with known gaps)

| Route | Status | Notes |
|---|---|---|
| `relationships/borrowers/[id]/property-intelligence/market-alerts/page.tsx` | PARTIAL | Uses `process.env.CURRENT_MARKET_RATE \|\| 6.5` — stale hardcoded rate if env var unset |
| `relationships/borrowers/[id]/property-intelligence/refi-watch/page.tsx` | PARTIAL | Same `CURRENT_MARKET_RATE \|\| 6.5` fallback |
| `my-tasks/page.tsx` | PARTIAL | Fetches profile ID only; all task logic in client component |
| `leads/[id]/hmda/page.tsx` | PARTIAL | Fields start empty; no initial DB read — only populated after AI prefill button clicked |
| `impact/page.tsx` | PARTIAL | Depends entirely on `/api/ai/impact` being wired |
| `loans/[loanId]/underwriting/credit/page.tsx` | THIN | Reads `leads.credit_score` only; renders static tier badge. No tradelines, no interactive pull component in the page. |

### Portal / External Pages

| Route | Status | Notes |
|---|---|---|
| `(borrower)/status/[token]/page.tsx` | REAL | Most complete portal — 8+ queries, AI next-step, milestone tracker |
| `(borrower)/preferences/[token]/page.tsx` | REAL | Token validated, delegates to `BorrowerPreferences` |
| `(borrower)/verify/[token]/page.tsx` | REAL | Token-gated identity verification |
| `(partner)/[token]/page.tsx` | REAL | Full partner portal with last-name masking, stats |
| `apply/page.tsx` | REAL | Public referral landing with white-labeling |
| `apply/[slug]/page.tsx` | REAL | Slug-to-LO resolution |
| `apply/form/[token]/page.tsx` | THIN | No server-side token validation in page itself |
| `apply/o/[org]/page.tsx` | REAL | Org-slug lookup |
| `apply/o/[org]/[mlo]/page.tsx` | REAL | Dual org+MLO lookup |
| `apply/resume/[token]/page.tsx` | PARTIAL | **BUG:** Continue CTA is hardcoded to `href="/apply"` — drops borrower context |
| `apply/smart/[token]/page.tsx` | REAL | Full Smart 1003 from saved `loan_applications` |
| `cert/[token]/page.tsx` | REAL | Pre-approval cert with 90-day validity window |
| `portal/realtor/[token]/page.tsx` | REAL | Full permission-tier enforcement, milestone tracker |
| `portal/realtor/team/[token]/page.tsx` | REAL | Parent realtor permission inheritance |
| `portal/title/[token]/page.tsx` | REAL | Closing portal, conditions, wire security notice |
| `widget/[token]/page.tsx` | REAL | 6-step pre-qual with TCPA consent |

---

## Part 2: Stubbed / Gated API Routes

| Route | Status | Gate/stub condition | What's missing |
|---|---|---|---|
| `loans/[loanId]/aus` (POST) | GATED | No AUS vendor connection in DB | Native Fannie DU / Freddie LPA adapters; falls through to `generic` MISMO POST |
| `loans/[loanId]/credit-pull` (POST) | GATED | No credit vendor connection in DB | Native adapters for Factual Data, MeridianLink, etc. |
| `loans/[loanId]/plaid/link-token` | GATED | `PLAID_CLIENT_ID` / `PLAID_SECRET` not set; SDK not installed | Plaid npm package install + env vars |
| `loans/[loanId]/sign` (POST) | GATED | `lib/sign/client.ts` always returns `{ gated: true }` — code comment says "When provisioned:" and never runs | PrimeMind Sign SDK install + real `createEnvelope()` implementation |
| `loans/[loanId]/voie` (POST) | GATED | No VOIE vendor connection in DB | Native Truework / Work Number / Plaid Income adapters |
| `loans/[loanId]/submit` (POST) | GATED | No lender endpoint connected | Live lender submission endpoint configuration |
| `loans/[loanId]/extract-document` (POST) | GATED | `TextractNotConfiguredError` thrown unconditionally | AWS SDK install + uncomment implementation in `lib/ai/textract.ts` |
| `ppe/quote` | GATED | No Optimal Blue connection | OB account + `ppe_connections` row |
| `income/extract` | GATED | `ANTHROPIC_API_KEY` missing → 501 | Set env var (Claude-based, not Textract) |
| `dialer/call` | GATED | `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` not set | Twilio account + env vars |
| `dialer/token` (WebRTC) | GATED | `TWILIO_API_KEY` / `TWILIO_API_SECRET` / `TWILIO_TWIML_APP_SID` not set | Twilio WebRTC sub-account setup |
| `webhooks/encompass` | GATED | `ENCOMPASS_WEBHOOK_SECRET` not set | ICE Encompass partner agreement + secret |
| `webhooks/sign` | GATED | `PRIMEMIND_SIGN_WEBHOOK_SECRET` not set | PrimeMind Sign provisioning |
| `apply/[token]/section/[section]` | BROKEN | Queries `from('applications')` — table does not exist in any migration | Must rename to `loan_applications` |
| `apply/[token]/submit` | BROKEN | Queries `from('applications')` — table does not exist in any migration | Must rename to `loan_applications` |
| `apply/[token]` | BROKEN | Queries `from('applications')` — table does not exist in any migration | Must rename to `loan_applications` |
| `loans/[loanId]/flood` | PARTIAL | Falls back with `{ fallback: true }` if ATTOM not configured; FEMA free API used as secondary | Set `ATTOM_API_KEY` for primary lookup |
| `ppe/price` | PARTIAL | Works with rate sheets only; no live PPE until OB connected | OB connection or LoanPASS per-tenant config |
| `reports/hmda-lar` | PARTIAL | LEI, ULI, applicant demographics, rate spread columns are blank | POS demographic collection module |
| `amc/connect` | PARTIAL | Credential stored + encrypted; live AMC ordering still gated on live AMC credentials | Mercury API credentials |

---

## Part 3: Lib Gaps — TODOs, Mocks, Stubs

| File | Line | Issue | Severity |
|---|---|---|---|
| `lib/sign/client.ts` | 30 | `createEnvelope()` always returns `{ gated: true }`. Comment: "When provisioned: ...". Implementation is commented out. `@primemind/sign-react` not installed. E-signatures are completely non-functional. | CRITICAL |
| `lib/ai/textract.ts` | 43–55 | `runTextract()` throws `TextractNotConfiguredError` unconditionally even when AWS env vars are set. Implementation commented out. `@aws-sdk/client-textract` not installed. | CRITICAL |
| `lib/credit-repair/lob.ts` | 54 | When `LOB_API_KEY` is unset, returns `{ lobId: 'mock_ltr_...', mocked: true }` in ALL environments including production. No production guard. Dispute letters appear sent but are never physically mailed. | HIGH |
| `lib/communications/nmlsGate.ts` | 72–80 | `commsGateGuard()` always returns `null` (never blocks). NMLS gate is "warning-only" by design. Outbound comms to borrowers without LO NMLS on file succeed silently. | HIGH |
| `lib/integrations/ppe/loanpass.ts` | 7 | Self-labeled stub: "STUB: field IDs and endpoint path follow documented public API shape, but are TENANT-CONFIGURED." Field ID map needs per-tenant verification before any LoanPASS tenant goes live. | HIGH |
| `lib/los/syncLoan.ts` | ~75 | `// TODO(conditions): upsert loan conditions → loan_conditions once the LOS condition payload shape is confirmed.` LOS conditions are never imported into Ashley IQ. | MEDIUM |
| `lib/los/statusMap.ts` | ~30 | `// TODO: add the real loan-status strings once confirmed.` Arive loan stage sync incomplete. | MEDIUM |
| `lib/compliance/tcpa.ts` | 12 | `STANDARD_TCPA_CONSENT_TEXT` names "AshleyIQ" platform brand — in white-label portals the LO/org name should appear. | MEDIUM |
| `lib/credit-repair/croa.ts` | 9, 15, 17 | References "AshleyIQ" brand (old name). Hardcoded `$19.99/month` fee at line 17. | MEDIUM |
| `lib/email/footer.ts` | 24 | `process.env.COMPANY_NAME \|\| 'AshleyIQ'` — falls back to old brand name if env var not set. All outbound email footers will say "AshleyIQ" until `COMPANY_NAME` is set. | MEDIUM |
| `lib/resend.ts` | 17 | `FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@ashleyiq.com'` — old domain fallback. | MEDIUM |
| `app/api/ai/rate-watch/route.ts` | 10 | `const CURRENT_MARKET_RATE = 6.875; // Placeholder — replace with live FRED/Freddie API` — hardcoded constant with no env var gate. Used in 7+ places in this route. | MEDIUM |
| `lib/compliance/dncScrub.ts` | ~45 | `DNC_API_BASE` defaults to `'https://api.dnc.com'` which is a placeholder URL, not a real vendor endpoint. National registry scrub silently skips if `DNC_API_KEY` unset. | MEDIUM |
| `lib/brain/generateEmbedding.ts` | 33 | OpenAI embeddings (`OPENAI_API_KEY`) power the brain/memory vector search. If key absent, embedding returns `null` and no memories are stored. Brain feature is silently disabled. | MEDIUM |
| `lib/creditAlerts/pipeline.ts` | 65–66 | Credit alert SMS/email delivery not wired. `CREDIT_ALERTS_LIVE !== 'true'` skips all outbound sends. | LOW |
| `lib/realtors/notifications.ts` | 54 | Realtor SMS notifications not wired. `REALTOR_NOTIFY_LIVE !== 'true'` skips Twilio send. | LOW |
| `lib/voicemail/deepgram.ts` | 7 | `DEEPGRAM_API_KEY` unset → returns `null` → voicemail transcription silently disabled. | LOW |
| `lib/amc/mercury.ts` | ~60 | Throws (not returns gated) on missing credential. Callers must wrap in try/catch or get 500s. | LOW |

---

## Part 4: LOS Feature Map

### Application / 1003
| Feature | Status | Notes |
|---|---|---|
| Smart 1003 / URLA adaptive form | ✅ Built | `components/apply/sections/` — 8 sections, conditional logic, `apply/smart/[token]` public route |
| Borrower Info section | ✅ Built | `loans/[loanId]/application/borrower/page.tsx` + API |
| Employment section | ✅ Built | `loans/[loanId]/application/employment/page.tsx` |
| Income section | ✅ Built | `loans/[loanId]/application/income/page.tsx` |
| Assets section | ✅ Built | `loans/[loanId]/application/assets/page.tsx` |
| Declarations section | ✅ Built | `loans/[loanId]/application/declarations/page.tsx` |
| Co-Borrower section | ✅ Built | `loans/[loanId]/application/co-borrower/page.tsx` |
| Loan & Property section | ✅ Built | `loans/[loanId]/application/loan-property/page.tsx` |
| Real Estate Owned section | ✅ Built | `loans/[loanId]/application/real-estate/page.tsx` |
| HMDA demographics capture | ✅ Built | `loans/[loanId]/application/hmda/page.tsx` + `hmda_data` table |
| MISMO 3.4 XML export | ✅ Built | `loans/[loanId]/mismo/route.ts` → `lib/mismo/buildUrla.ts` |

### Credit
| Feature | Status | Notes |
|---|---|---|
| Tri-merge hard pull | ⚠️ Partial/Gated | `lib/creditPull/pull.ts` is real; gated on credit vendor connection. Generic adapter only. Named vendors (Factual Data, MeridianLink, etc.) fall back to generic. |
| Soft pull (credit repair) | ⚠️ Gated | `lib/credit-repair/softpull.ts` gated on `SOFT_PULL_API_KEY`. Mock data in dev. Throws in prod without key. |
| Credit score display / UW view | ⚠️ Partial | `underwriting/credit/page.tsx` shows only a static tier badge from `leads.credit_score`. No tradeline detail view built. |
| Credit monitoring / alerts | ⚠️ Gated | Schema + pipeline built; delivery gated on `CREDIT_ALERTS_LIVE=true` |
| Credit repair pipeline | ✅ Built | Full enrollment flow, disputes, tradelines — `credit-repair/enrollment/[enrollmentId]/page.tsx` |
| Credit score simulator | 🔲 No page found | Not built |
| Rapid rescore workflow | 🔲 No page found | Not built |

### AUS
| Feature | Status | Notes |
|---|---|---|
| Fannie Mae DU live submission | ⚠️ Gated | Falls back to `genericAus` (MISMO POST). `fannie_du` listed in registry but native adapter not built. |
| Freddie Mac LP/LPA live submission | ⚠️ Gated | Same as above — falls back to `genericAus`. |
| AUS findings import + parsed conditions | ⚠️ Partial | Results recorded in DB; parsed condition text available; but `TODO(conditions)` in `syncLoan.ts` means LOS-sourced conditions are not auto-imported. |
| AUS rerun management | ✅ Built | `loans/[loanId]/aus/page.tsx` + GET history endpoint |
| AI condition prediction (pre-AUS) | ✅ Built | `predicted_conditions` table + `lib/ai/conditionPredictor.ts` |

### Pricing / Secondary
| Feature | Status | Notes |
|---|---|---|
| Internal pricing calculator (eligibility + estimates) | ✅ Built | `lib/ppe/engine.ts` + rate sheet source |
| Live PPE (Optimal Blue) | ⚠️ Gated | `lib/integrations/ppe/optimalBlue.ts` real but gated on OB connection |
| LoanPASS PPE | ⚠️ Partial | `lib/integrations/ppe/loanpass.ts` self-described stub — field IDs need per-tenant verification |
| Rate options UI on loan file | ✅ Built | `pricing/rate-options/page.tsx` — real LLPA-adjusted table from rate sheets |
| Rate lock request + approval UI | ✅ Built | `pricing/rate-lock/page.tsx` + `rate_lock_requests` table |
| Lock extension / renegotiation / float-down | ✅ Built | `rate-locks/[leadId]/extension/*` API + `lib/rate-lock/` |
| Break-even analysis | ✅ Built | `pricing/break-even/page.tsx` — seeds real loan_amount |
| Investor commitment tracking / secondary pipeline | 🔲 No dedicated page | `investors/page.tsx` tracks investor entities but no secondary market commitment workflow |

### Disclosures (TRID)
| Feature | Status | Notes |
|---|---|---|
| TRID business day engine | ✅ Built | `lib/compliance/trid.ts` — full federal holiday calendar, 3-BD and 7-BD clocks |
| LE issuance UI + 3-BD clock tracking | ✅ Built | `disclosures/loan-estimates/page.tsx` + `trid_events` table |
| LE PDF generation | ✅ Built | `lib/disclosures/buildLoanEstimate.ts` + `issueDisclosure()` |
| Changed Circumstances re-disclosure | ✅ Built | `disclosures/changed-circumstances/page.tsx` + `trid_events` |
| CD issuance UI | ✅ Built | `disclosures/page.tsx` + CD workflow |
| CD PDF generation | ⚠️ Partial | `lib/disclosures/buildLoanEstimate.ts` covers LE; CD-specific generation not confirmed in lib |
| CD Balancer (tolerance calculator) | ✅ Built | `disclosures/cd-balancer/page.tsx` + `CdBalancerClient` |
| Wire safety / verification | ✅ Built | `disclosures/wire-safety/page.tsx` + `lib/title/wireVerification.ts` |
| TRID audit trail export | ✅ Built | `disclosures/audit/page.tsx` — merges `consent_audit_log` + `tcpa_consent_log` + `communications` |
| eSign for disclosures | ⚠️ Gated/Stub | `lib/sign/client.ts` returns `{ gated: true }` unconditionally. Sign SDK not installed. |
| Initial disclosure package (ECOA, CHARM, ARM) | 🔲 Not found | No CHARM booklet or ARM servicing disclosure generation found |

### Processing
| Feature | Status | Notes |
|---|---|---|
| Condition management (create / satisfy / clear) | ✅ Built | `docs-compliance/conditions/page.tsx` + `loan_conditions` table + `ConditionsManager` |
| PTA / PTD / PTF condition buckets | ✅ Built | In `ConditionsManager` component |
| Document stacking / eFolder | ✅ Built | `docs-compliance/documents/page.tsx` + `document_requests` + `condition_documents` |
| Document AI auto-extraction | ⚠️ Gated/Broken | Page and API route built; `lib/ai/textract.ts` throws unconditionally — AWS SDK not installed |
| Smart checklist | ✅ Built | `docs-compliance/smart-checklist/page.tsx` + AI-driven `generateChecklist()` |
| Milestone tracking | ✅ Built | `loan_milestones` + `MilestoneTimeline` component |
| Processor assignment workflow | ✅ Built | `processor/` pages + `processor_assignments` table |
| Loan timeline / activity feed | ✅ Built | `loans/[loanId]/timeline/page.tsx` — merges stage_transitions + communications |
| Title ordering | ✅ Built | `loans/[loanId]/title/page.tsx` + `TitleStatusPanel` |
| Homeowners insurance verification | 🔲 Not found | No HOI verification page or API found |
| Document expiration tracking | ✅ Built | `docs-compliance/expirations/page.tsx` — 7 table queries |

### Underwriting
| Feature | Status | Notes |
|---|---|---|
| DTI worksheet | ✅ Built | `underwriting/dti/page.tsx` + `dti_worksheets` table |
| Income analysis (UW view) | ✅ Built | `underwriting/income/page.tsx` — `income_calculations` + `dti_worksheets` |
| Assets & reserves (UW view) | ✅ Built | `underwriting/assets/page.tsx` — reserves worksheet from `applications` table |
| HOA warrantability | ✅ Built | `underwriting/hoa/page.tsx` + `lib/hoa/warrantability.ts` |
| Risk score | ✅ Built | `underwriting/risk/page.tsx` + `buildRisk()` from real loan data |
| Credit analysis (UW view) | ⚠️ Thin | Only `credit_score` field — no tradeline analysis |
| Condition clearing (UW view) | ✅ Built | `underwriting/conditions/page.tsx` |
| UW decision (approve / suspend / decline) | ✅ Built | `underwriting/decision/page.tsx` + `uw_files` table |
| Appraisal ordering (AMC) | ⚠️ Gated | Mercury AMC built; gated on Mercury credentials in DB |
| Appraisal waiver check (PIW/ACE) | ✅ Built | `waiver-check/page.tsx` + `lib/appraisal/waiverDetector.ts` |
| Flood zone determination | ✅ Built | `property/flood-zone/page.tsx` + ATTOM→FEMA fallback |

### Closing
| Feature | Status | Notes |
|---|---|---|
| Closing instructions to title | ✅ Built | `portal/title/[token]/page.tsx` — full closing portal |
| Wire transfer instructions (encrypted) | ✅ Built | `lib/title/wireVerification.ts` + wire safety UI |
| CD issuance | ✅ Built | CD workflow in disclosures section |
| Funding checklist | ✅ Built | `ClosingChecklist` component + `closing_checklist_items` |
| Construction loan draw schedule | ✅ Built | `loans/[loanId]/construction/page.tsx` |

### Post-Close
| Feature | Status | Notes |
|---|---|---|
| MERS MIN validation (local) | ✅ Built | `lib/compliance/mersMin.ts` — 18-digit format validator |
| MERS eRegistration (API) | ❌ Not built | `loans/[loanId]/ops/route.ts` stores `mers_min` field; no live MERS MIDANET API call |
| Investor delivery (Fannie/Freddie) | ❌ Not built | No ELS/Caster API integration |
| Trailing document tracking | ✅ Built | Document expiration tracking covers this |
| Refi watch / post-close nurture | ✅ Built | `refi-watch/page.tsx` + `my-book/page.tsx` + goldmine signals |
| Live market rate feed | ❌ Not built | `CURRENT_MARKET_RATE = 6.875` hardcoded in rate-watch route |

### Compliance / Reporting
| Feature | Status | Notes |
|---|---|---|
| HMDA LAR export (FFIEC) | ⚠️ Partial | `reports/hmda-lar/route.ts` real but LEI, ULI, demographics, rate spread columns blank |
| HMDA demographics in application flow | ✅ Built | `application/hmda/page.tsx` + `hmda_data` table |
| ECOA adverse action notices | ⚠️ Partial | `docs-compliance/adverse-action/page.tsx` shows deadline; no notice PDF generation found |
| Fair lending monitoring | ✅ Built | `docs-compliance/fair-lending-flags/page.tsx` — 3-table analysis |
| DNC scrub | ⚠️ Partial | Internal list enforced; national registry gated on `DNC_API_KEY`; `DNC_API_BASE` is placeholder URL |
| TCPA consent management | ✅ Built | Full TCPA center, consent audit log, quiet-hours enforcement |
| RESPA co-op ad check | ✅ Built | `lib/compliance/respaCoopAdCheck.ts` — 70/30 budget split validator |
| Audit log (append-only) | ✅ Built | `audit_events` + `tcpa_consent_log` + `sign_events` — INSERT-only |
| State-specific disclosure library | 🔲 Not found | No state disclosure library module found |
| LOE (Letter of Explanation) builder | ✅ Built | `loans/[loanId]/loe/page.tsx` + `lib/loe/aiDraft.ts` |
| Dual-role conflict check | ✅ Built | `docs-compliance/dual-role-check/page.tsx` |

---

## Part 5: POS Feature Map

| Feature | Status | Notes |
|---|---|---|
| Borrower status portal (upload, status, next steps) | ✅ Built | `(borrower)/status/[token]/page.tsx` — 8+ queries, AI next-step |
| Borrower self-serve full online application | ✅ Built | `apply/smart/[token]/page.tsx` + Smart 1003 form |
| Pre-qual widget (embeddable) | ✅ Built | `widget/[token]/page.tsx` — 6-step with TCPA |
| LO-branded application landing | ✅ Built | `apply/o/[org]/[mlo]/page.tsx` |
| Co-borrower invite + separate portal | ✅ Built | `loans/[loanId]/coborrower-token/route.ts` + co-borrower section |
| Realtor partner portal | ✅ Built | `portal/realtor/[token]/page.tsx` with permission tiers |
| Title company portal | ✅ Built | `portal/title/[token]/page.tsx` |
| Needs list / borrower task list | ✅ Built | Conditions + document requests surfaced in borrower portal |
| Pre-approval letter generation | ✅ Built | `pre-approval/generate/route.ts` uses `pdf-lib` — real PDF |
| Text-to-Apply SMS flow | ✅ Built | `lib/textApply/` + `text-to-apply-keywords` table |
| Borrower portal chat | ✅ Built | `borrower-portal/[token]/chat/route.ts` |
| Mobile-responsive portal | ✅ Built | Standard Tailwind responsive classes throughout |
| Application resume / abandon recovery | ⚠️ Partial | Resume link bug: `href="/apply"` drops borrower context |

---

## Part 6: CRM Feature Map

| Feature | Status | Notes |
|---|---|---|
| Lead capture (widget, referral, apply link) | ✅ Built | Multiple entry points |
| Lead list + pipeline views (kanban + table) | ✅ Built | `pipeline/page.tsx` — deep multi-table with velocity scores |
| Lead detail / contact record | ✅ Built | `leads/[id]/page.tsx` — 10+ table queries |
| Lead scoring / AI prioritization | ✅ Built | `behavior_score_history` + `velocity_predictions` |
| Lead deduplication + merge | ✅ Built | `leads/duplicates/route.ts` + `leads/merge/route.ts` |
| Activity timeline per lead | ✅ Built | `lead_activities` + timeline page |
| Task management | ✅ Built | `tasks/page.tsx` + `loan_tasks` table |
| Unified inbox (SMS + email + portal) | ✅ Built | `inbox/page.tsx` — real-time Supabase subscription |
| 2-way email sync (Gmail / Outlook) | ❌ Not built | `email_integrations` table exists; no OAuth sync implementation found |
| SMS + dialer | ⚠️ Gated | Twilio SMS gated on env vars; dialer routes gated on Twilio account |
| Power dialer | ⚠️ Gated | `dialer/power/page.tsx` real queue; WebRTC token gated on `TWILIO_API_KEY` |
| Campaign automation (drip sequences) | ⚠️ Gated | Campaign schema + steps real; message delivery gated with TODO comment |
| Rate drop campaigns | ✅ Built | `campaigns/rate-drop/page.tsx` + `rate_drop_scan` cron |
| Realtor relationship management | ✅ Built | `realtors/` pages + heat scores + notifications |
| Realtor discovery | ✅ Built | `realtors/discover/route.ts` |
| Database marketing / past client nurture | ✅ Built | `goldmine/` + `post-close/` + `outreach/` |
| Milestone-triggered automations | ✅ Built | `milestone_automation_rules` + `milestone_automation_log` |
| Ghost recovery / re-engagement AI | ✅ Built | `ghost/` lib + `ghost_recovery_queue` table |
| Video messages | ✅ Built | `video-messages/page.tsx` + `video_messages` table |
| Social content AI | ✅ Built | `social/` pages + content studio |
| Co-marketing / ad center | ✅ Built | `ads/` pages + `ad_creatives` + `coop_ad_campaigns` |
| Pipeline reporting + conversion tracking | ✅ Built | `reports/page.tsx` + funnel analytics |
| Commission / comp tracking | ✅ Built | `commissions/page.tsx` + `comp_plans` |
| LO scorecard / metrics | ✅ Built | `scorecard/page.tsx` + `buildLOScorecard()` |
| AI coach | ✅ Built | `ai-coach/page.tsx` + `/api/ai/coach` |
| LO license management | ✅ Built | `lo-licenses/route.ts` + `lo_licenses` table |
| Training / LMS | ✅ Built | `training/` pages + `lms_courses` + `lms_enrollments` |
| Branch manager leaderboard | ✅ Built | `leaderboard/page.tsx` + `lo_performance_snapshots` |

---

## Part 7: Integration Map

| Integration | Status | Gate / Notes |
|---|---|---|
| Optimal Blue (live PPE) | ⚠️ Coded, env-gated | Requires `ppe_connections` row with encrypted key. Returns `{ gated: true }` cleanly when absent. Full OB adapter: `lib/integrations/ppe/optimalBlue.ts`. |
| Encompass (LOS sync) | ⚠️ Coded, env-gated | Webhook handler real + HMAC-verified. Gated on `ENCOMPASS_WEBHOOK_SECRET`. Field map: `lib/integrations/los/encompassFieldMap.ts`. Push sync only (inbound webhook). |
| LendingPad (LOS sync) | ✅ Wired + functional | OAuth token exchange live. `lib/los/arivePull.ts` (used for lendingpad pull). Full bidirectional via webhook + API pull. |
| Arive (LOS sync) | ✅ Wired + functional | OAuth flow + webhook `syncAriveEntity()` implemented. Cron job for periodic sync. |
| BYTE (LOS sync) | ✅ Wired + functional | HMAC-verified webhook, status map, inbound-only (correct for BytePro). |
| Mercury AMC (appraisal) | ⚠️ Coded, env-gated | Full OAuth2 client-credentials flow + order placement. Gated on Mercury credential in `amc_connections`. Throws (not returns gated) on missing credential — callers need try/catch. |
| Plaid (asset/income verification) | ⚠️ Coded, env-gated | `plaid/link-token` route returns 501 when `PLAID_CLIENT_ID`/`PLAID_SECRET` unset. `lib/income/plaidAnalysis.ts` is pure math (no SDK). Plaid SDK not confirmed installed. |
| AWS Textract (doc extraction) | ❌ Not functional | `lib/ai/textract.ts` throws `TextractNotConfiguredError` unconditionally. `@aws-sdk/client-textract` not installed. Requires: install SDK, uncomment implementation, set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`. |
| PrimeMind Sign (e-signature) | ❌ Not functional | `lib/sign/client.ts`: `createEnvelope()` always returns `{ gated: true }` regardless of env vars. `@primemind/sign-react` not installed. Real call is commented out. Schema (sign_envelopes, sign_events) complete. |
| Twilio (SMS + voice outbound) | ⚠️ Coded, env-gated | `dialer/call/route.ts` + `canSendSMS.ts` real. Gated on `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`. Inbound SMS webhook (`webhooks/twilio-inbound`) fully implemented. |
| Twilio Power Dialer (WebRTC) | ⚠️ Coded, env-gated | `dialer/token/route.ts` real. Requires additional WebRTC vars: `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID`. |
| Resend (email) | ✅ Wired + functional | `lib/resend.ts` singleton. `RESEND_API_KEY` throws if missing (correct). CAN-SPAM physical address enforced via `lib/email/footer.ts`. |
| Stripe (billing) | ✅ Wired + functional | Checkout, webhook (HMAC-verified), portal all wired. `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` required. Price IDs fall back to `price_dev_*` in dev. |
| Stripe usage metering | ⚠️ Coded, env-gated | `lib/billing/recordUsage.ts` real. Gated on `STRIPE_SMS_METER_ID` and `STRIPE_VOICE_METER_ID`. Silent no-op if missing — usage logged locally but Stripe not metered. |
| ATTOM (property data + flood) | ⚠️ Coded, env-gated | `lib/property/floodZone.ts` — ATTOM primary, FEMA NFHL free API fallback. Gated on `ATTOM_API_KEY`. Silently falls to FEMA when absent. |
| Lob (physical mail for credit disputes) | ⚠️ Coded, silent bug | `lib/credit-repair/lob.ts` — when `LOB_API_KEY` unset, returns `{ mocked: true }` in ALL environments. No production guard. Dispute letters silently not sent. |
| Soft Pull credit API | ⚠️ Coded, env-gated | `lib/credit-repair/softpull.ts`. Mock in dev; throws in prod without `SOFT_PULL_API_KEY`. Requires: `SOFT_PULL_API_KEY`, `SOFT_PULL_API_URL`, `SOFT_PULL_SUBSCRIBER_ID`. |
| Hard pull / tri-merge credit (MeridianLink, Factual Data, etc.) | ⚠️ Coded, env-gated | Generic adapter functional. Named vendor adapters not built — fall back to generic HTTP POST. Gated on `credit_vendor_connections` row. |
| Fannie Mae DU API | ⚠️ Coded, env-gated | `fannie_du` in AUS registry but native adapter not built — falls back to `genericAus` (MISMO POST). |
| Freddie Mac LP/LPA API | ⚠️ Coded, env-gated | Same as Fannie — registry entry exists, native adapter not built. |
| MERS eRegistration API | ❌ Not built | `mersMin` field stored + validated locally. No MERS MIDANET / iRegistration API call. |
| DNC scrub API | ⚠️ Coded, env-gated | Internal suppression list enforced. National registry gated on `DNC_API_KEY` + `DNC_API_BASE`. `DNC_API_BASE` defaults to `'https://api.dnc.com'` which is not a real vendor URL. Must be set to actual vendor (e.g. Gryphon, DNC.com). |
| ElevenLabs (voice AI) | 🔧 Stub/interface only | No `ELEVENLABS_API_KEY` reference found in lib. Borrower portal "AI video explainers" reference ElevenLabs in comments/components but no server integration found. |
| DocMagic / Docutech (doc prep) | ❌ Not started | `lib/disclosures/buildLoanEstimate.ts` is a homegrown LE builder. No DocMagic/Docutech integration. |
| Gmail / Outlook 2-way sync | ❌ Not started | `email_integrations` table exists; no OAuth sync implementation found anywhere. |
| State disclosure library | ❌ Not started | No state-specific disclosure library found. |
| Deepgram (voicemail transcription) | ⚠️ Coded, env-gated | `lib/voicemail/deepgram.ts` — returns `null` when `DEEPGRAM_API_KEY` unset. Voicemail transcription silently disabled. |
| FAL / Replicate (image generation) | ⚠️ Coded, env-gated | Referenced in `lib/ai/generateImage.ts`. Gated on `FAL_KEY` / `REPLICATE_API_TOKEN`. |
| LoanPASS (PPE) | 🔧 Stub/interface | `lib/integrations/ppe/loanpass.ts` self-labeled stub. Field IDs are documented defaults, not tenant-confirmed. |
| OpenAI (brain embeddings) | ⚠️ Coded, env-gated | `lib/brain/generateEmbedding.ts`. Gated on `OPENAI_API_KEY`. Brain/memory search disabled when absent. |

---

## Part 8: Schema Gaps

### Tables With No Migration (code references, never created)

| Table | Referenced in | Gap |
|---|---|---|
| `applications` | `app/api/apply/[token]/route.ts`, `app/api/apply/[token]/section/[section]/route.ts`, `app/api/apply/[token]/submit/route.ts` | **CRITICAL BUG.** 3 public-facing apply routes query this table. No `CREATE TABLE applications` exists in any migration. Borrower application flow breaks at load, section save, and submit. Must be renamed to `loan_applications`. |
| `broker_accounts` | `ae-book/`, `ae-management/`, `/api/broker-accounts/` | Referenced in 4+ routes; no migration found anywhere |
| `doc_stacking_templates` | `loans/[loanId]/doc-stack/route.ts` | Referenced; no migration found |
| `imported_loans` | `inbound/page.tsx`, `/api/import/arive/route.ts`, Arive sync | Referenced in 5+ routes; no migration found |
| `retention_events` | `relationships/borrowers/[id]/activity/page.tsx`, `portal-comms/` | Referenced; no migration found |
| `annual_reviews` | `relationships/borrowers/[id]/annual-review/page.tsx` | Referenced; no migration found |
| `portfolio_snapshots` | `relationships/borrowers/[id]/property-intelligence/equity-tracker/page.tsx`, borrower status portal | Referenced; no migration found |
| `user_roles` | `lib/roles/getRoleForUser.ts` | Referenced in code but only created in `020_role_architecture.sql` which appears to be an older numbered migration — confirm it is applied |

### Missing Tables (code references non-existent tables) — Notes

- `loan_applications` IS properly migrated (2 CREATE TABLE statements in `APPLY_MISSING_MIGRATIONS.sql` and phase 59 migration). The `applications` references are a naming inconsistency, not a missing table.
- `application_sessions` IS properly migrated (Phase 97 abandon-recovery migration).

### RLS Gaps

None found. All 179 tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. RLS coverage is complete.

### Duplicate Table Definitions

`ai_feedback` appears twice in `APPLY_MISSING_MIGRATIONS.sql` (will fail on second `CREATE TABLE IF NOT EXISTS` in strict mode — not a problem with `IF NOT EXISTS` but worth cleanup).

---

## Part 9: Code Quality & Compliance Issues

**P0 — Will cause violations or data loss immediately at launch**

1. **BROKEN APPLY FLOW — `applications` phantom table.** Routes `apply/[token]/route.ts`, `apply/[token]/section/[section]/route.ts`, and `apply/[token]/submit/route.ts` all query a table named `applications` that has no migration. The table does not exist. Every borrower who clicks a standard apply link will encounter a silent failure (Supabase returns an empty result, not an error, for a missing table in some configs — but the submit will fail). Fix: rename all `from('applications')` calls to `from('loan_applications')`.

2. **BROKEN RESUME LINK — `apply/resume/[token]/page.tsx` line 70.** The "Continue my application" CTA is `href="/apply"`, not `href="/apply/smart/${params.token}"`. Every borrower who clicks their recovery SMS link is dropped back to the generic apply start page, losing their saved session.

3. **E-SIGNATURE NON-FUNCTIONAL.** `lib/sign/client.ts` always returns `{ gated: true }` — the real `createEnvelope()` call is permanently commented out. `@primemind/sign-react` is not installed. Any flow requiring borrower e-signature (disclosures, TRID intent-to-proceed) is silent-no-op. The 3-business-day TRID clock only starts on a successful sign send — so TRID clocks will never start via the sign workflow.

4. **DOCUMENT EXTRACTION NON-FUNCTIONAL.** `lib/ai/textract.ts` throws `TextractNotConfiguredError` unconditionally, even when AWS env vars are set. `@aws-sdk/client-textract` is not installed. The auto-extract page (`docs-compliance/auto-extract/`) and `/api/loans/[loanId]/extract-document` route will always return 501.

5. **LOB SILENT MOCK IN PRODUCTION.** `lib/credit-repair/lob.ts`: when `LOB_API_KEY` is not set, returns `{ lobId: 'mock_ltr_...', mocked: true }` in production. Credit repair enrollees would see letters marked "sent" but no physical dispute letters are ever mailed to Experian/Equifax/TransUnion. FCRA violation risk.

6. **DNC API PLACEHOLDER URL.** `lib/compliance/dncScrub.ts`: `DNC_API_BASE` defaults to `'https://api.dnc.com'` — not a real vendor endpoint. National DNC registry scrub will fail (or hit a wrong endpoint) for any number until `DNC_API_BASE` is set to an actual vendor URL. Internal suppression-only DNC is conservative but not TCPA-safe for high-volume outbound.

7. **NMLS GATE IS WARNING-ONLY.** `lib/communications/nmlsGate.ts`: `commsGateGuard()` always returns `null`. LOs without NMLS numbers on file can send regulated communications. This is the current design choice (Phase 138 comment) but is a compliance exposure under SAFE Act and state licensing rules.

8. **TCPA CONSENT TEXT NAMES PLATFORM BRAND.** `lib/compliance/tcpa.ts`: `STANDARD_TCPA_CONSENT_TEXT` includes "AshleyIQ" — in white-label portals the borrower sees the platform's brand, not the LO's. This could invalidate consent records if the brand name in consent doesn't match the sending entity.

**P1 — Security issues**

9. **THREE PARALLEL RBAC SYSTEMS.** `lib/rbac.ts`, `lib/permissions/accessMatrix.ts`, and `lib/roles/checkPermission.ts` each define overlapping but inconsistent permission sets. Role names and permission taxonomies differ. Risk: a route could pass one system's check but fail another's, or vice versa. No single source of truth for "can this user do X."

10. **AD PLATFORM OAUTH TOKENS IN PLAINTEXT COLUMN.** `supabase/migrations/20260609_phase33_wave2_attribution.sql` comment: `access_token text, -- TODO: store via Supabase Vault when OAuth is wired`. Ad platform OAuth tokens stored in a plain text column (not encrypted via AES-256-GCM like other credentials). Anyone with `service_role` DB access can read them.

11. **WIDGET TOKEN HARDCODED IN SETTINGS PAGE.** `settings/widget/page.tsx`: `useState('demo_widget_token_abc123')`. The widget settings page shows a hardcoded fake token — no real token is generated or persisted for the logged-in org. Users copying the widget embed code will get a non-functional widget.

**P2 — Data integrity issues**

12. **HARDCODED RATE IN RATE-WATCH.** `app/api/ai/rate-watch/route.ts` line 10: `const CURRENT_MARKET_RATE = 6.875; // Placeholder`. Used in 7+ calculations in this route with no env var gate. Rate-watch alerts and refi opportunity detection use a stale hardcoded rate.

13. **LOS CONDITIONS NEVER IMPORTED.** `lib/los/syncLoan.ts`: `// TODO(conditions): upsert loan conditions`. Conditions from LendingPad, Arive, or other LOS sources are never written to `loan_conditions`. LOs using a connected LOS see no imported conditions in Ashley IQ.

14. **ARIVE LOAN STATUS MAP INCOMPLETE.** `lib/los/statusMap.ts` has a `TODO` for Arive loan-status strings. Arive loan stages sync with undefined mapping for some states.

15. **MISSING ORPHANED TABLES.** `broker_accounts`, `doc_stacking_templates`, `imported_loans`, `retention_events`, `annual_reviews`, `portfolio_snapshots` — referenced in 10+ routes and pages, no CREATE TABLE migration exists. These tables need migrations in `APPLY_MISSING_MIGRATIONS.sql` or they will cause runtime failures.

**P3 — UX issues at launch**

16. **AI AGENTS PAGE IS ENTIRELY STATIC.** `ai-agents/page.tsx` renders hardcoded agent statuses, last-run times, and metric values. Users will see agents reported as "Active" / "4 LOs briefed today" with no live data.

17. **AUTOMATIONS PAGE IS ENTIRELY STATIC.** `automations/page.tsx` uses `MOCK_AUTOMATIONS` const array. Toggle interactions only affect local React state. No automation rules are actually created, toggled, or persisted.

18. **EMAIL FOOTERS USE OLD BRAND NAME.** `lib/email/footer.ts` and `lib/resend.ts` fall back to "AshleyIQ" / "noreply@ashleyiq.com" if `COMPANY_NAME` and `RESEND_FROM_EMAIL` env vars are not set. All outbound email will show the wrong brand name.

19. **CROA DISCLOSURE USES OLD BRAND.** `lib/credit-repair/croa.ts` lines 9, 15 reference "AshleyIQ" in the required CROA disclosure text. The hardcoded `$19.99/month` fee at line 17 must match actual credit repair subscription pricing.

20. **CAMPAIGN MESSAGE DELIVERY NOT WIRED.** `app/api/cron/process-campaign-steps/route.ts` lines 95, 101: `// TODO(delivery): send via Twilio` and `// TODO(delivery): send via Resend`. Campaign step sends are logged to `campaign_step_sends` but no actual SMS or email is ever dispatched.

---

## Part 10: Build Priority

### P1 — Fix before any customer (compliance / security)

1. **Rename `from('applications')` → `from('loan_applications')` in 3 routes:**
   - `app/api/apply/[token]/route.ts`
   - `app/api/apply/[token]/section/[section]/route.ts`
   - `app/api/apply/[token]/submit/route.ts`

2. **Fix resume link bug in `app/apply/resume/[token]/page.tsx` line 70:**
   - Change `href="/apply"` → `href="/apply/smart/${params.token}"`

3. **Add missing table migrations** (6 tables referenced in code, no CREATE TABLE):
   - `broker_accounts`
   - `doc_stacking_templates`
   - `imported_loans`
   - `retention_events`
   - `annual_reviews`
   - `portfolio_snapshots`

4. **Add production guard to `lib/credit-repair/lob.ts`:**
   - When `LOB_API_KEY` unset and `NODE_ENV === 'production'`, throw rather than return mock.

5. **Fix `DNC_API_BASE` default** in `lib/compliance/dncScrub.ts`:
   - Remove `'https://api.dnc.com'` placeholder. Force callers to set real vendor URL.

6. **Set COMPANY_NAME, RESEND_FROM_EMAIL env vars** before any email sends to avoid "AshleyIQ" appearing in regulated communications.

7. **Fix `STANDARD_TCPA_CONSENT_TEXT`** in `lib/compliance/tcpa.ts` to use org/LO name dynamically (pass as parameter) rather than hardcoding "AshleyIQ".

8. **Fix `lib/credit-repair/croa.ts`** brand references (lines 9, 15) and confirm $19.99 fee matches billing.

9. **Encrypt ad platform OAuth tokens** — move `access_token` column in `ad_platform_connections` to AES-256-GCM encrypted field (same pattern as `lib/compliance/encryption.ts` used elsewhere).

### P2 — Core LOS gaps (fix before LOS positioning)

10. **Implement PrimeMind Sign `createEnvelope()`** in `lib/sign/client.ts`:
    - Uncomment real implementation, install `@primemind/sign-react`, provision `PRIMEMIND_SIGN_API_KEY` + `PRIMEMIND_SIGN_WEBHOOK_SECRET`.

11. **Implement AWS Textract** in `lib/ai/textract.ts`:
    - Install `@aws-sdk/client-textract`, uncomment implementation, set AWS env vars.

12. **Wire campaign message delivery** in `app/api/cron/process-campaign-steps/route.ts`:
    - Uncomment and implement Twilio SMS dispatch (lines 95+) and Resend email dispatch (lines 101+).

13. **Implement LOS condition import** in `lib/los/syncLoan.ts`:
    - Complete `TODO(conditions)` — upsert LOS conditions into `loan_conditions` table.

14. **Replace hardcoded market rate** in `app/api/ai/rate-watch/route.ts`:
    - Add `CURRENT_MARKET_RATE` env var gate with clear error; pull from live FRED API or Freddie PMMS via the existing goldmine cron.

15. **Set `LOB_API_KEY`** to send real physical credit dispute letters.

16. **Consolidate RBAC** — unify `lib/rbac.ts`, `lib/permissions/accessMatrix.ts`, and `lib/roles/checkPermission.ts` into a single permission system. Current three-system divergence is a security maintenance hazard.

### P3 — POS completeness

17. **Make automations page live** — connect `automations/page.tsx` to `/api/automations/rules` (which IS a real endpoint with real DB queries). Remove `MOCK_AUTOMATIONS`.

18. **Make AI agents page live** — connect to cron job status or `automation_executions` table for real run history and metrics.

19. **Fix widget settings page** — replace `useState('demo_widget_token_abc123')` with real DB-persisted token from `widget_tokens` table.

20. **Build ECOA adverse action notice PDF** — `adverse-action/page.tsx` shows deadline but no notice is generated. Required for declined applications under Reg B.

21. **Build state disclosure library** — no state-specific disclosure content module found.

22. **Build CHARM booklet / ARM disclosure generation** — referenced in compliance suite but not implemented.

### P4 — Integration activation (vendor accounts required)

23. **Activate Twilio** — set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `DEFAULT_TWILIO_NUMBER`.
24. **Activate Twilio WebRTC (power dialer)** — additional vars: `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_TWIML_APP_SID`.
25. **Activate Optimal Blue PPE** — create `ppe_connections` row with OB credentials.
26. **Activate Mercury AMC** — create `amc_connections` row with Mercury credentials.
27. **Activate Plaid** — set `PLAID_CLIENT_ID`, `PLAID_SECRET`, install Plaid SDK.
28. **Activate Soft Pull credit API** — set `SOFT_PULL_API_KEY`, `SOFT_PULL_API_URL`, `SOFT_PULL_SUBSCRIBER_ID`.
29. **Activate DNC API** — set real `DNC_API_BASE` (Gryphon or other vendor) + `DNC_API_KEY`.
30. **Activate Deepgram** — set `DEEPGRAM_API_KEY` for voicemail transcription.
31. **Activate ATTOM** — set `ATTOM_API_KEY` for primary flood zone + property data.
32. **Activate Encompass** — set `ENCOMPASS_WEBHOOK_SECRET` and register webhook with ICE.
33. **Wire credit alert delivery** — set `CREDIT_ALERTS_LIVE=true` after Twilio + Resend are confirmed.
34. **Wire realtor notifications** — set `REALTOR_NOTIFY_LIVE=true` after Twilio confirmed.
35. **Activate OpenAI** — set `OPENAI_API_KEY` for brain/memory vector embeddings.

### P5 — Deferred (large greenfield or blocked on vendor approval)

36. **Fannie Mae DU native adapter** — build real DU submission adapter replacing `genericAus` for Fannie.
37. **Freddie Mac LPA native adapter** — build real LPA submission adapter.
38. **Named credit vendor adapters** — native adapters for Factual Data, MeridianLink, Xactus, Credco (currently all use `genericCredit`).
39. **VOIE native adapters** — Truework, The Work Number (Equifax), Plaid Income (all use `genericVoie`).
40. **MERS eRegistration API** — live MIDANET/iRegistration API call; currently only local MIN format validation.
41. **Fannie/Freddie investor delivery** — ELS/Caster API for post-close investor loan delivery.
42. **Gmail/Outlook 2-way email sync** — `email_integrations` table exists; no implementation. Requires OAuth app registration with Google/Microsoft.
43. **LoanPASS per-tenant field map verification** — `lib/integrations/ppe/loanpass.ts` field IDs need confirmation per tenant before any LoanPASS connection goes live.
44. **HMDA POS demographic module** — applicant demographics, rate spread, LEI, and ULI are blank in LAR export. Requires front-end data collection at application time.
45. **Homeowners insurance verification** — no HOI verification page or API found. Required for processing checklist.
46. **ElevenLabs voice AI integration** — referenced in comments but no server integration found in lib.
