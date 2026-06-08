# AshleyIQ — 2-Way LOS Integration
## Claude Code Build Prompt · Sprint 4-F

---

## WHY THIS EXISTS

Every mortgage loan lives in a Loan Origination System (LOS). AshleyIQ is the CRM layer — it manages the borrower relationship, the pipeline, and the team. Without syncing to the LOS, LOs are doing double data entry. With a 2-way sync, AshleyIQ becomes the single source of truth for the relationship layer while the LOS stays the compliance/regulatory engine.

---

## LOS TARGETS

| LOS | Market Share | Integration Method | Priority |
|---|---|---|---|
| **Encompass (ICE Mortgage Technology)** | ~50% of market | Encompass Developer Connect REST API (OAuth 2.0) | P0 |
| **BytePro** | ~10% of market | BytePro REST API (API Key) | P1 |
| **Calyx Point** | ~8% of market | Calyx Connect REST API | P1 |

---

## WHAT SYNCS (2-WAY)

| Field | AshleyIQ → LOS | LOS → AshleyIQ |
|---|---|---|
| Lead / Borrower contact info | Create loan application | Update on change |
| Loan stage / status | Push status updates | Pull status on webhook |
| Loan amount, type, purpose | On POS submit | Pull on change |
| Property address | On POS submit | Pull on change |
| Assigned LO | Create/update | Pull on change |
| Milestone dates | Push | Pull (key milestones: app complete, UW, clear to close, close) |
| Conditions | Push new conditions | Pull condition updates |

**Conflict resolution rule:** LOS always wins for loan data (amount, rate, terms). AshleyIQ always wins for CRM data (notes, tasks, custom fields). If both modify the same field within 60 seconds, log a conflict for manual resolution.

---

## EXECUTION ORDER

1. DB migration
2. Integration config + credential vault
3. Encompass connector (P0)
4. BytePro connector (P1)
5. Calyx connector (P1)
6. Webhook receiver
7. Sync engine + conflict resolution
8. Integration settings UI

---

## STEP 1 — DATABASE MIGRATION

`supabase/migrations/009_los_integration.sql`

```sql
-- LOS integration credentials per org
CREATE TABLE IF NOT EXISTS los_integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  los_type        TEXT NOT NULL CHECK (los_type IN ('encompass','bytepro','calyx','none')),
  active          BOOLEAN NOT NULL DEFAULT true,
  -- Encompass
  encompass_client_id     TEXT,
  encompass_client_secret TEXT,  -- encrypted at rest via Vault
  encompass_instance_id   TEXT,
  encompass_access_token  TEXT,
  encompass_token_expires_at TIMESTAMPTZ,
  encompass_refresh_token TEXT,
  -- BytePro
  bytepro_api_key TEXT,
  bytepro_base_url TEXT,
  -- Calyx
  calyx_api_key   TEXT,
  calyx_instance_url TEXT,
  -- Sync config
  sync_enabled    BOOLEAN DEFAULT true,
  sync_direction  TEXT DEFAULT 'bidirectional' CHECK (sync_direction IN ('bidirectional','los_to_crm','crm_to_los')),
  last_sync_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Per-loan LOS sync record
CREATE TABLE IF NOT EXISTS los_loan_sync (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE UNIQUE,
  org_id          UUID NOT NULL,
  los_type        TEXT NOT NULL,
  los_loan_id     TEXT NOT NULL,  -- Encompass loan GUID, BytePro loan number, etc.
  los_loan_number TEXT,           -- human-readable loan number
  sync_status     TEXT NOT NULL DEFAULT 'active'
    CHECK (sync_status IN ('active','paused','error','unlinked')),
  last_push_at    TIMESTAMPTZ,
  last_pull_at    TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Sync event log (append-only)
CREATE TABLE IF NOT EXISTS los_sync_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id),
  org_id          UUID NOT NULL,
  los_type        TEXT NOT NULL,
  los_loan_id     TEXT,
  direction       TEXT NOT NULL CHECK (direction IN ('push','pull','webhook')),
  event_type      TEXT NOT NULL,
  -- loan_created / status_updated / field_updated / condition_synced / conflict_detected / error
  fields_changed  TEXT[],
  payload         JSONB,
  success         BOOLEAN NOT NULL,
  error_message   TEXT,
  occurred_at     TIMESTAMPTZ DEFAULT now()
);

-- Conflict log (requires manual resolution)
CREATE TABLE IF NOT EXISTS los_conflicts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id),
  org_id          UUID NOT NULL,
  los_type        TEXT NOT NULL,
  field_name      TEXT NOT NULL,
  ashleyiq_value  TEXT,
  los_value       TEXT,
  resolution      TEXT CHECK (resolution IN ('use_los','use_crm','manual')),
  resolved_by     UUID REFERENCES profiles(id),
  resolved_at     TIMESTAMPTZ,
  detected_at     TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE los_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE los_loan_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE los_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE los_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_los_integration" ON los_integrations
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid())
    AND (SELECT role FROM profiles WHERE clerk_user_id = auth.uid()) IN ('admin','branch_manager'));

CREATE POLICY "org_los_sync" ON los_loan_sync
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));

-- Events: append-only
CREATE POLICY "insert_sync_events" ON los_sync_events FOR INSERT WITH CHECK (true);
CREATE POLICY "read_org_sync_events" ON los_sync_events FOR SELECT
  USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));

CREATE POLICY "org_los_conflicts" ON los_conflicts
  FOR ALL USING (org_id = (SELECT org_id FROM profiles WHERE clerk_user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_los_sync_lead ON los_loan_sync(lead_id);
CREATE INDEX IF NOT EXISTS idx_los_events_lead ON los_sync_events(lead_id);
```

---

## STEP 2 — ENCOMPASS CONNECTOR (P0)

`lib/los/encompass.ts`

```typescript
const ENCOMPASS_API_BASE = 'https://api.elliemae.com/encompass/v3';

export async function getEncompassToken(integration: {
  encompass_client_id: string;
  encompass_client_secret: string;
  encompass_instance_id: string;
}): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch('https://api.elliemae.com/oauth2/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: integration.encompass_client_id,
      client_secret: integration.encompass_client_secret,
      scope: 'lp',
      instance_id: integration.encompass_instance_id,
    }),
  });
  if (!res.ok) throw new Error(`Encompass token error: ${res.status}`);
  return res.json();
}

export async function getEncompassLoan(loanId: string, token: string) {
  const res = await fetch(`${ENCOMPASS_API_BASE}/loans/${loanId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Encompass loan fetch error: ${res.status}`);
  return res.json();
}

export async function createEncompassLoan(payload: Record<string, unknown>, token: string): Promise<{ id: string }> {
  const res = await fetch(`${ENCOMPASS_API_BASE}/loans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Encompass loan create error: ${res.status}`);
  return res.json();
}

export async function updateEncompassLoan(loanId: string, patch: Record<string, unknown>, token: string) {
  const res = await fetch(`${ENCOMPASS_API_BASE}/loans/${loanId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Encompass update error: ${res.status}`);
  return res.status === 204 ? null : res.json();
}

// Map AshleyIQ lead fields → Encompass loan fields
export function mapLeadToEncompass(lead: Record<string, unknown>): Record<string, unknown> {
  return {
    'Fields.4000': lead.first_name,  // Borrower First Name
    'Fields.4002': lead.last_name,   // Borrower Last Name
    'Fields.4006': lead.email,       // Borrower Email
    'Fields.4008': lead.phone,       // Borrower Phone
    'Fields.1172': lead.loan_amount,
    'Fields.19': lead.loan_purpose,
    'Fields.12': lead.property_address,
    'Fields.13': lead.property_city,
    'Fields.14': lead.property_state,
    'Fields.15': lead.property_zip,
    // Add all required URLA field IDs here
    // Full Encompass field map: https://developer.elliemae.com/field-definitions
  };
}

// Map Encompass loan → AshleyIQ lead fields
export function mapEncompassToLead(loan: Record<string, unknown>): Record<string, unknown> {
  const fields = loan.fields as Record<string, unknown>;
  return {
    first_name: fields?.['4000'],
    last_name: fields?.['4002'],
    email: fields?.['4006'],
    phone: fields?.['4008'],
    loan_amount: fields?.['1172'],
    stage: mapEncompassStatus(fields?.['Log.MS.CurrentMilestone'] as string),
  };
}

function mapEncompassStatus(milestoneName: string): string {
  const map: Record<string, string> = {
    'Application': 'application_submitted',
    'Processing': 'processing',
    'Submitted to UW': 'submitted_to_uw',
    'Approved': 'approved',
    'Clear to Close': 'clear_to_close',
    'Closed Loan': 'closed',
    'Denied': 'denied',
  };
  return map[milestoneName] ?? 'in_progress';
}
```

---

## STEP 3 — BYTEPRO CONNECTOR (P1)

`lib/los/bytepro.ts`

```typescript
// BytePro REST API — API Key auth
// Base URL configured per instance: e.g. https://[firm].bytepro.com/api/v1

export async function getByteProLoan(loanId: string, config: { api_key: string; base_url: string }) {
  const res = await fetch(`${config.base_url}/loans/${loanId}`, {
    headers: { 'X-API-Key': config.api_key },
  });
  if (!res.ok) throw new Error(`BytePro loan error: ${res.status}`);
  return res.json();
}

// BytePro field mapping differs from Encompass — uses JSON property names directly
export function mapLeadToBytePro(lead: Record<string, unknown>): Record<string, unknown> {
  return {
    borrower: {
      firstName: lead.first_name,
      lastName: lead.last_name,
      email: lead.email,
      homePhone: lead.phone,
    },
    loanAmount: lead.loan_amount,
    loanPurpose: lead.loan_purpose,
    property: {
      streetAddress: lead.property_address,
      city: lead.property_city,
      state: lead.property_state,
      zipCode: lead.property_zip,
    },
  };
}
```

---

## STEP 4 — WEBHOOK RECEIVER

`app/api/webhooks/los/encompass/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { mapEncompassToLead } from '@/lib/los/encompass';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Encompass webhook events: https://developer.elliemae.com/webhooks
  // Header: X-Elli-Signature — HMAC-SHA256 of body with webhook secret
  const signature = req.headers.get('x-elli-signature');
  const body = await req.text();

  // Verify signature
  const hmac = await verifyEncompassWebhookSignature(body, signature, process.env.ENCOMPASS_WEBHOOK_SECRET!);
  if (!hmac) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  const event = JSON.parse(body) as {
    eventId: string;
    eventType: string;  // loan.created / loan.updated / milestone.updated
    entityId: string;   // loan GUID
    eventTime: string;
  };

  const sb = createAdminClient();

  // Find which AshleyIQ lead this maps to
  const { data: sync } = await sb.from('los_loan_sync')
    .select('lead_id, org_id')
    .eq('los_loan_id', event.entityId)
    .maybeSingle();

  if (!sync) {
    // Unknown loan — log and ignore
    await sb.from('los_sync_events').insert({
      lead_id: '00000000-0000-0000-0000-000000000000',
      org_id: '00000000-0000-0000-0000-000000000000',
      los_type: 'encompass', los_loan_id: event.entityId,
      direction: 'webhook', event_type: 'unknown_loan',
      fields_changed: [], success: false,
      error_message: 'No matching lead found for Encompass loan',
    });
    return NextResponse.json({ received: true });
  }

  if (event.eventType === 'loan.updated' || event.eventType === 'milestone.updated') {
    // Fetch full loan from Encompass
    const { data: integration } = await sb.from('los_integrations')
      .select('*').eq('org_id', sync.org_id).single();

    // TODO: refresh token if expired
    const loan = await fetch(`https://api.elliemae.com/encompass/v3/loans/${event.entityId}`, {
      headers: { Authorization: `Bearer ${integration!.encompass_access_token}` },
    }).then(r => r.json());

    const mapped = mapEncompassToLead(loan);
    await sb.from('leads').update(mapped).eq('id', sync.lead_id);

    await sb.from('los_sync_events').insert({
      lead_id: sync.lead_id, org_id: sync.org_id,
      los_type: 'encompass', los_loan_id: event.entityId,
      direction: 'webhook', event_type: 'status_updated',
      fields_changed: Object.keys(mapped), success: true,
    });
  }

  return NextResponse.json({ received: true });
}

async function verifyEncompassWebhookSignature(body: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expectedHex = Array.from(new Uint8Array(expected)).map(b => b.toString(16).padStart(2, '0')).join('');
  return signature === expectedHex;
}
```

`app/api/webhooks/los/bytepro/route.ts` — same pattern, different payload shape and auth.

---

## STEP 5 — SYNC ENGINE

`app/api/los/sync/route.ts`

Push a lead to LOS (called after POS submission, stage change, etc.):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { createEncompassLoan, mapLeadToEncompass, getEncompassToken } from '@/lib/los/encompass';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { leadId } = await req.json() as { leadId: string };
  const sb = createClient();

  const [{ data: lead }, { data: profile }] = await Promise.all([
    sb.from('leads').select('*').eq('id', leadId).single(),
    sb.from('profiles').select('org_id').eq('clerk_user_id', userId).single(),
  ]);

  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const { data: integration } = await sb.from('los_integrations')
    .select('*').eq('org_id', profile!.org_id).single();

  if (!integration || !integration.active || !integration.sync_enabled) {
    return NextResponse.json({ skipped: true, reason: 'No LOS configured' });
  }

  // Check if already synced
  const { data: existingSync } = await sb.from('los_loan_sync')
    .select('los_loan_id').eq('lead_id', leadId).maybeSingle();

  let losLoanId: string;

  if (integration.los_type === 'encompass') {
    // Refresh token if needed
    let token = integration.encompass_access_token!;
    if (new Date(integration.encompass_token_expires_at!) < new Date()) {
      const refreshed = await getEncompassToken(integration);
      token = refreshed.access_token;
      await sb.from('los_integrations').update({
        encompass_access_token: token,
        encompass_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      }).eq('id', integration.id);
    }

    if (existingSync) {
      // Update existing Encompass loan
      await import('@/lib/los/encompass').then(m =>
        m.updateEncompassLoan(existingSync.los_loan_id, mapLeadToEncompass(lead), token)
      );
      losLoanId = existingSync.los_loan_id;
    } else {
      // Create new Encompass loan
      const created = await createEncompassLoan(mapLeadToEncompass(lead), token);
      losLoanId = created.id;
      await sb.from('los_loan_sync').insert({
        lead_id: leadId, org_id: profile!.org_id,
        los_type: 'encompass', los_loan_id: losLoanId,
      });
    }
  } else if (integration.los_type === 'bytepro') {
    // TODO: BytePro push
    return NextResponse.json({ skipped: true, reason: 'BytePro push — implement in Phase 2' });
  }

  await sb.from('los_sync_events').insert({
    lead_id: leadId, org_id: profile!.org_id,
    los_type: integration.los_type, los_loan_id: losLoanId!,
    direction: 'push', event_type: existingSync ? 'loan_updated' : 'loan_created',
    fields_changed: Object.keys(mapLeadToEncompass(lead)), success: true,
  });

  return NextResponse.json({ synced: true, losLoanId: losLoanId! });
}
```

---

## STEP 6 — INTEGRATION SETTINGS UI

`app/(dashboard)/settings/los-integration/page.tsx`

Admin/branch manager only.

**Section 1: Connect LOS**
- Dropdown: Encompass / BytePro / Calyx / None
- Encompass fields: Client ID, Client Secret, Instance ID → "Connect" button → OAuth test
- BytePro fields: API Key, Base URL → "Test Connection" button
- Connection status: ✅ Connected (Instance: xxx) / ❌ Not Connected

**Section 2: Sync Config**
- Toggle: Enable Sync
- Direction: Bidirectional / LOS → CRM only / CRM → LOS only
- Auto-push on POS submit: yes/no
- Auto-push on stage change: yes/no

**Section 3: Field Mapping Preview**
- Table showing which AshleyIQ fields map to which LOS fields
- Read-only in Phase 1; custom mapping in Phase 2

**Section 4: Conflict History**
- Table of unresolved conflicts with [Use LOS] / [Use AshleyIQ] buttons
- Resolved conflicts (gray)

**Section 5: Sync History**
- Recent 50 sync events: timestamp, direction, event type, success/error

---

## WEBHOOK SETUP (per LOS)

### Encompass
1. Admin registers webhook in Encompass Developer Connect console
2. Webhook URL: `https://ashleyiq.app/api/webhooks/los/encompass`
3. Events to subscribe: `loan.created`, `loan.updated`, `milestone.updated`
4. Set `ENCOMPASS_WEBHOOK_SECRET` env var

### BytePro
1. Admin configures webhook in BytePro admin panel
2. Webhook URL: `https://ashleyiq.app/api/webhooks/los/bytepro`
3. Set `BYTEPRO_WEBHOOK_SECRET` env var

---

## ENV VARS

```bash
# Encompass (per org — stored encrypted in los_integrations table)
ENCOMPASS_WEBHOOK_SECRET=...  # global — used for signature verification
ENCOMPASS_REDIRECT_URI=https://ashleyiq.app/api/los/encompass/callback

# BytePro
BYTEPRO_WEBHOOK_SECRET=...
```

---

## VERIFICATION CHECKLIST

- [ ] Encompass OAuth flow completes, tokens stored in `los_integrations`
- [ ] POS submit → Encompass loan created with correct field mapping
- [ ] Encompass milestone update webhook → AshleyIQ stage updated
- [ ] BytePro connection test succeeds with valid API key
- [ ] Conflict detected when both systems change same field within 60 seconds
- [ ] Conflict table shows in UI with resolve buttons
- [ ] Syncing paused when `sync_enabled = false`
- [ ] Sync events logged for every push/pull/webhook
- [ ] Integration settings page requires admin/branch_manager role
- [ ] Invalid webhook signature returns 401 (no processing)
- [ ] Token refresh logic fires when `encompass_token_expires_at` is in the past
