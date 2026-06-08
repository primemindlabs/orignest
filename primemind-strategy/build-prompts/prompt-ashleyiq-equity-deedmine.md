# AshleyIQ — DeedMine AVM Equity Tracker Wire-Up
## Claude Code Build Prompt · Sprint 4-H

---

## WHY THIS EXISTS

AshleyIQ already has an equity tracker feature that estimates home value using math (purchase price + annual appreciation %). This is a placeholder. Real LOs need real AVM data to have credible conversations with past clients about refi opportunities or cash-out options.

DeedMine is a PrimeMind Labs platform product. It already calls ATTOM live data for distress scoring and AVM. Wiring AshleyIQ into DeedMine gives LOs live estimated home values, equity positions, and equity change alerts — replacing the math estimate with real data.

**Commercial note:** DeedMine→AshleyIQ is documented as a commercial API agreement (per-call pricing) even though both products are under PrimeMind Labs LLC. This keeps the revenue streams clean and protects valuation if either product is sold separately. Rate: $0.25/pull (internal transfer pricing). Billed via Stripe metered subscription on the AshleyIQ plan.

---

## WHAT DEEDMINE PROVIDES

Via the DeedMine API (internal PrimeMind product):
- **AVM** — Automated Valuation Model (powered by ATTOM data)
  - Estimated value
  - Value confidence score
  - 12-month appreciation estimate
  - 5-year appreciation estimate
- **Property Details** — beds, baths, sqft, year built, property type
- **Last Sale** — sale date, sale price
- **Tax Assessment** — assessed value, tax amount
- **Distress Score** — DeedMine's proprietary 0–100 score (used in CLOSA, also useful for LOs monitoring delinquency risk on existing clients)

---

## CURRENT STATE (from prior audit)

The existing equity tracker in AshleyIQ:
- Uses `purchase_price * (1 + annual_appreciation_rate)^years` formula
- No API calls
- No real property data
- Shows "estimated" with a disclaimer

This prompt replaces that math with DeedMine API calls.

---

## EXECUTION ORDER

1. DB migration (equity data columns)
2. DeedMine API client
3. Property lookup + equity calculation
4. Equity tracker UI update
5. Equity alert automation (pg_cron)
6. Refi opportunity surfacing

---

## STEP 1 — DATABASE MIGRATION

`supabase/migrations/011_equity_deedmine.sql`

```sql
-- Property valuations from DeedMine/ATTOM
CREATE TABLE IF NOT EXISTS property_valuations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id                UUID NOT NULL,
  property_address      TEXT NOT NULL,
  property_city         TEXT,
  property_state        CHAR(2),
  property_zip          TEXT,
  -- From DeedMine AVM
  avm_value             NUMERIC(12,2),
  avm_confidence        NUMERIC(5,3),  -- 0.0 to 1.0
  avm_value_low         NUMERIC(12,2),
  avm_value_high        NUMERIC(12,2),
  appreciation_12mo     NUMERIC(7,4),  -- percentage e.g. 0.0612 = 6.12%
  appreciation_5yr      NUMERIC(7,4),
  -- Property details
  beds                  INT,
  baths                 NUMERIC(4,1),
  sqft                  INT,
  year_built            INT,
  property_type         TEXT,
  -- Last sale
  last_sale_date        DATE,
  last_sale_price       NUMERIC(12,2),
  -- Tax
  assessed_value        NUMERIC(12,2),
  annual_tax            NUMERIC(10,2),
  -- DeedMine distress
  distress_score        INT,  -- 0-100
  distress_flags        TEXT[],
  -- Source metadata
  attom_id              TEXT,
  deedmine_pull_id      TEXT,
  pulled_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Computed equity
  current_loan_balance  NUMERIC(12,2),  -- manual or from LOS sync
  estimated_equity      NUMERIC(12,2)   -- avm_value - current_loan_balance
    GENERATED ALWAYS AS (avm_value - COALESCE(current_loan_balance, 0)) STORED
);

-- Equity alert config per lead
CREATE TABLE IF NOT EXISTS equity_alerts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id                UUID NOT NULL,
  alert_type            TEXT NOT NULL CHECK (alert_type IN ('equity_threshold','appreciation_rate','distress_change')),
  threshold_value       NUMERIC(12,2),  -- equity amount or appreciation % threshold
  direction             TEXT CHECK (direction IN ('above','below')),
  active                BOOLEAN DEFAULT true,
  last_triggered_at     TIMESTAMPTZ,
  created_by            UUID NOT NULL REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- Add property fields to leads if not present
ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_address TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_city TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_state CHAR(2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_zip TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS original_loan_amount NUMERIC(12,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS loan_origination_date DATE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS current_loan_balance NUMERIC(12,2);

-- RLS
ALTER TABLE property_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE equity_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_property_valuations" ON property_valuations
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));

CREATE POLICY "org_equity_alerts" ON equity_alerts
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_valuations_lead ON property_valuations(lead_id, pulled_at DESC);
```

---

## STEP 2 — DEEDMINE API CLIENT

`lib/deedmine/client.ts`

```typescript
const DEEDMINE_API_BASE = process.env.DEEDMINE_API_URL ?? 'https://api.deedmine.com/v1';

interface AVMResponse {
  pullId: string;
  attomId: string;
  address: {
    full: string;
    city: string;
    state: string;
    zip: string;
  };
  avm: {
    value: number;
    confidenceScore: number;
    valueLow: number;
    valueHigh: number;
    appreciation12Month: number;
    appreciation5Year: number;
  };
  property: {
    beds: number;
    baths: number;
    sqft: number;
    yearBuilt: number;
    propertyType: string;
  };
  lastSale: {
    date: string;
    price: number;
  };
  tax: {
    assessedValue: number;
    annualTax: number;
  };
  distress: {
    score: number;
    flags: string[];
  };
}

export async function pullAVM(params: {
  address: string;
  city: string;
  state: string;
  zip: string;
}): Promise<AVMResponse> {
  // TODO: Set DEEDMINE_API_KEY env var after DeedMine→AshleyIQ commercial agreement is documented
  const res = await fetch(`${DEEDMINE_API_BASE}/avm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEDMINE_API_KEY}`,
      'X-Source': 'ashleyiq',  // DeedMine tracks usage by source for billing
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeedMine AVM error ${res.status}: ${err}`);
  }

  return res.json() as Promise<AVMResponse>;
}
```

---

## STEP 3 — PROPERTY LOOKUP API

`app/api/leads/[id]/equity/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { pullAVM } from '@/lib/deedmine/client';

export const dynamic = 'force-dynamic';

// GET — fetch most recent valuation
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createClient();
  const { data } = await sb
    .from('property_valuations')
    .select('*')
    .eq('lead_id', params.id)
    .order('pulled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ valuation: data });
}

// POST — pull fresh AVM from DeedMine
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createClient();
  const { data: profile } = await sb.from('profiles').select('org_id').eq('clerk_user_id', userId).single();
  const { data: lead } = await sb
    .from('leads')
    .select('property_address, property_city, property_state, property_zip, current_loan_balance')
    .eq('id', params.id)
    .single();

  if (!lead?.property_address) {
    return NextResponse.json({ error: 'Property address required on lead before pulling AVM' }, { status: 400 });
  }

  let avmData: Awaited<ReturnType<typeof pullAVM>>;
  try {
    avmData = await pullAVM({
      address: lead.property_address,
      city: lead.property_city ?? '',
      state: lead.property_state ?? '',
      zip: lead.property_zip ?? '',
    });
  } catch (err) {
    return NextResponse.json({ error: `DeedMine pull failed: ${String(err)}` }, { status: 502 });
  }

  const { data: valuation } = await sb.from('property_valuations').insert({
    lead_id: params.id,
    org_id: profile!.org_id,
    property_address: lead.property_address,
    property_city: lead.property_city,
    property_state: lead.property_state,
    property_zip: lead.property_zip,
    avm_value: avmData.avm.value,
    avm_confidence: avmData.avm.confidenceScore,
    avm_value_low: avmData.avm.valueLow,
    avm_value_high: avmData.avm.valueHigh,
    appreciation_12mo: avmData.avm.appreciation12Month,
    appreciation_5yr: avmData.avm.appreciation5Year,
    beds: avmData.property.beds,
    baths: avmData.property.baths,
    sqft: avmData.property.sqft,
    year_built: avmData.property.yearBuilt,
    property_type: avmData.property.propertyType,
    last_sale_date: avmData.lastSale.date,
    last_sale_price: avmData.lastSale.price,
    assessed_value: avmData.tax.assessedValue,
    annual_tax: avmData.tax.annualTax,
    distress_score: avmData.distress.score,
    distress_flags: avmData.distress.flags,
    attom_id: avmData.attomId,
    deedmine_pull_id: avmData.pullId,
    current_loan_balance: lead.current_loan_balance,
  }).select().single();

  return NextResponse.json({ valuation });
}
```

---

## STEP 4 — EQUITY TRACKER UI UPDATE

Find the existing equity tracker component (likely in `app/(dashboard)/leads/[id]/` or similar) and replace the math-based value with live DeedMine data.

**Equity Card UI:**
```
PROPERTY EQUITY

123 Maple St, Atlanta GA 30309

Estimated Value:    $487,000     [±$31K confidence range]
Current Balance:    $312,000     [Last updated manually / LOS sync]
─────────────────────────────────
Estimated Equity:   $175,000     (35.9% LTV)

1-Year Appreciation:  +6.2%
5-Year Appreciation:  +31.4%

Last sale: Jun 2021 · $390,000
AVM pulled: Jun 6, 2026 · [Refresh]

Distress Score: 18/100 [LOW]

[📞 Reach Out — Refi Opportunity]
```

Color logic:
- LTV > 80% → yellow (low equity, watch)
- LTV > 95% → red (underwater risk)
- Equity > $100K → green (refi/cash-out opportunity)

The **[Refresh]** button POSTs to `/api/leads/[id]/equity` and costs $0.25 (logged to billing).

The **[Reach Out]** button opens a pre-drafted SMS/email using Claude Haiku:
```
"Hi [Borrower], this is [LO]. Based on current market values, your home at [address] 
has appreciated significantly — your equity may have grown to ~$175K. Would you like 
to explore your options? Reply or call me: [phone]"
```

---

## STEP 5 — EQUITY ALERT AUTOMATION

`supabase/functions/equity-alerts/index.ts`

Runs monthly (1st of each month). Re-pulls AVM for all active clients. Fires alerts when thresholds are crossed.

```typescript
Deno.serve(async () => {
  const sb = createClient(...);

  // Fetch all leads with property address and active equity alerts
  const { data: alertLeads } = await sb
    .from('equity_alerts')
    .select('*, leads!inner(id, property_address, property_city, property_state, property_zip, current_loan_balance, assigned_to, org_id)')
    .eq('active', true);

  for (const alert of alertLeads ?? []) {
    const lead = alert.leads;
    if (!lead.property_address) continue;

    // Pull fresh AVM
    try {
      const avm = await pullAVM({ address: lead.property_address, city: lead.property_city, state: lead.property_state, zip: lead.property_zip });
      const equity = avm.avm.value - (lead.current_loan_balance ?? 0);

      // Check threshold
      let triggered = false;
      if (alert.alert_type === 'equity_threshold') {
        triggered = alert.direction === 'above' ? equity > alert.threshold_value : equity < alert.threshold_value;
      } else if (alert.alert_type === 'appreciation_rate') {
        triggered = alert.direction === 'above' ? avm.avm.appreciation12Month > alert.threshold_value : avm.avm.appreciation12Month < alert.threshold_value;
      }

      if (triggered) {
        await sb.from('notifications').insert({
          org_id: lead.org_id, user_id: lead.assigned_to, type: 'equity_alert',
          title: `Equity alert: ${lead.property_address}`,
          body: `Client equity has reached $${equity.toLocaleString()} — potential refi opportunity.`,
          action_url: `/dashboard/leads/${lead.id}`,
          read: false,
        });
        await sb.from('equity_alerts').update({ last_triggered_at: new Date().toISOString() }).eq('id', alert.id);
      }

      // Save new valuation regardless of alert
      await sb.from('property_valuations').insert({
        lead_id: lead.id, org_id: lead.org_id,
        property_address: lead.property_address, property_city: lead.property_city,
        property_state: lead.property_state, property_zip: lead.property_zip,
        avm_value: avm.avm.value, avm_confidence: avm.avm.confidenceScore,
        appreciation_12mo: avm.avm.appreciation12Month,
        current_loan_balance: lead.current_loan_balance,
        distress_score: avm.distress.score,
      });
    } catch (_e) {
      // Log failed pull — continue to next
    }
  }

  return new Response(JSON.stringify({ processed: alertLeads?.length ?? 0 }));
});
```

```sql
SELECT cron.schedule('equity-alerts', '0 9 1 * *',
  $$SELECT net.http_post(url := ... || '/functions/v1/equity-alerts')$$);
```

---

## STEP 6 — EQUITY DASHBOARD (HOMEBOT-STYLE)

`app/(dashboard)/equity/page.tsx`

Table of all past clients with property data:

| Borrower | Address | AVM | Balance | Equity | LTV | 1yr Appr | Distress | Last Pull | Action |
|---|---|---|---|---|---|---|---|---|---|
| Ashley Smith | 123 Maple... | $487K | $312K | $175K | 64% | +6.2% | 18 | Jun 6 | [Reach Out] |

Filters:
- Equity > $100K (refi targets)
- LTV > 80% (watch list)
- Distress Score > 50 (at-risk)
- Not contacted in 90+ days

**"Refi Opportunity List"** — LO's version of Homebot: a one-click list of past clients with the most equity gain since origination, sorted by refi potential.

---

## ENV VARS

```bash
DEEDMINE_API_KEY=...         # TODO: generate after documenting commercial API agreement
DEEDMINE_API_URL=https://api.deedmine.com/v1
# Internal rate: $0.25/pull — log to billing table or Stripe meter
```

---

## COMMERCIAL API AGREEMENT NOTE (from owner guidance)

Document the DeedMine → AshleyIQ integration as a commercial API agreement internally:

`primemind-strategy/internal-agreements/deedmine-ashleyiq-api.md`

```
INTERNAL API AGREEMENT
Licensor: DeedMine (PrimeMind Labs LLC)
Licensee: AshleyIQ / Conduit Next (PrimeMind Labs LLC)
Rate: $0.25 per AVM pull
Billing: Monthly, via internal transfer or Stripe metered
Purpose: Property valuation and equity tracking for LO clients
Signed: [Date] by [Owner names]
Notes: This agreement preserves separate product valuations and clean IP chains
       for independent acquisition of either product.
```

---

## VERIFICATION CHECKLIST

- [ ] DeedMine pull returns real ATTOM data (not mock) when DEEDMINE_API_KEY is set
- [ ] Equity card shows AVM value, not math estimate
- [ ] Confidence range shown (low–high)
- [ ] Estimated equity = AVM value – current_loan_balance
- [ ] LTV color coding correct (green <80%, yellow 80–95%, red >95%)
- [ ] Refresh button pulls new valuation and updates card
- [ ] Lead without property address shows "Add property address to track equity"
- [ ] Refi outreach draft generated by Claude Haiku with correct personalization
- [ ] Monthly equity alert pg_cron fires on the 1st
- [ ] Alert triggers notification when threshold crossed
- [ ] Equity dashboard table sortable by equity amount
- [ ] "Refi Opportunity List" filter works correctly
- [ ] Internal API agreement file created at `primemind-strategy/internal-agreements/`
- [ ] All DeedMine pulls logged (for internal billing reconciliation)
