# AshleyIQ — Full Point of Sale (POS) + Lead Forms
## Claude Code Build Prompt · Sprint 4-B

---

## WHY THIS EXISTS

Arrive charges $500–$1,200/month just for their POS. Encompass has a POS (Encompass Consumer Connect) but it's clunky, dated, and requires the LO to configure it. AshleyIQ needs a fully branded, embeddable POS that generates URLA-compliant applications and feeds directly into the pipeline — all within the same platform the LO already lives in.

**Two modes:**
1. **Full URLA Application** — borrower completes a full 1003 online, digitally signs, uploads documents, and tracks status. Hosted at `apply.[org-domain].com` or `ashleyiq.app/apply/[org-slug]`.
2. **Short Lead Capture Widget** — embeddable `<script>` tag that drops a 3-field lead form onto any Realtor/builder website in under 5 minutes.

---

## WHAT ARRIVE DOES (benchmark)

- Full URLA 3.4 digital application with branching logic
- Joint application support
- Real-time credit pull (hard pull, consumer-authorized)
- Document collection portal
- eSign disclosures (RESPA, TILA, ECOA)
- LO-branded with photo, NMLS, bio
- White-label domain
- Pre-qual engine
- Embeddable short form

AshleyIQ must match all of these.

---

## EXECUTION ORDER

1. DB migration
2. POS application routes (borrower-facing)
3. URLA form engine
4. LO branding + org config
5. Embeddable widget
6. Speed-to-lead trigger (calls prompt-ashleyiq-speed-to-lead)
7. Dashboard intake view
8. eSign disclosure flow

---

## STEP 1 — DATABASE MIGRATION

`supabase/migrations/005_pos.sql`

```sql
-- POS configuration per org
CREATE TABLE IF NOT EXISTS pos_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  lo_id             UUID REFERENCES profiles(id),  -- default assigned LO for this POS
  brand_name        TEXT,
  brand_logo_url    TEXT,
  brand_color       TEXT DEFAULT '#C9A95C',
  lo_photo_url      TEXT,
  lo_bio            TEXT,
  lo_nmls_id        TEXT,
  lo_phone          TEXT,
  lo_email          TEXT,
  custom_domain     TEXT,  -- e.g. apply.smithmortgage.com
  slug              TEXT NOT NULL UNIQUE,  -- ashleyiq.app/apply/[slug]
  welcome_headline  TEXT DEFAULT 'Get Pre-Qualified Today',
  welcome_body      TEXT,
  require_ssn       BOOLEAN DEFAULT false,  -- trigger hard pull if true
  soft_pull_enabled BOOLEAN DEFAULT true,   -- AshleyIQ credit repair pull
  active            BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Full URLA application
CREATE TABLE IF NOT EXISTS pos_applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id),
  pos_config_id       UUID NOT NULL REFERENCES pos_configs(id),
  lead_id             UUID REFERENCES leads(id),
  app_reference       TEXT UNIQUE,  -- human-readable e.g. APP-2026-00123
  status              TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN ('started','in_progress','submitted','disclosures_sent',
                      'disclosures_signed','processing','approved','denied','withdrawn')),
  is_joint            BOOLEAN NOT NULL DEFAULT false,
  loan_purpose        TEXT CHECK (loan_purpose IN ('purchase','refinance','cash_out_refinance','heloc','construction')),
  property_use        TEXT CHECK (property_use IN ('primary_residence','secondary_home','investment')),
  property_type       TEXT,
  purchase_price      NUMERIC(12,2),
  loan_amount         NUMERIC(12,2),
  down_payment        NUMERIC(12,2),
  -- Section I: Borrower Info
  borrower_first_name TEXT,
  borrower_last_name  TEXT,
  borrower_email      TEXT,
  borrower_phone      TEXT,
  -- PII: SSN and DOB collected in form but NEVER stored here
  -- pass directly to credit pull API only
  -- Section II: Employment
  employer_name       TEXT,
  employer_phone      TEXT,
  employment_years    NUMERIC(4,1),
  base_income         NUMERIC(12,2),
  bonus_income        NUMERIC(12,2),
  employment_type     TEXT CHECK (employment_type IN ('employed','self_employed','retired','other')),
  -- Section III: Assets / Liabilities (summary, not full itemization)
  checking_savings    NUMERIC(12,2),
  retirement_assets   NUMERIC(12,2),
  other_assets        NUMERIC(12,2),
  total_monthly_debts NUMERIC(12,2),
  -- Section IV: Real Estate
  property_address    TEXT,
  property_city       TEXT,
  property_state      CHAR(2),
  property_zip        TEXT,
  -- Section V: Declarations (URLA required)
  declarations        JSONB DEFAULT '{}',
  -- Demographic Info (HMDA — optional, government monitoring purposes)
  demographics        JSONB DEFAULT '{}',
  -- E-sign
  disclosures_signed_at TIMESTAMPTZ,
  ecoa_signed_at        TIMESTAMPTZ,
  -- Metadata
  utm_source          TEXT,
  utm_medium          TEXT,
  utm_campaign        TEXT,
  submitted_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Co-borrower (joint application)
CREATE TABLE IF NOT EXISTS pos_coborrowers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID NOT NULL REFERENCES pos_applications(id) ON DELETE CASCADE,
  first_name          TEXT,
  last_name           TEXT,
  email               TEXT,
  phone               TEXT,
  employer_name       TEXT,
  base_income         NUMERIC(12,2),
  employment_type     TEXT,
  declarations        JSONB DEFAULT '{}'
  -- PII: SSN/DOB never stored
);

-- Document requests tied to POS application
-- (reuses document_requests table from main conduit schema, add FK)
ALTER TABLE document_requests ADD COLUMN IF NOT EXISTS pos_application_id UUID REFERENCES pos_applications(id);

-- Auto-increment app reference
CREATE SEQUENCE IF NOT EXISTS pos_app_seq START 1;
CREATE OR REPLACE FUNCTION generate_app_reference()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.app_reference := 'APP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('pos_app_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_app_reference
  BEFORE INSERT ON pos_applications
  FOR EACH ROW WHEN (NEW.app_reference IS NULL)
  EXECUTE FUNCTION generate_app_reference();

-- RLS
ALTER TABLE pos_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_coborrowers ENABLE ROW LEVEL SECURITY;

-- POS config: org members only
CREATE POLICY "org_pos_config" ON pos_configs
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));

-- Applications: org members only (borrower-facing routes use service_role)
CREATE POLICY "org_pos_applications" ON pos_applications
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_pos_apps_org ON pos_applications(org_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_apps_lead ON pos_applications(lead_id);
```

---

## STEP 2 — POS BORROWER ROUTES

All POS routes are unauthenticated (no Clerk session). Use `createAdminClient()` everywhere in server components. Rate-limit via Upstash or Vercel middleware.

### Route structure:
```
app/(pos)/apply/[slug]/
├── page.tsx              ← Landing/start page (LO branding)
├── start/page.tsx        ← Loan purpose selector
├── purchase/page.tsx     ← Purchase application (multi-step)
├── refinance/page.tsx    ← Refi application (multi-step)
├── submitted/page.tsx    ← Confirmation + next steps
└── layout.tsx            ← POS shell (no dashboard nav)
```

`app/(pos)/apply/[slug]/page.tsx`

```typescript
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import POSLandingClient from './POSLandingClient';

export const dynamic = 'force-dynamic';

export default async function POSLandingPage({ params }: { params: { slug: string } }) {
  const sb = createAdminClient();
  const { data: config } = await sb
    .from('pos_configs')
    .select('*, profiles!lo_id(first_name, last_name, nmls_id, phone, email)')
    .eq('slug', params.slug)
    .eq('active', true)
    .single();

  if (!config) notFound();

  return <POSLandingClient config={config} />;
}
```

`app/(pos)/apply/[slug]/POSLandingClient.tsx`

```typescript
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface POSConfig {
  slug: string;
  brand_name: string;
  brand_logo_url: string;
  brand_color: string;
  lo_photo_url: string;
  lo_bio: string;
  lo_nmls_id: string;
  lo_phone: string;
  lo_email: string;
  welcome_headline: string;
  welcome_body: string;
  profiles?: { first_name: string; last_name: string; nmls_id: string; };
}

export default function POSLandingClient({ config }: { config: POSConfig }) {
  const router = useRouter();
  const [loanType, setLoanType] = useState<'purchase' | 'refinance' | null>(null);

  return (
    <div className="min-h-screen bg-[#F5EFE0] flex flex-col items-center justify-center p-6">
      {/* LO Branding Header */}
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6 text-center" style={{ backgroundColor: config.brand_color }}>
          {config.brand_logo_url && (
            <img src={config.brand_logo_url} alt={config.brand_name} className="h-12 mx-auto mb-3 object-contain" />
          )}
          <h1 className="text-2xl font-bold text-white font-['Lora']">{config.welcome_headline}</h1>
        </div>
        {/* LO Card */}
        {config.lo_photo_url && (
          <div className="flex items-center gap-4 px-6 py-4 border-b">
            <img src={config.lo_photo_url} alt="" className="w-14 h-14 rounded-full object-cover" />
            <div>
              <p className="font-semibold text-[#0F1D2E]">
                {config.profiles?.first_name} {config.profiles?.last_name}
              </p>
              <p className="text-sm text-[#6B7B8D]">NMLS #{config.lo_nmls_id ?? config.profiles?.nmls_id}</p>
              {config.lo_phone && <p className="text-sm text-[#6B7B8D]">{config.lo_phone}</p>}
            </div>
          </div>
        )}
        {/* Loan Type Selector */}
        <div className="p-6 space-y-3">
          <p className="text-[#0F1D2E] font-medium text-center mb-4">What are you looking to do?</p>
          {(['purchase', 'refinance'] as const).map(type => (
            <button
              key={type}
              onClick={() => {
                setLoanType(type);
                router.push(`/apply/${config.slug}/${type}`);
              }}
              className="w-full p-4 rounded-xl border-2 text-left transition-all hover:border-[#C9A95C]"
              style={{ borderColor: loanType === type ? config.brand_color : '#E5E7EB' }}
            >
              <p className="font-semibold capitalize text-[#0F1D2E]">
                {type === 'purchase' ? '🏠 Buy a Home' : '🔄 Refinance My Home'}
              </p>
              <p className="text-sm text-[#6B7B8D] mt-0.5">
                {type === 'purchase' ? 'Get pre-qualified for a purchase' : 'Lower your rate or access equity'}
              </p>
            </button>
          ))}
        </div>
        <div className="px-6 pb-4 text-center text-xs text-[#6B7B8D]">
          Equal Housing Lender · NMLS #{config.lo_nmls_id ?? config.profiles?.nmls_id}
        </div>
      </div>
    </div>
  );
}
```

---

## STEP 3 — MULTI-STEP URLA FORM ENGINE

`app/(pos)/apply/[slug]/purchase/page.tsx`

Client-side multi-step wizard. Steps:

```
Step 1: Property Info → address, type, purchase price, down payment, estimated close date
Step 2: Borrower Info → name, email, phone, DOB*, marital status
         ⚠️ DOB: pass directly to credit pull, display "used for identity verification only"
Step 3: Employment → employer, title, start date, monthly income, employment type
Step 4: Assets → checking, savings, retirement, gifts
Step 5: Liabilities → credit cards, auto loans, student loans, other monthly payments
Step 6: Real Estate Owned → current home? rent? both?
Step 7: Declarations (URLA Section IV) → bankruptcy, foreclosure, lawsuits, delinquencies
Step 8: Demographic Info → race/ethnicity (HMDA required for monitoring only, optional for borrower)
Step 9: Review + eSign Disclosures → RESPA, TILA, ECOA
Step 10: Submitted → confirmation screen, next steps, portal link
```

**Key rules:**
- All steps client-side React state (no DB writes until final submit)
- Validate each step before advancing
- Progress bar with step indicator
- Mobile-first layout (80%+ of applicants are on phone)
- PII guidance: SSN field displays "Your SSN is used only for credit verification and is never stored on our servers"

`app/api/pos/submit/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sb = createAdminClient();
  const body = await req.json() as {
    slug: string;
    applicationData: Record<string, unknown>;
    // NOTE: SSN and DOB are extracted here, used for credit pull, then discarded
    ssn?: string;
    dob?: string;
  };

  // Resolve config
  const { data: config } = await sb.from('pos_configs').select('id, org_id, lo_id').eq('slug', body.slug).single();
  if (!config) return NextResponse.json({ error: 'Invalid POS' }, { status: 404 });

  // Extract PII — use immediately for credit pull if needed, never persist
  const ssn = body.ssn;
  const dob = body.dob;
  // PII: SSN and DOB are NOT stored in Supabase under any circumstances
  // They are passed to credit pull API only and discarded from memory after this request

  // Create or find lead
  const appData = body.applicationData as {
    borrower_first_name: string;
    borrower_last_name: string;
    borrower_email: string;
    borrower_phone: string;
    loan_purpose: string;
    property_state: string;
    purchase_price: number;
    loan_amount: number;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };

  let leadId: string;
  const { data: existingLead } = await sb
    .from('leads')
    .select('id')
    .eq('org_id', config.org_id)
    .eq('email', appData.borrower_email)
    .maybeSingle();

  if (existingLead) {
    leadId = existingLead.id;
    await sb.from('leads').update({ stage: 'application_submitted' }).eq('id', leadId);
  } else {
    const { data: newLead } = await sb.from('leads').insert({
      org_id: config.org_id,
      assigned_to: config.lo_id,
      first_name: appData.borrower_first_name,
      last_name: appData.borrower_last_name,
      email: appData.borrower_email,
      phone: appData.borrower_phone,
      loan_purpose: appData.loan_purpose,
      source: 'pos',
      source_metadata: { utm_source: appData.utm_source, utm_medium: appData.utm_medium, utm_campaign: appData.utm_campaign },
      tcpa_consent_at: new Date().toISOString(),
      tcpa_consent_source: 'pos_application',
      stage: 'application_submitted',
      routing_status: 'pending',
    }).select('id').single();
    leadId = newLead!.id;
  }

  // Insert application (SSN/DOB excluded from insert)
  const { data: application } = await sb.from('pos_applications').insert({
    org_id: config.org_id,
    pos_config_id: config.id,
    lead_id: leadId,
    ...appData,
    // ssn and dob intentionally omitted
    submitted_at: new Date().toISOString(),
    status: 'submitted',
  }).select('id, app_reference').single();

  // Trigger speed-to-lead routing
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/leads/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadId, orgId: config.org_id }),
  });

  // Create borrower portal token so borrower can track status
  const token = crypto.randomUUID();
  await sb.from('borrower_portal_tokens').insert({
    token,
    lead_id: leadId,
    org_id: config.org_id,
    expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),  // 6 months
  });

  return NextResponse.json({
    success: true,
    appReference: application!.app_reference,
    portalUrl: `${process.env.NEXT_PUBLIC_APP_URL}/status/${token}`,
  });
}
```

---

## STEP 4 — EMBEDDABLE LEAD WIDGET

`app/api/pos/widget/[slug]/route.ts`

Serves a self-contained JavaScript widget. LO/Realtor adds one `<script>` tag to their site.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const sb = createAdminClient();
  const { data: config } = await sb
    .from('pos_configs')
    .select('brand_color, brand_name, welcome_headline, lo_nmls_id, slug')
    .eq('slug', params.slug)
    .single();
  if (!config) return new NextResponse('// Widget not found', { headers: { 'Content-Type': 'text/javascript' } });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const color = config.brand_color ?? '#C9A95C';

  const js = `
(function(){
  var c=document.getElementById('ashleyiq-widget');
  if(!c)return;
  c.innerHTML='<div style="font-family:sans-serif;max-width:420px;padding:20px;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1)">'
    +'<h3 style="margin:0 0 16px;color:#0F1D2E;font-size:18px">${config.welcome_headline}</h3>'
    +'<input id="aq-name" placeholder="Full Name" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:10px;box-sizing:border-box">'
    +'<input id="aq-email" type="email" placeholder="Email Address" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:10px;box-sizing:border-box">'
    +'<input id="aq-phone" type="tel" placeholder="Phone Number" style="width:100%;padding:10px;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:10px;box-sizing:border-box">'
    +'<p style="font-size:11px;color:#6B7B8D;margin-bottom:12px">By submitting you consent to receive calls/texts from ${config.brand_name}. Reply STOP to opt out.</p>'
    +'<button id="aq-btn" style="width:100%;padding:12px;background:${color};color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">Get Pre-Qualified →</button>'
    +'<p id="aq-msg" style="font-size:13px;color:#0F1D2E;text-align:center;margin-top:8px;display:none"></p>'
    +'<p style="font-size:10px;text-align:center;margin-top:10px;color:#6B7B8D">NMLS #${config.lo_nmls_id} · Equal Housing Lender</p>'
    +'</div>';
  document.getElementById('aq-btn').addEventListener('click',function(){
    var n=document.getElementById('aq-name').value;
    var e=document.getElementById('aq-email').value;
    var p=document.getElementById('aq-phone').value;
    if(!n||!e||!p){document.getElementById('aq-msg').style.display='block';document.getElementById('aq-msg').textContent='Please fill in all fields.';return;}
    this.disabled=true;this.textContent='Sending...';
    fetch('${appUrl}/api/leads/widget','{ method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug:"${config.slug}",name:n,email:e,phone:p,tcpa:true,source:"widget",source_url:window.location.href})}')
    .then(function(r){return r.json();})
    .then(function(d){
      document.getElementById('aq-msg').style.display='block';
      document.getElementById('aq-msg').textContent='Thanks! An LO will contact you shortly.';
    });
  });
})();
`.trim();

  return new NextResponse(js, {
    headers: { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' },
  });
}
```

**Usage for LO / Realtor:**
```html
<div id="ashleyiq-widget"></div>
<script src="https://ashleyiq.app/api/pos/widget/[your-slug]" async></script>
```

`app/api/leads/widget/route.ts` — receives widget submissions, creates lead, fires routing.

---

## STEP 5 — POS SETTINGS (LO Dashboard)

`app/(dashboard)/settings/pos/page.tsx`

Form fields:
- Welcome headline + body
- Brand color picker
- Logo upload (Supabase Storage `pos-assets` bucket)
- LO photo upload
- NMLS ID
- Phone number displayed on POS
- Custom domain instructions (CNAME setup)
- Toggle: require SSN for soft pull
- Preview button → opens `/apply/[slug]` in new tab
- Widget embed code copy button

---

## STEP 6 — POS APPLICATIONS DASHBOARD

`app/(dashboard)/applications/page.tsx`

Table columns: App Reference | Borrower Name | Loan Type | Purchase Price | Status | Submitted | Assigned LO | [Review]

Status badge colors:
- `started` / `in_progress` → gray
- `submitted` → blue
- `disclosures_signed` → purple
- `processing` → yellow
- `approved` → green
- `denied` / `withdrawn` → red

---

## STEP 7 — DISCLOSURE FLOW

RESPA, TILA, and ECOA disclosures must be presented and signed before the application is processed.

Use PrimeMind Sign (internal e-signature SDK) if available in this codebase. If not wired yet:

`app/api/pos/disclosures/sign/route.ts`

```typescript
// Simplified inline e-sign (checkbox + timestamp) until PrimeMind Sign is wired
// Store: pos_applications.disclosures_signed_at, ecoa_signed_at
// Must display full disclosure text before checkbox is enabled
// Log to speed_to_lead_events as 'disclosures_signed'
```

Disclosure text required:
1. **RESPA Disclosure** — "You will receive a Loan Estimate within 3 business days of application..."
2. **TILA / Reg Z** — APR, finance charges, total payments, payment schedule (estimated)
3. **ECOA (Equal Credit Opportunity Act)** — anti-discrimination notice
4. **Fair Credit Reporting Act** — authorization to pull credit

---

## ENV VARS (POS-specific)

```bash
NEXT_PUBLIC_POS_BASE_URL=https://ashleyiq.app/apply
# or custom domain, configured per org
```

---

## VERIFICATION CHECKLIST

- [ ] `/apply/[slug]` loads LO branding from pos_configs
- [ ] Loan purpose selector routes to correct form
- [ ] Purchase form completes all 10 steps without error
- [ ] SSN field shows warning text; SSN is NOT inserted into pos_applications table
- [ ] App reference generated (APP-2026-00001 format)
- [ ] Borrower portal token created on submit
- [ ] Speed-to-lead routing fires automatically on POS submit
- [ ] Widget `<script>` renders on external page, submits lead
- [ ] Widget lead triggers speed-to-lead routing
- [ ] TCPA consent logged on widget submission
- [ ] POS settings page saves config, preview button works
- [ ] Applications dashboard table shows submissions with correct status
- [ ] Disclosure step requires checkbox before form can submit
- [ ] Unknown/invalid slug returns 404
