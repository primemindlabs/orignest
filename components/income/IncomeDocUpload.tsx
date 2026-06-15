'use client';

/**
 * Phase 138 — drop an income doc (paystub / W-2 / 1099 / bank statement / tax
 * return) and let AI read the figures into the calculator. Reusable across every
 * income-calculator surface. Calls /api/income/extract (Claude, no Textract).
 */
import { useRef, useState } from 'react';
import { UploadCloud, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import type { IncomeExtraction, IncomeDocType } from '@/lib/income/extractFromDoc';

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function IncomeDocUpload({ onExtracted, hintType }: { onExtracted: (ex: IncomeExtraction) => void; hintType?: IncomeDocType }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<IncomeExtraction | null>(null);

  async function handleFile(file: File) {
    setBusy(true); setError(null); setLast(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/income/extract${hintType ? `?type=${hintType}` : ''}`, { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Could not read the document.');
      setLast(j as IncomeExtraction);
      onExtracted(j as IncomeExtraction);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the document.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gold-300 bg-gold-50/60 text-[13px] font-medium text-gold-800 hover:bg-gold-50 transition-colors disabled:opacity-60"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
        {busy ? 'Reading document…' : 'Upload a doc — AI fills the numbers'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
      <p className="text-[11px] text-label-3 mt-1.5 flex items-center gap-1"><Sparkles size={11} className="text-gold-600" /> Paystub, W-2, 1099, bank statement, or tax return (PDF/image).</p>

      {error && <p className="text-[12px] text-red mt-2">{error}</p>}
      {last && (
        <div className="mt-2 rounded-lg border border-green/20 bg-green/[0.06] px-3 py-2">
          <p className="text-[12px] font-medium text-label flex items-center gap-1.5"><CheckCircle2 size={13} className="text-green" /> Read as <span className="capitalize">{last.doc_type.replace(/_/g, ' ')}</span>{last.monthly_income_estimate != null && <> · est. {usd(last.monthly_income_estimate)}/mo</>}</p>
          {last.notes && <p className="text-[11px] text-label-2 mt-0.5">{last.notes}</p>}
        </div>
      )}
    </div>
  );
}
