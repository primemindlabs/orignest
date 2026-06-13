'use client';

// CSV pipeline-import wizard: upload → auto-map columns → preview → import.
// Lightweight CSV parser (handles quoted fields/commas/newlines) — no dependency.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconUpload, IconCircleCheck } from '@tabler/icons-react';

const FIELDS = [
  { key: 'first_name', label: 'First name', required: true },
  { key: 'last_name', label: 'Last name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'loan_type', label: 'Loan type', required: false },
  { key: 'loan_amount', label: 'Loan amount', required: false },
  { key: 'property_address', label: 'Property address', required: false },
  { key: 'stage', label: 'Stage', required: false },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some((x) => x.trim() !== '')) rows.push(row); }
  return rows;
}

function autoMap(header: string): FieldKey | '' {
  const h = header.toLowerCase().replace(/[^a-z]/g, '');
  if (/(^|_)first|fname|firstname/.test(h)) return 'first_name';
  if (/(^|_)last|lname|lastname|surname/.test(h)) return 'last_name';
  if (h.includes('email') || h.includes('mail')) return 'email';
  if (h.includes('phone') || h.includes('mobile') || h.includes('cell')) return 'phone';
  if (h.includes('loanamount') || h.includes('amount') || h.includes('loansize')) return 'loan_amount';
  if (h.includes('loantype') || h.includes('producttype') || h.includes('program')) return 'loan_type';
  if (h.includes('address') || h.includes('property') || h.includes('street')) return 'property_address';
  if (h.includes('stage') || h.includes('status')) return 'stage';
  if (h === 'name' || h === 'fullname') return 'first_name';
  return '';
}

export function ImportWizard() {
  const router = useRouter();
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, FieldKey | ''>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number; errors: string[]; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function onFile(file: File) {
    setErr(null); setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCSV(String(reader.result ?? ''));
      if (parsed.length < 2) { setErr('That file has no data rows.'); return; }
      const [hdr, ...rest] = parsed;
      setHeaders(hdr);
      setDataRows(rest);
      const m: Record<number, FieldKey | ''> = {};
      hdr.forEach((h, i) => { m[i] = autoMap(h); });
      setMapping(m);
    };
    reader.readAsText(file);
  }

  const mappedFields = new Set(Object.values(mapping));
  const missingRequired = FIELDS.filter((f) => f.required && !mappedFields.has(f.key));

  function buildRows() {
    const colFor = (key: FieldKey) => Object.entries(mapping).find(([, v]) => v === key)?.[0];
    const idx: Partial<Record<FieldKey, number>> = {};
    FIELDS.forEach((f) => { const c = colFor(f.key); if (c != null) idx[f.key] = Number(c); });
    return dataRows.map((r) => {
      const o: Record<string, string> = {};
      (Object.keys(idx) as FieldKey[]).forEach((k) => { o[k] = (r[idx[k]!] ?? '').trim(); });
      return o;
    });
  }

  async function doImport() {
    setBusy(true); setErr(null);
    const rows = buildRows();
    const res = await fetch('/api/leads/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (res.ok) setResult(j);
    else setErr(j.error ?? 'Import failed.');
  }

  if (result) {
    return (
      <div className="bg-[var(--c-surface)] rounded-card border border-[var(--c-border)] p-8 text-center">
        <IconCircleCheck size={40} className="text-[#3FB68B] mx-auto mb-3" />
        <p className="text-[16px] font-semibold text-[var(--c-text)]">Imported {result.inserted} {result.inserted === 1 ? 'contact' : 'contacts'}</p>
        <p className="text-[13px] text-[var(--c-label2)] mt-1">{result.skipped > 0 ? `${result.skipped} already in your pipeline were skipped. ` : ''}{result.errors.length > 0 ? `${result.errors.length} rows had issues.` : ''}</p>
        {result.errors.length > 0 && <ul className="text-[11px] text-amber-600 mt-2 text-left max-w-sm mx-auto">{result.errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>}
        <div className="flex justify-center gap-2 mt-5">
          <button onClick={() => router.push('/pipeline')} className="rounded-xl bg-[#C9A95C] text-white px-4 py-2 text-[13px] font-medium hover:brightness-95">View pipeline</button>
          <button onClick={() => { setResult(null); setHeaders([]); setDataRows([]); }} className="rounded-xl border border-[var(--c-border)] px-4 py-2 text-[13px] text-[var(--c-text)]">Import another file</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {headers.length === 0 ? (
        <label className="block bg-[var(--c-surface)] rounded-card border-2 border-dashed border-[var(--c-border)] p-10 text-center cursor-pointer hover:border-[#C9A95C] transition-colors">
          <IconUpload size={28} className="text-[var(--c-gold-deep)] mx-auto mb-2" />
          <p className="text-[14px] font-medium text-[var(--c-text)]">Choose a CSV file</p>
          <p className="text-[12px] text-[var(--c-label2)] mt-1">Export from your old CRM, spreadsheet, or LOS. We&rsquo;ll match the columns automatically.</p>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      ) : (
        <>
          <div className="bg-[var(--c-surface)] rounded-card border border-[var(--c-border)] p-5">
            <p className="text-[13px] font-semibold text-[var(--c-text)] mb-3">Match your columns <span className="font-normal text-[var(--c-label2)]">({dataRows.length} rows)</span></p>
            <div className="space-y-2">
              {headers.map((h, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[12px] text-[var(--c-label2)] w-1/2 truncate" title={h}>{h || `Column ${i + 1}`}</span>
                  <select value={mapping[i] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [i]: e.target.value as FieldKey | '' }))} className="flex-1 rounded-[10px] border border-[var(--c-border)] px-2.5 py-1.5 text-[12px] bg-[var(--c-surface)]">
                    <option value="">— Ignore —</option>
                    {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {missingRequired.length > 0 && <p className="text-[12px] text-amber-600 mt-3">Map a column to: {missingRequired.map((f) => f.label).join(', ')}.</p>}
          </div>

          {err && <p className="text-[12px] text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button onClick={doImport} disabled={busy || missingRequired.length > 0} className="rounded-xl bg-[#C9A95C] text-white px-5 py-2.5 text-[13px] font-semibold hover:brightness-95 disabled:opacity-50">{busy ? 'Importing…' : `Import ${dataRows.length} contacts`}</button>
            <button onClick={() => { setHeaders([]); setDataRows([]); }} className="rounded-xl border border-[var(--c-border)] px-4 py-2.5 text-[13px] text-[var(--c-text)]">Start over</button>
          </div>
        </>
      )}
    </div>
  );
}
