# Ashley IQ — Gap Fixes + Feature Build Prompt
**Working directory:** `/Users/ashley/primemindlabs/conduit-next/`
**Branch:** `ashleyiq-mvp`
**Context doc:** Read `GAP_REPORT.md` in this directory before starting. It is the authoritative audit.

Execute every stage in order. Run `pnpm tsc --noEmit` after each stage and fix all errors before moving on. Do not skip stages. Commit after each stage with the prefix shown.

---

## STAGE A — Critical Bug Fixes (breaks live user flows today)

### A-1 — Phantom table: rename `applications` → `loan_applications` in 3 API routes

These 3 routes query `from('applications')`, a table that does not exist. The correct table is `loan_applications`.

```bash
grep -rn "from('applications')" app/api/apply/ --include="*.ts"
```

Read each file returned, then replace every `from('applications')` with `from('loan_applications')` in:
- `app/api/apply/[token]/route.ts`
- `app/api/apply/[token]/section/[section]/route.ts`
- `app/api/apply/[token]/submit/route.ts`

Do not change any other table references. Do not change `loan_applications` references (they are correct).

### A-2 — Resume link drops borrower session

**File:** `app/apply/resume/[token]/page.tsx`

Read the file. Find line ~70 where `href="/apply"` appears inside the "Continue my application" CTA. Replace:
```tsx
href="/apply"
```
with:
```tsx
href={`/apply/smart/${params.token}`}
```

Verify: the page receives `params.token` from the route. If it arrives as a prop or via `useParams`, use the appropriate variable name. The goal is that the resume link routes the borrower directly back to their saved Smart 1003 session.

### A-3 — E-signature stub: make `lib/sign/client.ts` throw clearly instead of silently returning gated

**File:** `lib/sign/client.ts`

Read the file. The `createEnvelope()` function currently returns `{ gated: true }` unconditionally (real implementation is commented out). This causes TRID clocks to silently never start.

Replace the function body with a loud throw that makes the gap obvious in logs:

```ts
export async function createEnvelope(/* params */): Promise<never> {
  throw new Error(
    '[sign] PrimeMind Sign is not provisioned. ' +
    'Set PRIMEMIND_SIGN_API_KEY + PRIMEMIND_SIGN_WEBHOOK_SECRET and install @primemind/sign-react.'
  );
}
```

Do NOT attempt to install `@primemind/sign-react` or implement the real call — that requires PrimeMind Sign provisioning. The goal is to surface errors in logs instead of silently eating them.

Update any caller that catches `{ gated: true }` to catch the thrown error instead and return a 503 with a clear message to the client.

### A-4 — Production guard: LOB physical mail mock

**File:** `lib/credit-repair/lob.ts`

Read the file. Find the branch where `LOB_API_KEY` is unset and the function returns `{ lobId: 'mock_ltr_...', mocked: true }`. Add a production guard as the first line of that branch:

```ts
if (process.env.NODE_ENV === 'production') {
  throw new Error(
    '[lob] LOB_API_KEY is required in production. Physical dispute letters will not be sent without it.'
  );
}
```

Also find the caller in `app/api/borrower-portal/[token]/credit-repair/send-disputes/route.ts`. After `sendLobLetter()` resolves, add:
```ts
if (result.mocked) {
  return NextResponse.json(
    { error: 'Physical mail not configured — LOB_API_KEY is required.' },
    { status: 503 }
  );
}
```
Do not mark the dispute as sent when `mocked` is true.

**Commit:** `fix(stage-a): phantom table, resume link, sign stub, lob guard`

---

## STAGE B — Compliance Hardening

### B-1 — TCPA consent text: make org name dynamic

**File:** `lib/compliance/tcpa.ts`

Read the file. Find `STANDARD_TCPA_CONSENT_TEXT` where the string "AshleyIQ" is hardcoded. Convert it to a function:

```ts
export function buildTcpaConsentText(orgName: string, orgPhone?: string): string {
  return `By providing your phone number and clicking submit, you expressly consent to receive calls and text messages from ${orgName}${orgPhone ? ` at ${orgPhone}` : ''} ...`
  // preserve the full existing legal text, replacing only the hardcoded brand name
}

// Keep the old export as a backward-compat shim that passes a default — search for all callers
export const STANDARD_TCPA_CONSENT_TEXT = buildTcpaConsentText('our team');
```

Search for all callers of `STANDARD_TCPA_CONSENT_TEXT`:
```bash
grep -rn "STANDARD_TCPA_CONSENT_TEXT" app/ lib/ components/ --include="*.ts" --include="*.tsx"
```

For each caller, determine if an org name is available in context. If yes, replace with `buildTcpaConsentText(org.name)`. If not, leave the shim in place for now — the shim is better than "AshleyIQ".

### B-2 — CROA disclosure: fix brand references

**File:** `lib/credit-repair/croa.ts`

Read lines 9, 15, 17. Replace "AshleyIQ" with `process.env.PLATFORM_NAME ?? 'our platform'`. The `$19.99/month` fee at line 17 must be replaced with `process.env.CREDIT_REPAIR_MONTHLY_FEE ?? '$19.99'` — add a comment that this must be set to actual billing amount.

### B-3 — Email footer + from address: fix brand fallbacks

**File 1:** `lib/email/footer.ts`
- Replace `'AshleyIQ'` fallback with `process.env.PLATFORM_NAME ?? 'our team'`

**File 2:** `lib/resend.ts`
- Replace `'noreply@ashleyiq.com'` fallback with `process.env.RESEND_FROM_EMAIL`
- If `RESEND_FROM_EMAIL` is not set, throw: `throw new Error('RESEND_FROM_EMAIL is required')`

### B-4 — DNC API: remove placeholder URL

**File:** `lib/compliance/dncScrub.ts`

Read the file. Find:
```ts
`${process.env.DNC_API_BASE ?? 'https://api.dnc.com'}/scrub`
```

Replace with:
```ts
if (!process.env.DNC_API_BASE) {
  // No vendor URL configured — national registry scrub skipped entirely
  // Internal suppression list still enforces. registryGated will be true.
} else {
  const res = await fetch(`${process.env.DNC_API_BASE}/scrub`, ...)
}
```

Remove the `'https://api.dnc.com'` placeholder entirely. When `DNC_API_BASE` is unset, the registry check is simply skipped (registryGated stays true), which is the current safe behavior. But we must not call a fake URL.

### B-5 — Wire campaign message delivery

**File:** `app/api/cron/process-campaign-steps/route.ts`

Read the full file. Find the two TODO blocks (around lines 95 and 101) for SMS and email delivery.

For SMS (replace the TODO block):
```ts
await assertSMSConsent(orgId, lead.phone);
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);
await twilioClient.messages.create({
  to: lead.phone,
  from: process.env.TWILIO_PHONE_NUMBER!,
  body: renderedBody,
});
delivery = 'sent';
```

For email (replace the TODO block):
```ts
await assertEmailConsent(orgId, lead.email);
await resend.emails.send({
  from: process.env.RESEND_FROM_EMAIL!,
  to: lead.email,
  subject: renderedSubject,
  html: renderedHtml + emailFooter({ orgId, leadId: lead.id, email: lead.email }),
});
delivery = 'sent';
```

Wrap each send in try/catch. On error: set `delivery = 'failed'` and save error message to the step record's `error_message` column (check exact column name in migration). Remove the `CAMPAIGNS_LIVE_SEND` feature flag gate entirely — `assertSMSConsent` and `assertEmailConsent` are the safety gate.

**Commit:** `fix(stage-b): compliance hardening — tcpa, croa, email brand, dnc, campaign delivery`

---

## STAGE C — Live Automations Page

### C-1 — Replace MOCK_AUTOMATIONS with real DB queries

**File:** `app/(dashboard)/automations/page.tsx`

Read the full file. It uses `const MOCK_AUTOMATIONS: Automation[] = [...]` and `useState(MOCK_AUTOMATIONS)`. Also read the real automations API:

```bash
find app/api -path "*automation*" -name "*.ts" | xargs ls -la
```

Read every automation route returned. The actual tables are `milestone_automation_rules` and `milestone_automation_log`.

Convert the page from a client component with hardcoded state to a proper server-side page:

```tsx
// page.tsx — server component
import { createServerClient } from '@/lib/supabase/server';

export default async function AutomationsPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  // get org_id from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user!.id)
    .single();

  const { data: rules } = await supabase
    .from('milestone_automation_rules')
    .select(`
      id, name, trigger_milestone, action_type, action_config,
      is_active, created_at,
      milestone_automation_log(count)
    `)
    .eq('org_id', profile!.org_id)
    .order('created_at', { ascending: false });

  return <AutomationsClient rules={rules ?? []} orgId={profile!.org_id} />;
}
```

Create `components/automations/AutomationsClient.tsx` as the interactive layer with:
- Toggle active/inactive → `PATCH /api/automations/rules/[id]`
- Delete rule → `DELETE /api/automations/rules/[id]`
- Create rule modal → `POST /api/automations/rules`
- Run count from `milestone_automation_log` shown per rule

Check if those API routes exist:
```bash
find app/api -path "*automations*" -o -path "*automation-rules*" | head -20
```

If they don't exist, create them. If they do, use the existing routes.

Also check if `milestone_automation_rules` is in the migrations:
```bash
grep -n "milestone_automation_rules" supabase/migrations/*.sql supabase/APPLY_MISSING_MIGRATIONS.sql
```

If it's missing from migrations, add `CREATE TABLE IF NOT EXISTS milestone_automation_rules` to `APPLY_MISSING_MIGRATIONS.sql`.

**Commit:** `feat(automations): replace mock data with real milestone_automation_rules DB`

---

## STAGE D — Live AI Agents Page

### D-1 — Replace hardcoded AGENTS array with real cron/agent status

**File:** `app/(dashboard)/ai-agents/page.tsx`

Read the full file. It has `const AGENTS = [...]` — 100% hardcoded status, lastRun, and metrics.

Determine what tables track agent/cron execution:
```bash
grep -rn "automation_executions\|cron_runs\|agent_runs\|job_log\|cron_log" supabase/migrations/ --include="*.sql" | head -20
grep -rn "milestone_automation_log\|campaign_step_sends\|ghost_recovery_queue" supabase/migrations/ --include="*.sql" | head -10
```

Map each hardcoded agent to its real data source:
- **Campaign Drip Agent** → `campaign_step_sends` (count by date, last entry timestamp)
- **Ghost Recovery Agent** → `ghost_recovery_queue` (queue size, last processed)
- **Rate Watch Agent** → `rate_drop_scan` cron or `rate_watch_events` table
- **Refi Watch Agent** → `refi_watch_log` or equivalent
- **Credit Alert Agent** → `credit_alert_log` or `credit_monitoring_alerts` table
- **AI Coach Agent** → query `/api/ai/coach` call log or `ai_coach_sessions`

For each agent, do:
```bash
grep -rn "TABLE_NAME_GUESS" supabase/migrations/ supabase/APPLY_MISSING_MIGRATIONS.sql --include="*.sql"
```

Build a server component that queries whichever tables actually exist. For tables that don't exist yet, create them in `APPLY_MISSING_MIGRATIONS.sql` with minimal structure:

```sql
CREATE TABLE IF NOT EXISTS agent_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  status text NOT NULL DEFAULT 'completed', -- completed | failed | running
  records_processed integer DEFAULT 0,
  run_at timestamptz NOT NULL DEFAULT now(),
  error_message text
);
ALTER TABLE agent_run_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON agent_run_log
  USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));
```

Wire each cron job / agent function to insert a row into `agent_run_log` after execution.

Build `components/ai-agents/AgentsClient.tsx` that displays:
- Agent name + description
- Last run timestamp (from `agent_run_log`)
- Records processed in last run
- Status badge (live from DB, not hardcoded)
- Run history sparkline (last 7 days of `agent_run_log` entries)
- Manual trigger button → POST to the relevant cron endpoint with admin auth

Remove the hardcoded `AGENTS` constant entirely.

**Commit:** `feat(ai-agents): replace hardcoded agents with real agent_run_log data`

---

## STAGE E — HOI (Homeowners Insurance) Verification

### E-1 — Create HOI verification page

Create `app/(dashboard)/loans/[loanId]/insurance/page.tsx`:

```tsx
import { createServerClient } from '@/lib/supabase/server';
import HOIClient from './HOIClient';

export default async function HOIPage({ params }: { params: { loanId: string } }) {
  const supabase = createServerClient();
  const { data: hoi } = await supabase
    .from('hoi_verifications')
    .select('*')
    .eq('loan_id', params.loanId)
    .order('created_at', { ascending: false });

  const { data: lead } = await supabase
    .from('leads')
    .select('property_address, property_city, property_state, property_zip')
    .eq('id', params.loanId)  // or join however loanId maps to leads
    .single();

  return <HOIClient verifications={hoi ?? []} lead={lead} loanId={params.loanId} />;
}
```

Create `app/(dashboard)/loans/[loanId]/insurance/HOIClient.tsx` with UI for:
- Policy carrier name
- Policy number
- Coverage amount (dwelling, liability, deductible)
- Policy effective date / expiration date
- Agent name + contact
- Verification status: `pending | verified | expired | insufficient_coverage`
- Notes field
- Document upload (attach policy declaration page)
- Coverage adequacy check: coverage must be ≥ loan amount (flag if insufficient)

### E-2 — Create HOI API routes

Create `app/api/loans/[loanId]/hoi/route.ts`:

```ts
// GET — fetch HOI records for loan
// POST — create/update HOI verification record
```

```ts
// GET
export async function GET(req: Request, { params }: { params: { loanId: string } }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('hoi_verifications')
    .select('*')
    .eq('loan_id', params.loanId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST
export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const supabase = createAdminClient();
  const body = await req.json();
  const { data, error } = await supabase
    .from('hoi_verifications')
    .upsert({
      loan_id: params.loanId,
      ...body,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

### E-3 — Add HOI migration

Add to `supabase/APPLY_MISSING_MIGRATIONS.sql`:

```sql
CREATE TABLE IF NOT EXISTS hoi_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL, -- references leads or loan_applications
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  carrier_name text,
  policy_number text,
  agent_name text,
  agent_phone text,
  agent_email text,
  dwelling_coverage_amount numeric(15,2),
  liability_coverage_amount numeric(15,2),
  deductible_amount numeric(15,2),
  effective_date date,
  expiration_date date,
  status text NOT NULL DEFAULT 'pending',
    CONSTRAINT hoi_status_check CHECK (status IN ('pending','verified','expired','insufficient_coverage','waived')),
  coverage_adequate boolean,
  notes text,
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE hoi_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON hoi_verifications
  USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));
```

Add HOI to the loan processing checklist. Search for where `closing_checklist_items` or the processing checklist is populated:
```bash
grep -rn "closing_checklist\|smart-checklist\|generateChecklist" lib/ app/api/ --include="*.ts" | head -10
```

Add HOI verification as a required condition in the checklist generator.

**Commit:** `feat(hoi): homeowners insurance verification page, API, and migration`

---

## STAGE F — ECOA Adverse Action Notice PDF Generation

### F-1 — Create adverse action notice PDF builder

**Read first:**
- `app/(dashboard)/docs-compliance/adverse-action/page.tsx` (current state — shows deadline, no PDF)
- `lib/disclosures/buildLoanEstimate.ts` (pattern for pdf-lib usage)
- `app/api/loans/[leadId]/pre-approval/generate/route.ts` (pdf-lib pattern)

Create `lib/ecoa/buildAdverseActionNotice.ts`:

```ts
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface AdverseActionNoticeData {
  applicantName: string;
  applicantAddress: string;
  applicationDate: string;
  actionDate: string;
  lenderName: string;
  lenderAddress: string;
  lenderPhone: string;
  actionTaken: 'denied' | 'counteroffer' | 'incomplete';
  reasons: string[]; // max 4, must come from ECOA reason list
  creditBureauName?: string;
  creditBureauAddress?: string;
  creditBureauPhone?: string;
  scoreUsed?: number;
  scoreRange?: string;
  scoreFactors?: string[];
  loanOfficerName: string;
  loanOfficerNmls: string;
}

// ECOA Regulation B approved reason codes
export const ECOA_DENIAL_REASONS = [
  'Credit application incomplete',
  'Insufficient number of credit references provided',
  'Unable to verify credit references',
  'Temporary or irregular employment',
  'Unable to verify employment',
  'Length of employment',
  'Insufficient income',
  'Excessive obligations in relation to income',
  'Unable to verify income',
  'Length of residence',
  'Temporary residence',
  'Unable to verify residence',
  'No credit file',
  'Limited credit experience',
  'Poor credit performance with us',
  'Delinquent past or present credit obligations with others',
  'Collection action or judgment',
  'Garnishment or attachment',
  'Foreclosure or repossession',
  'Bankruptcy',
  'Number of recent inquiries on credit bureau report',
  'Value or type of collateral not sufficient',
  'Unacceptable property',
  'Unable to appraise property',
  'Lack of cash reserves',
  'Excessive number of accounts',
  'Other — specify',
];

export async function buildAdverseActionNotice(data: AdverseActionNoticeData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // Letter
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Header
  page.drawText('NOTICE OF ACTION TAKEN', {
    x: 50, y: 740, size: 16, font: boldFont, color: rgb(0, 0, 0),
  });
  page.drawText('(Required by the Equal Credit Opportunity Act)', {
    x: 50, y: 720, size: 10, font, color: rgb(0.3, 0.3, 0.3),
  });

  // Applicant block
  page.drawText(`Applicant: ${data.applicantName}`, { x: 50, y: 690, size: 11, font });
  page.drawText(data.applicantAddress, { x: 50, y: 674, size: 11, font });

  // Date
  page.drawText(`Date: ${data.actionDate}`, { x: 400, y: 690, size: 11, font });

  // Creditor
  page.drawText('Creditor:', { x: 50, y: 645, size: 11, font: boldFont });
  page.drawText(data.lenderName, { x: 50, y: 629, size: 11, font });
  page.drawText(data.lenderAddress, { x: 50, y: 613, size: 11, font });
  page.drawText(data.lenderPhone, { x: 50, y: 597, size: 11, font });

  // Action taken
  page.drawText('Action Taken:', { x: 50, y: 565, size: 11, font: boldFont });
  const actionText = {
    denied: 'Your application for credit has been DENIED.',
    counteroffer: 'We are unable to offer you credit on the terms you requested.',
    incomplete: 'Your application was incomplete. See reasons below.',
  }[data.actionTaken];
  page.drawText(actionText, { x: 50, y: 549, size: 11, font, color: rgb(0.8, 0, 0) });

  // Reasons
  page.drawText('Reasons for Action Taken:', { x: 50, y: 517, size: 11, font: boldFont });
  data.reasons.slice(0, 4).forEach((reason, i) => {
    page.drawText(`${i + 1}. ${reason}`, { x: 65, y: 501 - i * 16, size: 11, font });
  });

  // Credit score disclosure (if applicable)
  if (data.scoreUsed) {
    const scoreY = 501 - Math.min(data.reasons.length, 4) * 16 - 30;
    page.drawText('Credit Score Information:', { x: 50, y: scoreY, size: 11, font: boldFont });
    page.drawText(`Score used in this decision: ${data.scoreUsed} (range: ${data.scoreRange ?? 'N/A'})`, {
      x: 50, y: scoreY - 16, size: 11, font,
    });
    if (data.creditBureauName) {
      page.drawText(`Source: ${data.creditBureauName} · ${data.creditBureauPhone ?? ''}`, {
        x: 50, y: scoreY - 32, size: 11, font,
      });
    }
  }

  // ECOA boilerplate
  const boilerplateY = 200;
  page.drawText(
    'The federal Equal Credit Opportunity Act prohibits creditors from discriminating against credit applicants',
    { x: 50, y: boilerplateY, size: 9, font, color: rgb(0.3, 0.3, 0.3) }
  );
  page.drawText(
    'on the basis of race, color, religion, national origin, sex, marital status, age (provided the applicant',
    { x: 50, y: boilerplateY - 13, size: 9, font, color: rgb(0.3, 0.3, 0.3) }
  );
  page.drawText(
    'has the capacity to enter into a binding contract), because all or part of the applicant\'s income derives',
    { x: 50, y: boilerplateY - 26, size: 9, font, color: rgb(0.3, 0.3, 0.3) }
  );
  page.drawText(
    'from any public assistance program, or because the applicant has in good faith exercised any right',
    { x: 50, y: boilerplateY - 39, size: 9, font, color: rgb(0.3, 0.3, 0.3) }
  );
  page.drawText(
    'under the Consumer Credit Protection Act.',
    { x: 50, y: boilerplateY - 52, size: 9, font, color: rgb(0.3, 0.3, 0.3) }
  );

  // Signature / LO
  page.drawText(`Loan Officer: ${data.loanOfficerName} · NMLS# ${data.loanOfficerNmls}`, {
    x: 50, y: 120, size: 11, font,
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
```

### F-2 — Create adverse action notice API route

Create `app/api/loans/[leadId]/adverse-action/generate/route.ts`:

```ts
import { buildAdverseActionNotice } from '@/lib/ecoa/buildAdverseActionNotice';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const sb = createAdminClient();
  const body = await req.json(); // { reasons: string[], actionTaken: string }

  // Fetch lead + org + LO info
  const { data: lead } = await sb
    .from('leads')
    .select(`
      first_name, last_name, email,
      mailing_address, mailing_city, mailing_state, mailing_zip,
      profiles!leads_assigned_lo_fkey(full_name, nmls_number, org_id,
        organizations(name, address, phone))
    `)
    .eq('id', params.leadId)
    .single();

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const lo = lead.profiles as any;
  const org = lo?.organizations as any;

  const pdfBuffer = await buildAdverseActionNotice({
    applicantName: `${lead.first_name} ${lead.last_name}`,
    applicantAddress: `${lead.mailing_address}, ${lead.mailing_city}, ${lead.mailing_state} ${lead.mailing_zip}`,
    applicationDate: new Date().toLocaleDateString(),
    actionDate: new Date().toLocaleDateString(),
    lenderName: org?.name ?? 'Lender',
    lenderAddress: org?.address ?? '',
    lenderPhone: org?.phone ?? '',
    actionTaken: body.actionTaken,
    reasons: body.reasons,
    loanOfficerName: lo?.full_name ?? '',
    loanOfficerNmls: lo?.nmls_number ?? '',
  });

  // Store record
  await sb.from('adverse_action_notices').insert({
    lead_id: params.leadId,
    org_id: lo?.org_id,
    action_taken: body.actionTaken,
    reasons: body.reasons,
    generated_at: new Date().toISOString(),
  });

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="adverse-action-${params.leadId}.pdf"`,
    },
  });
}
```

### F-3 — Update adverse action page to use generator

**File:** `app/(dashboard)/docs-compliance/adverse-action/page.tsx`

Read the current file. It shows a deadline but has no generate button. Add:
- A form to select denial reasons (use `ECOA_DENIAL_REASONS` list from the lib)
- A "Generate Notice PDF" button that POSTs to the new route
- After generation: show download link + log in `adverse_action_notices` table

Add to `APPLY_MISSING_MIGRATIONS.sql`:
```sql
CREATE TABLE IF NOT EXISTS adverse_action_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  action_taken text NOT NULL,
  reasons text[] NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  sent_via text -- 'email' | 'mail' | 'in_person'
);
ALTER TABLE adverse_action_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON adverse_action_notices
  USING (org_id = (SELECT org_id FROM profiles WHERE id = auth.uid()));
```

**Commit:** `feat(ecoa): adverse action notice PDF generation with Reg B reason codes`

---

## STAGE G — Fannie Mae DU Native Adapter

### G-1 — Build the DU submission adapter

**Read first:**
- `lib/aus/registry.ts` (adapter registry — see how genericAus is registered)
- `lib/aus/genericAus.ts` (existing generic MISMO POST pattern)
- `lib/mismo/buildUrla.ts` (MISMO 3.4 XML builder already exists)
- Any existing `lib/aus/fannie*` files:

```bash
find lib/aus/ -type f | sort
```

Fannie Mae Desktop Underwriter API endpoint: `https://apigateway.fanniemae.com/underwriting/v2/loan-cases`
Auth: Bearer token via OAuth2 client credentials at `https://apigateway.fanniemae.com/auth/oauth/v2/token`

Create `lib/aus/fannieDu.ts`:

```ts
/**
 * Fannie Mae Desktop Underwriter (DU) native adapter.
 * Docs: https://developer.fanniemae.com/api-details#api=du-v2
 * Credentials: DU_CLIENT_ID + DU_CLIENT_SECRET in vendor_connections table (vendor: 'fannie_du')
 * Falls back to genericAus if credentials not present.
 */
import 'server-only';
import { buildUrla } from '@/lib/mismo/buildUrla';
import { createAdminClient } from '@/lib/supabase/admin';

interface DuCredentials {
  clientId: string;
  clientSecret: string;
  sellerId: string; // Fannie Seller/Servicer number
}

async function getDuCredentials(orgId: string): Promise<DuCredentials | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from('vendor_connections')
    .select('credentials_encrypted')
    .eq('org_id', orgId)
    .eq('vendor', 'fannie_du')
    .eq('is_active', true)
    .single();
  if (!data) return null;
  // Decrypt using the same pattern as other credentials in the codebase
  // Find decrypt() helper: grep -rn "decryptCredentials\|decrypt(" lib/ --include="*.ts"
  return JSON.parse(/* decrypt(data.credentials_encrypted) */ data.credentials_encrypted);
}

async function getAccessToken(creds: DuCredentials): Promise<string> {
  const res = await fetch('https://apigateway.fanniemae.com/auth/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      scope: 'du-online',
    }),
  });
  if (!res.ok) throw new Error(`DU OAuth failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.access_token;
}

export async function submitToDu(leadId: string, orgId: string): Promise<{
  caseFileId: string;
  recommendation: string; // 'Approve/Eligible' | 'Approve/Ineligible' | 'Refer' | 'Refer with Caution' | 'Out of Scope'
  findings: Record<string, unknown>;
  rawResponse: unknown;
}> {
  const creds = await getDuCredentials(orgId);
  if (!creds) throw new Error('Fannie DU credentials not configured. Add vendor_connections row with vendor=fannie_du.');

  // Build MISMO 3.4 XML
  const misoXml = await buildUrla(leadId);

  // Get access token
  const token = await getAccessToken(creds);

  // Submit to DU
  const createRes = await fetch('https://apigateway.fanniemae.com/underwriting/v2/loan-cases', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/xml',
      'Seller-Servicer-Number': creds.sellerId,
      'x-fnm-source-system': 'ASHLEY_IQ',
    },
    body: misoXml,
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`DU submission failed: ${createRes.status} ${errText}`);
  }

  const result = await createRes.json();
  const caseFileId: string = result.caseFileId ?? result.id;

  // Poll for findings (DU is async — poll until status != 'Processing')
  let findings: Record<string, unknown> = {};
  let attempts = 0;
  while (attempts < 12) {
    await new Promise((r) => setTimeout(r, 5000)); // 5s between polls
    const pollRes = await fetch(
      `https://apigateway.fanniemae.com/underwriting/v2/loan-cases/${caseFileId}`,
      { headers: { Authorization: `Bearer ${token}`, 'Seller-Servicer-Number': creds.sellerId } }
    );
    if (pollRes.ok) {
      const pollData = await pollRes.json();
      if (pollData.status !== 'Processing') {
        findings = pollData;
        break;
      }
    }
    attempts++;
  }

  const recommendation: string = (findings as any)?.recommendation ?? 'Unknown';

  return { caseFileId, recommendation, findings, rawResponse: findings };
}
```

### G-2 — Register the DU adapter

**File:** `lib/aus/registry.ts`

Read the file. Find where `fannie_du` is registered (it currently falls back to `genericAus`). Replace or update the registry entry:

```ts
import { submitToDu } from './fannieDu';

// In the registry map:
'fannie_du': async (leadId, orgId) => {
  const result = await submitToDu(leadId, orgId);
  return {
    vendor: 'fannie_du',
    caseId: result.caseFileId,
    recommendation: result.recommendation,
    findings: result.findings,
  };
},
```

**Commit:** `feat(aus): Fannie Mae DU native adapter with MISMO 3.4 submission and polling`

---

## STAGE H — Freddie Mac LPA Native Adapter

### H-1 — Build the LPA submission adapter

**Read first:**
- `lib/aus/fannieDu.ts` (just created — follow the same pattern)
- Freddie Mac LPA API: `https://api.sf.freddiemac.com/loansafe/v1/aus`
- Auth: `https://api.sf.freddiemac.com/oauth2/v1/token`

Create `lib/aus/freddieLpa.ts`:

```ts
/**
 * Freddie Mac Loan Product Advisor (LPA) native adapter.
 * Docs: https://developer.freddiemac.com/api/products/loansafe-v1
 * Credentials: LPA_CLIENT_ID + LPA_CLIENT_SECRET + LPA_SELLER_NUMBER in vendor_connections (vendor: 'freddie_lpa')
 */
import 'server-only';
import { buildUrla } from '@/lib/mismo/buildUrla';
import { createAdminClient } from '@/lib/supabase/admin';

interface LpaCredentials {
  clientId: string;
  clientSecret: string;
  sellerNumber: string;
}

async function getLpaCredentials(orgId: string): Promise<LpaCredentials | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from('vendor_connections')
    .select('credentials_encrypted')
    .eq('org_id', orgId)
    .eq('vendor', 'freddie_lpa')
    .eq('is_active', true)
    .single();
  if (!data) return null;
  return JSON.parse(data.credentials_encrypted); // decrypt per codebase pattern
}

async function getLpaToken(creds: LpaCredentials): Promise<string> {
  const res = await fetch('https://api.sf.freddiemac.com/oauth2/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      scope: 'lpa.submit',
    }),
  });
  if (!res.ok) throw new Error(`LPA OAuth failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.access_token;
}

export async function submitToLpa(leadId: string, orgId: string): Promise<{
  keyNumber: string;
  recommendation: string; // 'Accept' | 'Caution' | 'Ineligible' | 'Ineligible - Not Evaluated'
  findings: Record<string, unknown>;
  rawResponse: unknown;
}> {
  const creds = await getLpaCredentials(orgId);
  if (!creds) throw new Error('Freddie LPA credentials not configured. Add vendor_connections row with vendor=freddie_lpa.');

  const misoXml = await buildUrla(leadId);
  const token = await getLpaToken(creds);

  const res = await fetch('https://api.sf.freddiemac.com/loansafe/v1/aus', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/xml',
      'x-freddie-seller-number': creds.sellerNumber,
      'x-correlation-id': crypto.randomUUID(),
    },
    body: misoXml,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LPA submission failed: ${res.status} ${errText}`);
  }

  const raw = await res.json();

  // LPA returns synchronously — no polling needed
  const keyNumber: string = raw.keyNumber ?? raw.loanKey ?? '';
  const recommendation: string = raw.recommendation ?? raw.riskClass ?? 'Unknown';

  return { keyNumber, recommendation, findings: raw, rawResponse: raw };
}
```

### H-2 — Register the LPA adapter

**File:** `lib/aus/registry.ts`

```ts
import { submitToLpa } from './freddieLpa';

'freddie_lpa': async (leadId, orgId) => {
  const result = await submitToLpa(leadId, orgId);
  return {
    vendor: 'freddie_lpa',
    caseId: result.keyNumber,
    recommendation: result.recommendation,
    findings: result.findings,
  };
},
```

### H-3 — Wire LOS condition import (fix TODO in syncLoan.ts)

**File:** `lib/los/syncLoan.ts`

Find `// TODO(conditions): upsert loan conditions → loan_conditions once the LOS condition payload shape is confirmed.`

The condition payload from both DU and LPA includes conditions in the findings object. Add import logic:

```ts
// After AUS findings are stored, extract and upsert conditions
async function importAusConditions(leadId: string, orgId: string, findings: Record<string, unknown>, vendor: string) {
  const sb = createAdminClient();
  const rawConditions: any[] = (findings as any)?.conditions ?? (findings as any)?.priorToDocConditions ?? [];
  if (!rawConditions.length) return;

  const rows = rawConditions.map((c: any) => ({
    lead_id: leadId,
    org_id: orgId,
    condition_type: c.type ?? 'ptd', // prior_to_docs
    description: c.description ?? c.text ?? c.conditionText ?? '',
    source: vendor,
    status: 'open',
    created_at: new Date().toISOString(),
  }));

  await sb.from('loan_conditions').upsert(rows, { onConflict: 'lead_id,description,source' });
}
```

Call `importAusConditions()` immediately after the AUS result is saved.

**Commit:** `feat(aus): Freddie LPA native adapter + LOS condition import from AUS findings`

---

## STAGE I — MERS eRegistration API

### I-1 — Build MERS eRegistration client

**Read first:**
- `lib/compliance/mersMin.ts` (local MIN validator — already exists)
- `app/(dashboard)/loans/[loanId]/ops/page.tsx` or `route.ts` (where `mers_min` field is stored)
- MERS iRegistration API: `https://www.mersinc.org/MersServices` (SOAP-based via `mersregistration.mersinc.org/MERSServices`)
- MERS uses SOAP/XML over HTTPS with a batch-file-based fallback

Create `lib/mers/eRegistration.ts`:

```ts
/**
 * MERS eRegistration via MERS iRegistration API (SOAP).
 * Docs: MERS System Rules of Membership (Rule 2) + iRegistration API Guide
 * Credentials: MERS_ORG_ID + MERS_PASSWORD in env vars or org settings
 *
 * Note: MERS requires membership and an approved iRegistration agreement.
 * Set MERS_ORG_ID and MERS_PASSWORD env vars after membership activation.
 * Endpoint: https://www.mers-servicerid.org/merssoa/services/MERSSOAService
 */
import 'server-only';
import { validateMERSMin } from '@/lib/compliance/mersMin';

const MERS_ENDPOINT = process.env.MERS_ENDPOINT ?? 'https://www.mers-servicerid.org/merssoa/services/MERSSOAService';

interface MersRegistrationData {
  mersMin: string;
  originator: {
    mersOrgId: string;
    name: string;
  };
  servicer: {
    mersOrgId: string;
  };
  loan: {
    noteDate: string; // YYYY-MM-DD
    noteAmount: number;
    propertyAddress: string;
    propertyCity: string;
    propertyState: string;
    propertyZip: string;
    borrowerLastName: string;
    borrowerFirstName: string;
    borrowerSsn?: string; // last 4 only, optional
  };
}

function buildRegistrationXml(data: MersRegistrationData): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mers="http://www.mers-servicerid.org/MersSOA">
  <soapenv:Header/>
  <soapenv:Body>
    <mers:registrationRequest>
      <mers:orgID>${process.env.MERS_ORG_ID}</mers:orgID>
      <mers:password>${process.env.MERS_PASSWORD}</mers:password>
      <mers:MIN>${data.mersMin}</mers:MIN>
      <mers:originalLenderOrgId>${data.originator.mersOrgId}</mers:originalLenderOrgId>
      <mers:currentServicerOrgId>${data.servicer.mersOrgId}</mers:currentServicerOrgId>
      <mers:noteDate>${data.loan.noteDate}</mers:noteDate>
      <mers:noteAmount>${data.loan.noteAmount.toFixed(2)}</mers:noteAmount>
      <mers:propertyAddress>${data.loan.propertyAddress}</mers:propertyAddress>
      <mers:propertyCity>${data.loan.propertyCity}</mers:propertyCity>
      <mers:propertyState>${data.loan.propertyState}</mers:propertyState>
      <mers:propertyPostalCode>${data.loan.propertyZip}</mers:propertyPostalCode>
      <mers:borrowerLastName>${data.loan.borrowerLastName}</mers:borrowerLastName>
      <mers:borrowerFirstName>${data.loan.borrowerFirstName}</mers:borrowerFirstName>
    </mers:registrationRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export async function registerWithMers(data: MersRegistrationData): Promise<{
  success: boolean;
  mersMin: string;
  registrationDate: string;
  confirmationNumber?: string;
  error?: string;
}> {
  if (!process.env.MERS_ORG_ID || !process.env.MERS_PASSWORD) {
    throw new Error('[mers] MERS_ORG_ID and MERS_PASSWORD are required for eRegistration. Set env vars after MERS membership activation.');
  }

  const validation = validateMERSMin(data.mersMin);
  if (!validation.valid) {
    throw new Error(`[mers] Invalid MIN format: ${validation.error}`);
  }

  const xml = buildRegistrationXml(data);
  const res = await fetch(MERS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml;charset=UTF-8',
      SOAPAction: 'registration',
    },
    body: xml,
  });

  const responseText = await res.text();

  if (!res.ok) {
    return { success: false, mersMin: data.mersMin, registrationDate: '', error: `HTTP ${res.status}: ${responseText}` };
  }

  // Parse SOAP response
  const successMatch = responseText.match(/<mers:status>(\w+)<\/mers:status>/);
  const confirmMatch = responseText.match(/<mers:confirmationNumber>([^<]+)<\/mers:confirmationNumber>/);
  const errorMatch = responseText.match(/<mers:errorMessage>([^<]+)<\/mers:errorMessage>/);

  const isSuccess = successMatch?.[1]?.toLowerCase() === 'success';

  if (!isSuccess) {
    return {
      success: false,
      mersMin: data.mersMin,
      registrationDate: '',
      error: errorMatch?.[1] ?? 'Unknown MERS error',
    };
  }

  return {
    success: true,
    mersMin: data.mersMin,
    registrationDate: new Date().toISOString(),
    confirmationNumber: confirmMatch?.[1],
  };
}
```

### I-2 — Create MERS API route

Create `app/api/loans/[loanId]/mers/register/route.ts`:

```ts
import { registerWithMers } from '@/lib/mers/eRegistration';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const sb = createAdminClient();

  // Fetch loan data
  const { data: lead } = await sb
    .from('leads')
    .select(`
      first_name, last_name, loan_amount,
      property_address, property_city, property_state, property_zip,
      mers_min, mers_registered_date,
      profiles!leads_assigned_lo_fkey(org_id, organizations(mers_org_id, mers_servicer_org_id, name))
    `)
    .eq('id', params.loanId)
    .single();

  if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  if (!lead.mers_min) return NextResponse.json({ error: 'MIN not assigned. Assign a MERS MIN before registering.' }, { status: 400 });
  if (lead.mers_registered_date) return NextResponse.json({ error: 'Already registered with MERS.', registeredAt: lead.mers_registered_date }, { status: 409 });

  const org = (lead.profiles as any)?.organizations as any;
  const body = await req.json(); // { noteDate: 'YYYY-MM-DD' }

  const result = await registerWithMers({
    mersMin: lead.mers_min,
    originator: {
      mersOrgId: org?.mers_org_id ?? process.env.MERS_ORG_ID!,
      name: org?.name ?? '',
    },
    servicer: {
      mersOrgId: org?.mers_servicer_org_id ?? org?.mers_org_id ?? process.env.MERS_ORG_ID!,
    },
    loan: {
      noteDate: body.noteDate,
      noteAmount: lead.loan_amount ?? 0,
      propertyAddress: lead.property_address ?? '',
      propertyCity: lead.property_city ?? '',
      propertyState: lead.property_state ?? '',
      propertyZip: lead.property_zip ?? '',
      borrowerLastName: lead.last_name ?? '',
      borrowerFirstName: lead.first_name ?? '',
    },
  });

  if (result.success) {
    // Record registration in DB
    await sb.from('leads').update({
      mers_registered_date: result.registrationDate,
      mers_registration_number: result.confirmationNumber,
    }).eq('id', params.loanId);

    await sb.from('audit_events').insert({
      lead_id: params.loanId,
      event_type: 'mers_registered',
      event_data: { min: lead.mers_min, confirmationNumber: result.confirmationNumber },
      created_at: new Date().toISOString(),
    });
  }

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
```

### I-3 — Wire MERS registration button into post-close page

**File:** `app/(dashboard)/loans/[loanId]/post-close/page.tsx` or the ops/post-close area

Find where `mers_min` is displayed. Add a "Register with MERS" button that:
- Is disabled if `mers_registered_date` already set (shows "Registered ✓")
- Posts to `/api/loans/[loanId]/mers/register` with the note date
- Shows confirmation number on success

**Commit:** `feat(mers): MERS eRegistration SOAP API integration`

---

## STAGE J — Gmail / Outlook 2-Way Email Sync

**Note:** This requires OAuth app registrations with Google and Microsoft. Before running this stage, ensure:
- Google Cloud project with Gmail API enabled → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Azure app registration with Mail.ReadWrite scope → `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`

Read first:
```bash
grep -rn "email_integrations" supabase/migrations/ supabase/APPLY_MISSING_MIGRATIONS.sql --include="*.sql"
find app/ lib/ -path "*email*integration*" -o -path "*gmail*" -o -path "*outlook*" | head -20
```

### J-1 — OAuth connection flow

Create `lib/email-sync/providers.ts`:

```ts
export type EmailProvider = 'gmail' | 'outlook';

export function getOAuthUrl(provider: EmailProvider, orgId: string, userId: string): string {
  const state = Buffer.from(JSON.stringify({ provider, orgId, userId })).toString('base64');

  if (provider === 'gmail') {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/email-sync/oauth/callback`,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  if (provider === 'outlook') {
    const tenantId = process.env.MICROSOFT_TENANT_ID ?? 'common';
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/email-sync/oauth/callback`,
      response_type: 'code',
      scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access',
      state,
    });
    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;
  }

  throw new Error(`Unknown provider: ${provider}`);
}
```

### J-2 — OAuth callback handler

Create `app/api/email-sync/oauth/callback/route.ts`:

```ts
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  if (!code || !stateRaw) return NextResponse.redirect('/settings/integrations?error=oauth_failed');

  const { provider, orgId, userId } = JSON.parse(Buffer.from(stateRaw, 'base64').toString());
  const sb = createAdminClient();

  // Exchange code for tokens
  let tokens: { access_token: string; refresh_token: string; expires_in: number };
  if (provider === 'gmail') {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, grant_type: 'authorization_code',
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/email-sync/oauth/callback`,
      }),
    });
    tokens = await res.json();
  } else {
    const tenantId = process.env.MICROSOFT_TENANT_ID ?? 'common';
    const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, grant_type: 'authorization_code',
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/email-sync/oauth/callback`,
        scope: 'https://graph.microsoft.com/Mail.ReadWrite offline_access',
      }),
    });
    tokens = await res.json();
  }

  // Fetch email address
  let emailAddress = '';
  if (provider === 'gmail') {
    const profileRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();
    emailAddress = profile.emailAddress;
  } else {
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const me = await meRes.json();
    emailAddress = me.mail ?? me.userPrincipalName;
  }

  // Store (encrypt tokens before saving — use AES pattern from lib/compliance/encryption.ts)
  await sb.from('email_integrations').upsert({
    org_id: orgId,
    user_id: userId,
    provider,
    email_address: emailAddress,
    access_token: tokens.access_token, // TODO: encrypt before storing
    refresh_token: tokens.refresh_token,
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    is_active: true,
    synced_at: null,
  }, { onConflict: 'org_id,user_id,provider' });

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?connected=${provider}`);
}
```

### J-3 — Email sync engine

Create `lib/email-sync/sync.ts`:

```ts
/**
 * Syncs emails from Gmail or Outlook into lead communications.
 * Run via cron every 15 minutes per connected account.
 * Matches emails to leads by email address in leads.email field.
 */
import { createAdminClient } from '@/lib/supabase/admin';

async function refreshGmailToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });
  const json = await res.json();
  return json.access_token;
}

async function syncGmailMessages(integration: any, sb: any) {
  const accessToken = await refreshGmailToken(integration.refresh_token);

  // Fetch messages since last sync
  const sinceEpoch = integration.synced_at
    ? Math.floor(new Date(integration.synced_at).getTime() / 1000)
    : Math.floor(Date.now() / 1000) - 30 * 86400; // last 30 days on first sync

  const listRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?q=after:${sinceEpoch}&maxResults=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const list = await listRes.json();
  const messages = list.messages ?? [];

  for (const { id } of messages) {
    const msgRes = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const msg = await msgRes.json();

    const headers = msg.payload?.headers ?? [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

    const from = getHeader('From');
    const to = getHeader('To');
    const subject = getHeader('Subject');
    const date = getHeader('Date');

    // Extract email addresses
    const fromEmail = from.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] ?? '';
    const toEmails = (to.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []);

    // Match to lead
    const emailsToMatch = [fromEmail, ...toEmails].filter(Boolean);
    const { data: matchedLeads } = await sb
      .from('leads')
      .select('id, org_id')
      .in('email', emailsToMatch)
      .eq('org_id', integration.org_id);

    for (const lead of (matchedLeads ?? [])) {
      await sb.from('communications').upsert({
        lead_id: lead.id,
        org_id: lead.org_id,
        channel: 'email',
        direction: fromEmail === integration.email_address ? 'outbound' : 'inbound',
        external_id: msg.id,
        from_address: from,
        to_address: to,
        subject,
        body_preview: subject,
        sent_at: new Date(date).toISOString(),
        provider: 'gmail',
        provider_thread_id: msg.threadId,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'external_id,channel' });
    }
  }
}

async function syncOutlookMessages(integration: any, sb: any) {
  // Refresh token
  const tenantId = process.env.MICROSOFT_TENANT_ID ?? 'common';
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: integration.refresh_token,
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      scope: 'https://graph.microsoft.com/Mail.ReadWrite offline_access',
    }),
  });
  const { access_token: accessToken } = await tokenRes.json();

  const since = integration.synced_at ?? new Date(Date.now() - 30 * 86400000).toISOString();
  const filter = `receivedDateTime ge ${since}`;

  const msgsRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(filter)}&$top=100&$select=id,subject,from,toRecipients,receivedDateTime,conversationId`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const { value: messages = [] } = await msgsRes.json();

  for (const msg of messages) {
    const fromEmail = msg.from?.emailAddress?.address ?? '';
    const toEmails = (msg.toRecipients ?? []).map((r: any) => r.emailAddress?.address).filter(Boolean);
    const emailsToMatch = [fromEmail, ...toEmails];

    const { data: matchedLeads } = await sb
      .from('leads')
      .select('id, org_id')
      .in('email', emailsToMatch)
      .eq('org_id', integration.org_id);

    for (const lead of (matchedLeads ?? [])) {
      await sb.from('communications').upsert({
        lead_id: lead.id,
        org_id: lead.org_id,
        channel: 'email',
        direction: fromEmail === integration.email_address ? 'outbound' : 'inbound',
        external_id: msg.id,
        from_address: `${msg.from?.emailAddress?.name} <${fromEmail}>`,
        to_address: toEmails.join(', '),
        subject: msg.subject,
        body_preview: msg.subject,
        sent_at: msg.receivedDateTime,
        provider: 'outlook',
        provider_thread_id: msg.conversationId,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'external_id,channel' });
    }
  }
}

export async function syncAllEmailIntegrations() {
  const sb = createAdminClient();
  const { data: integrations } = await sb
    .from('email_integrations')
    .select('*')
    .eq('is_active', true);

  for (const integration of (integrations ?? [])) {
    try {
      if (integration.provider === 'gmail') {
        await syncGmailMessages(integration, sb);
      } else if (integration.provider === 'outlook') {
        await syncOutlookMessages(integration, sb);
      }
      await sb.from('email_integrations')
        .update({ synced_at: new Date().toISOString() })
        .eq('id', integration.id);
    } catch (err) {
      console.error(`[email-sync] Failed for integration ${integration.id}:`, err);
    }
  }
}
```

### J-4 — Create email sync cron route

Create `app/api/cron/sync-emails/route.ts`:

```ts
import { syncAllEmailIntegrations } from '@/lib/email-sync/sync';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await syncAllEmailIntegrations();
  return NextResponse.json({ ok: true, synced: new Date().toISOString() });
}
```

Schedule this cron every 15 minutes in Supabase Edge Functions or Vercel Crons:
```
# vercel.json crons section:
{ "path": "/api/cron/sync-emails", "schedule": "*/15 * * * *" }
```

### J-5 — Connect UI in settings/integrations

**File:** `app/(dashboard)/settings/integrations/page.tsx`

Read the file. Find where email integrations are shown (it's a thin shell with sub-components). In the email integration sub-component, add:
- "Connect Gmail" button → links to `/api/email-sync/oauth/initiate?provider=gmail`
- "Connect Outlook" button → links to `/api/email-sync/oauth/initiate?provider=outlook`
- Connected state: shows email address + last synced timestamp + "Disconnect" button
- Disconnect: DELETE `/api/email-sync/[integrationId]`

Create `app/api/email-sync/oauth/initiate/route.ts`:
```ts
import { getOAuthUrl } from '@/lib/email-sync/providers';
export async function GET(req: Request) {
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider') as any;
  // get orgId + userId from Clerk session
  const { userId } = await auth();
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('org_id').eq('id', userId!).single();
  const redirectUrl = getOAuthUrl(provider, profile!.org_id, userId!);
  return NextResponse.redirect(redirectUrl);
}
```

Add `email_integrations` columns (if table doesn't have them) to `APPLY_MISSING_MIGRATIONS.sql`:
```sql
ALTER TABLE email_integrations
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'gmail',
  ADD COLUMN IF NOT EXISTS email_address text,
  ADD COLUMN IF NOT EXISTS access_token text,   -- TODO: encrypt via AES-256-GCM
  ADD COLUMN IF NOT EXISTS refresh_token text,  -- TODO: encrypt via AES-256-GCM
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;
```

**Commit:** `feat(email-sync): Gmail + Outlook 2-way email sync OAuth flow, sync engine, cron`

---

## STAGE K — State Disclosure Library

### K-1 — Create state disclosure table and content

Add to `APPLY_MISSING_MIGRATIONS.sql`:

```sql
CREATE TABLE IF NOT EXISTS state_disclosures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code char(2) NOT NULL,
  disclosure_type text NOT NULL,
    CONSTRAINT disclosure_type_check CHECK (disclosure_type IN (
      'right_to_choose_insurance',
      'arm_disclosure',
      'commitment_fee',
      'prepayment_penalty',
      'balloon_payment',
      'anti_steering',
      'deed_of_trust_trustee',
      'homebuyer_counseling',
      'fair_lending',
      'state_specific_tila',
      'other'
    )),
  title text NOT NULL,
  content text NOT NULL,
  effective_date date,
  citation text, -- statutory or regulatory citation
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(state_code, disclosure_type)
);
ALTER TABLE state_disclosures ENABLE ROW LEVEL SECURITY;
-- State disclosures are read-only for all authenticated users (platform-managed content)
CREATE POLICY "authenticated_read" ON state_disclosures FOR SELECT USING (auth.role() = 'authenticated');
```

### K-2 — Seed common state disclosures

Create `supabase/seeds/state_disclosures.sql` with required state-specific disclosures for the 20 most common mortgage states. Include at minimum:

- **CA**: Right to choose own title insurance, anti-predatory lending
- **TX**: Home equity restrictions (§50(a)(6)), deed of trust trustee requirement
- **FL**: Documentary stamp tax disclosure, balloon payment warning
- **NY**: Commitment fee disclosure, cooling-off period
- **GA**: Anti-flipping, fair lending statement
- **IL**: Predatory lending database
- **WA**: Prepayment penalty limits, balloon payment
- **OR**: Mortgage banking anti-discrimination
- **VA**: Fair lending, right to rescission reminder

```sql
INSERT INTO state_disclosures (state_code, disclosure_type, title, content, citation) VALUES

('CA', 'right_to_choose_insurance',
 'California Right to Choose Title Insurance',
 'In California, you have the right to choose your own title insurance company and escrow company. The selection of title insurance and escrow company should not be required as a condition of your real estate purchase. For more information, contact the California Department of Insurance.',
 'Cal. Ins. Code § 12404'),

('TX', 'state_specific_tila',
 'Texas Home Equity Loan Notice',
 'If this loan is a Texas home equity loan (§50(a)(6) loan), the following apply: (1) The homestead property is located in Texas; (2) You may prepay the loan without penalty; (3) The total fees for this loan may not exceed 2% of the original principal balance; (4) The loan may not close before 12 days after you submit your application.',
 'Texas Const. Art. XVI, §50(a)(6)'),

('FL', 'balloon_payment',
 'Florida Balloon Payment Disclosure',
 'This loan contains a balloon payment. This means that after making your regular monthly payments, you will be required to make a large final payment. If you are unable to make this payment, you may have to refinance this loan at current market rates, which may be significantly higher than the rate on this loan.',
 'Fla. Stat. § 494.0025'),

('NY', 'commitment_fee',
 'New York Mortgage Commitment',
 'A mortgage commitment is a written statement that your lender agrees to make a mortgage loan to you. If a commitment has been issued, your lender is bound by its terms for the period stated in the commitment. You have the right to a copy of the appraisal report.',
 'N.Y. Banking Law § 6-m')

-- Add remaining states...
;
```

### K-3 — Create state disclosure API + UI

Create `app/api/disclosures/state/[state]/route.ts`:
```ts
export async function GET(req: Request, { params }: { params: { state: string } }) {
  const sb = createAdminClient();
  const { data } = await sb
    .from('state_disclosures')
    .select('*')
    .eq('state_code', params.state.toUpperCase())
    .eq('is_active', true)
    .order('disclosure_type');
  return NextResponse.json(data ?? []);
}
```

Create `app/(dashboard)/docs-compliance/state-disclosures/page.tsx`:
- Server component: detect `property_state` from the current loan context (read from URL params or query)
- Fetch applicable disclosures via API
- Display each disclosure with title, content, citation
- "Print/Download" button that generates a PDF of all required disclosures for the state using `pdf-lib`
- Show "No state-specific disclosures required" if state has no entries

Wire state disclosures into the loan origination checklist: when a loan is in the `disclosure` or `processing` stage and the property state is known, flag that state disclosures must be delivered.

**Commit:** `feat(state-disclosures): state disclosure library with table, seed content, API, and UI`

---

## FINAL — TypeScript check + verification

```bash
pnpm tsc --noEmit
```

Zero errors required.

### Functional verification checklist

- [ ] Submit a test borrower application → no `applications` table error in Supabase logs
- [ ] Click a resume SMS link → lands on `/apply/smart/[token]` not `/apply`
- [ ] Trigger a sign flow → server logs show the new `[sign] PrimeMind Sign is not provisioned` error (not silent)
- [ ] Run campaign cron → Supabase `campaign_step_sends` rows have `delivery = 'sent'` and Twilio/Resend logs show outbound activity
- [ ] Navigate to `/automations` → page shows real rules from DB (or empty state if none), toggle persists across reload
- [ ] Navigate to `/ai-agents` → no hardcoded "4 LOs briefed today" anywhere; shows real timestamps from `agent_run_log`
- [ ] Navigate to `/loans/[loanId]/insurance` → HOI form loads and saves to `hoi_verifications`
- [ ] Generate adverse action notice → downloads valid PDF with Reg B reason codes
- [ ] AUS submit with DU vendor connection → DU case file ID returned (or clear error if no credentials)
- [ ] AUS submit with LPA vendor connection → LPA recommendation returned (or clear error if no credentials)
- [ ] MERS register button → calls SOAP endpoint (or clear error message if `MERS_ORG_ID` unset)
- [ ] Connect Gmail → OAuth redirect works, email_integrations row created
- [ ] `/docs-compliance/state-disclosures` → shows disclosures for current loan's state

**Final commit:** `chore(gap-fixes): run tsc clean, verify all stages complete`
