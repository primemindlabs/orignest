'use client';

// Import review queue. Loans imported from a CSV (or pushed by an LOS like Arive)
// land here for the LO to review and promote into the pipeline — nothing hits the
// real pipeline until the LO opts in.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { IconInbox, IconUpload, IconCheck, IconX, IconLoader2, IconRefresh } from '@tabler/icons-react';

export interface StagedRow {
  id: string;
  source: string;
  borrower_first_name: string | null;
  borrower_last_name: string | null;
  borrower_email: string | null;
  borrower_phone: string | null;
  loan_amount: number | null;
  loan_type: string | null;
  loan_purpose: string | null;
  property_address: string | null;
  created_at: string;
}

const usd = (n: number | null) => (n != null ? `$${Number(n).toLocaleString()}` : '—');

// Minimal CSV parser that respects quoted fields/commas.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '', row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = ''; }
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => c.trim())).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
}

export function InboundClient({ initial }: { initial: StagedRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function syncArive() {
    setSyncing(true);
    try {
      const res = await fetch('/api/import/arive', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? 'Arive sync failed'); return; }
      toast.success(d.staged > 0 ? `${d.staged} new loan${d.staged === 1 ? '' : 's'} from Arive added to review` : 'Arive synced — no new loans');
      router.refresh();
    } catch { toast.error('Arive sync failed'); }
    finally { setSyncing(false); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) { toast.error('Couldn’t read any rows from that CSV.'); return; }
      const res = await fetch('/api/import/csv', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: parsed }) });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? 'Import failed'); return; }
      toast.success(`${d.staged} loan${d.staged === 1 ? '' : 's'} added to review`);
      router.refresh();
    } catch { toast.error('Import failed'); }
    finally { setUploading(false); }
  }

  async function act(id: string, action: 'promote' | 'dismiss') {
    setBusyId(id);
    try {
      const res = await fetch(`/api/import/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? 'Failed'); return; }
      setRows((p) => p.filter((r) => r.id !== id));
      toast.success(action === 'promote' ? 'Added to pipeline' : 'Dismissed');
    } catch { toast.error('Failed'); }
    finally { setBusyId(null); }
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <IconInbox size={20} className="text-[#C9A95C]" />
            <h1 className="text-[22px] font-bold text-black tracking-tight">Inbound</h1>
          </div>
          <p className="text-label-2 text-sm mt-0.5">Imported loans land here for review — promote the ones you want into your pipeline.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={syncArive} disabled={syncing} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-sm font-medium border border-border text-label hover:bg-fill disabled:opacity-50">
            {syncing ? <IconLoader2 size={14} className="animate-spin" /> : <IconRefresh size={14} />}
            {syncing ? 'Syncing…' : 'Sync from Arive'}
          </button>
          <label className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-sm font-medium bg-blue text-white hover:bg-blue/90 cursor-pointer shadow-sm">
            {uploading ? <IconLoader2 size={14} className="animate-spin" /> : <IconUpload size={14} />}
            {uploading ? 'Importing…' : 'Import CSV'}
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-border rounded-card p-12 text-center">
          <IconInbox size={28} className="text-label-3 mx-auto mb-3" />
          <p className="text-sm font-medium text-black mb-1">Nothing to review</p>
          <p className="text-sm text-label-2 max-w-md mx-auto">Import a CSV of loans, or connect an LOS — imported loans appear here for you to review before they hit your pipeline.</p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-card overflow-hidden divide-y divide-border">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-black truncate">
                  {[r.borrower_first_name, r.borrower_last_name].filter(Boolean).join(' ') || r.borrower_email || 'Unnamed'}
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-label-3 bg-fill px-1.5 py-0.5 rounded">{r.source}</span>
                </p>
                <p className="text-[12px] text-label-2 truncate">
                  {usd(r.loan_amount)}{r.loan_type ? ` · ${r.loan_type}` : ''}{r.borrower_email ? ` · ${r.borrower_email}` : ''}{r.property_address ? ` · ${r.property_address}` : ''}
                </p>
              </div>
              <button onClick={() => act(r.id, 'promote')} disabled={busyId === r.id} className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#C9A95C] hover:brightness-95 px-3 py-1.5 rounded-lg disabled:opacity-50">
                <IconCheck size={13} /> Add to pipeline
              </button>
              <button onClick={() => act(r.id, 'dismiss')} disabled={busyId === r.id} className="inline-flex items-center gap-1 text-xs text-label-2 hover:text-red px-2 py-1.5 disabled:opacity-50">
                <IconX size={13} /> Dismiss
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
