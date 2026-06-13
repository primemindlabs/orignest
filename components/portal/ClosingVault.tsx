'use client';

// Phase 123 — Closing Vault: permanent document storage (read-only, no delete).
import { useEffect, useState } from 'react';
import { IconFileText, IconDownload, IconLock, IconMessageChatbot } from '@tabler/icons-react';

interface Doc { id: string; document_type: string; document_label: string; uploaded_at: string; url: string | null }

export function ClosingVault({ token, onAskAshley }: { token: string; onAskAshley?: () => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/borrower-portal/${token}/vault`).then((r) => (r.ok ? r.json() : null)).then((d) => setDocs(d?.documents ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="bg-white rounded-2xl border border-[#EDEAE4] p-6">
      <div className="flex items-center gap-2 mb-1">
        <IconLock size={17} className="text-[#C9A95C]" />
        <p className="text-[13px] font-medium text-[#1A1816]">Closing Vault</p>
      </div>
      <p className="text-[12px] text-[#9B9590] mb-4">Your permanent home for closing documents — always here when you need them.</p>

      {loading ? (
        <p className="text-[13px] text-[#9B9590]">Loading your documents…</p>
      ) : docs.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-[13px] text-[#1A1816] font-medium">Your vault activates with your first document</p>
          <p className="text-[12.5px] text-[#6B6560] mt-1 max-w-sm mx-auto leading-relaxed">When your loan officer shares your first file — your closing disclosure, deed, title insurance, and more — it lives here permanently, ready to download anytime.</p>
          {onAskAshley && (
            <button onClick={onAskAshley} className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[#C9A95C] text-[#8C6B2A] px-4 py-2 text-[13px] font-medium hover:bg-[#FBF5E6] transition-colors">
              <IconMessageChatbot size={15} /> Ask Ashley
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 bg-[#FAFAF8] border border-[#EDEAE4] rounded-xl px-3 py-2.5">
              <IconFileText size={17} className="text-[#C9A95C] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[#1A1816] truncate">{d.document_label}</p>
                <p className="text-[11px] text-[#9B9590]">{new Date(d.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              </div>
              {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px] font-medium text-[#8C6B2A] hover:text-[#C9A95C]"><IconDownload size={14} /> Download</a>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
