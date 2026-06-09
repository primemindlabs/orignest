'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Waves, AlertTriangle, CheckCircle } from 'lucide-react';

interface Flood {
  zone: string | null;
  panel: string | null;
  source: string | null;
  required: boolean | null;
  determined_at: string | null;
}

export function FloodZonePanel({ loanId, initial, hasAddress }: { loanId: string; initial: Flood; hasAddress: boolean }) {
  const [flood, setFlood] = useState<Flood>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function determine() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/loans/${loanId}/flood`, { method: 'POST' });
      const json = await res.json();
      if (json.flood) {
        setFlood({ zone: json.flood.zone, panel: json.flood.panel_number, source: json.flood.source, required: json.flood.required, determined_at: json.flood.determined_at });
      } else {
        setMsg(json.error ?? 'Could not determine flood zone.');
      }
    } catch { setMsg('Network error.'); } finally { setBusy(false); }
  }

  const required = flood.required;
  return (
    <div className="space-y-4">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
        {flood.zone ? (
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: required ? 'var(--c-danger)' : 'var(--c-success)' }}>
              {required ? <AlertTriangle size={22} className="text-white" /> : <CheckCircle size={22} className="text-white" />}
            </div>
            <div>
              <p className="text-[18px] font-bold text-[var(--c-text)]">Zone {flood.zone}</p>
              <p className="text-[13px] mt-0.5" style={{ color: required ? 'var(--c-danger)' : 'var(--c-success)' }}>
                {required ? 'Flood insurance REQUIRED (Special Flood Hazard Area)' : 'Flood insurance not required'}
              </p>
              <p className="text-[12px] text-[var(--c-label3)] mt-1.5">
                Source: {flood.source?.toUpperCase()}{flood.panel ? ` · Panel ${flood.panel}` : ''}
                {flood.determined_at ? ` · ${new Date(flood.determined_at).toLocaleDateString()}` : ''}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-[var(--c-label2)]">
            <Waves size={20} /> <span className="text-[14px]">No flood determination yet.</span>
          </div>
        )}
      </div>

      {msg && <p className="text-[13px] text-[var(--c-warning)]">{msg}</p>}

      <div className="flex items-center gap-2">
        <Button onClick={determine} loading={busy} disabled={!hasAddress}>{flood.zone ? 'Re-determine' : 'Determine flood zone'}</Button>
        {!hasAddress && <span className="text-[12px] text-[var(--c-label3)]">Add a property address first.</span>}
      </div>
      <p className="text-[11px] text-[var(--c-label3)]">Uses ATTOM (if connected) then the free FEMA National Flood Hazard Layer. Zones A* and V* are Special Flood Hazard Areas.</p>
    </div>
  );
}
