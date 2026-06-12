'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconCopy, IconCheck, IconExternalLink, IconFileText } from '@tabler/icons-react';

export function Apply1003Share({ token, borrowerName, status }: { token: string; borrowerName: string; status: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const path = `/apply/form/${token}`;
  const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <IconFileText size={20} className="text-[#C9A95C]" />
        <h1 className="text-xl font-semibold text-[var(--c-text,#111)]">Digital 1003 Application</h1>
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Share this secure link with {borrowerName}. Progress saves automatically; you’ll be notified on submission.
      </p>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
        <p className="text-xs font-medium text-gray-500">Borrower application link</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-gray-50"
          />
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#C9A95C] px-3 py-2 text-sm font-medium text-white hover:brightness-95"
          >
            {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <a
            href={path}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#C9A95C]"
          >
            <IconExternalLink size={15} /> Preview form
          </a>
          <span className="text-xs text-gray-400">Status: {status.replace('_', ' ')}</span>
        </div>
      </div>

      <button onClick={() => router.back()} className="mt-4 text-sm text-gray-500 hover:text-gray-700">
        ← Back
      </button>
    </div>
  );
}
