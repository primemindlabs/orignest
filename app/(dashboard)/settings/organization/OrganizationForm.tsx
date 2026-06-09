'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Check, X } from 'lucide-react';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

interface Props {
  initial: {
    name: string;
    nmls_company_id: string;
    billing_email: string;
    licensed_states: string[];
  };
  canEdit: boolean;
}

export function OrganizationForm({ initial, canEdit }: Props) {
  const [name, setName] = useState(initial.name);
  const [nmls, setNmls] = useState(initial.nmls_company_id);
  const [billingEmail, setBillingEmail] = useState(initial.billing_email);
  const [states, setStates] = useState<string[]>(initial.licensed_states);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  function toggleState(s: string) {
    setStates((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/settings/organization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          nmls_company_id: nmls,
          billing_email: billingEmail,
          licensed_states: states,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus({ ok: false, msg: json.error ?? 'Could not save.' });
      } else {
        setStatus({ ok: true, msg: 'Saved.' });
      }
    } catch {
      setStatus({ ok: false, msg: 'Network error.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <fieldset disabled={!canEdit} className="space-y-5">
        <div className="bg-surface rounded-card shadow-card border border-border p-5 space-y-4">
          <Input label="Company name" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="NMLS company ID"
              value={nmls}
              onChange={(e) => setNmls(e.target.value)}
              placeholder="e.g. 1234567"
            />
            <Input
              label="Billing email"
              type="email"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-surface rounded-card shadow-card border border-border p-5">
          <h3 className="text-sm font-semibold text-black">Licensed states</h3>
          <p className="text-xs text-label-2 mt-0.5 mb-3">
            {states.length} selected · used for compliance routing and disclosures.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {US_STATES.map((s) => {
              const on = states.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleState(s)}
                  className={`text-[12px] font-medium rounded-full px-2.5 py-1 transition-colors ${
                    on
                      ? 'bg-gold-600 text-white'
                      : 'bg-fill text-label-2 hover:bg-[rgba(0,0,0,0.08)]'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>

      {!canEdit && (
        <p className="text-[12px] text-label-2">
          Only organization admins can edit these settings.
        </p>
      )}

      {canEdit && (
        <div className="flex items-center gap-3 justify-end">
          {status && (
            <span
              className={`inline-flex items-center gap-1.5 text-[13px] ${
                status.ok ? 'text-green' : 'text-red'
              }`}
            >
              {status.ok ? <Check size={14} /> : <X size={14} />}
              {status.msg}
            </span>
          )}
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </div>
      )}
    </form>
  );
}
