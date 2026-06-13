'use client';

// Turns the borrower portal into a one-tap sales asset: QR + copy + text-to-borrower +
// preview, with a reminder that it's co-branded to the LO. Reuses /api/portal/send-link.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { IconCopy, IconCheck, IconExternalLink, IconMessage, IconQrcode } from '@tabler/icons-react';

export function SharePortalCard({ url, leadId, borrowerName, loName, borrowerHasPhone }: {
  url: string;
  leadId: string;
  borrowerName: string;
  loName: string;
  borrowerHasPhone: boolean;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: '#1A1816', light: '#FFFFFF' } }).then(setQr).catch(() => {});
  }, [url]);

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  }
  async function textBorrower() {
    setSending(true); setSendResult(null);
    try {
      const res = await fetch('/api/portal/send-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) setSendResult(d.delivery === 'sent' ? `Texted to ${borrowerName}.` : 'Recorded — SMS sending isn’t live yet (copy the link to share).');
      else setSendResult(d.error ?? 'Could not send.');
    } catch { setSendResult('Network error.'); }
    finally { setSending(false); }
  }

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-[var(--c-text)]">Share {borrowerName}&rsquo;s portal</p>
          <p className="text-[12px] text-[var(--c-label2)] mt-0.5">A branded home base showing <span className="font-medium text-[var(--c-text)]">{loName}</span>&rsquo;s name, photo &amp; NMLS — where {borrowerName} tracks the loan, uploads docs, and asks Ashley anything.</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input readOnly value={url} className="flex-1 rounded-[10px] border border-[var(--c-border)] bg-[var(--c-fill)] px-3 py-2 text-[12px] text-[var(--c-label2)] font-mono truncate" />
        <button onClick={copy} className="inline-flex items-center gap-1 rounded-[10px] bg-[#C9A95C] text-white px-3 py-2 text-[12px] font-medium hover:brightness-95">{copied ? <IconCheck size={14} /> : <IconCopy size={14} />}{copied ? 'Copied' : 'Copy'}</button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--c-border)] px-3 py-2 text-[12px] font-medium text-[var(--c-text)] hover:bg-[var(--c-fill)]"><IconExternalLink size={14} /> Preview</a>
        <button onClick={() => setShowQr((v) => !v)} className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--c-border)] px-3 py-2 text-[12px] font-medium text-[var(--c-text)] hover:bg-[var(--c-fill)]"><IconQrcode size={14} /> {showQr ? 'Hide' : 'QR code'}</button>
        {borrowerHasPhone && (
          <button onClick={textBorrower} disabled={sending} className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#C9A95C] text-[#8C6B2A] px-3 py-2 text-[12px] font-medium hover:bg-[var(--c-gold-light)] disabled:opacity-50"><IconMessage size={14} /> {sending ? 'Sending…' : 'Text to borrower'}</button>
        )}
      </div>

      {showQr && qr && (
        <div className="mt-3 flex flex-col items-center gap-1 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Portal QR code" className="w-40 h-40 rounded-[10px] border border-[var(--c-border)]" />
          <p className="text-[11px] text-[var(--c-label2)]">Scan to open the portal — great for open houses & closings.</p>
        </div>
      )}
      {sendResult && <p className="text-[12px] text-[var(--c-label2)] mt-2">{sendResult}</p>}
    </div>
  );
}
