'use client';

/**
 * Phase 96 — closing-post generator panel (hosted on /loans/[id]/closing-post).
 * Adapts the spec's modal into an inline tool panel. Live compliance runs
 * CLIENT-SIDE via the pure checker (no per-keystroke network); the server
 * re-validates as a hard gate on approve.
 */
import { useState, useEffect, useCallback } from 'react';
import { IconCheck, IconSend, IconCopy, IconRefresh } from '@tabler/icons-react';
import { PostCopyEditor } from './PostCopyEditor';
import { ComplianceCheckBadge } from './ComplianceCheckBadge';
import { PlatformSelector } from './PlatformSelector';
import { PostPreview } from './PostPreview';
import { checkPostCompliance } from '@/lib/compliance/postCompliance';
import type { ClosingPost, SocialPlatform, LoProfileInfo } from '@/types/closingPosts';

interface Props {
  leadId: string;
  leadInfo: { first_name: string; property_city: string; property_state: string; loan_type: string };
  loProfile: LoProfileInfo;
}

type Step = 'generating' | 'review' | 'preview' | 'done';

export function ClosingPostGenerator({ leadId, leadInfo, loProfile }: Props) {
  const [step, setStep] = useState<Step>('generating');
  const [post, setPost] = useState<ClosingPost | null>(null);
  const [editedCopy, setEditedCopy] = useState('');
  const [compliance, setCompliance] = useState<{ passed: boolean; flags: string[] }>({ passed: false, flags: [] });
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['instagram']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setStep('generating');
    setError(null);
    try {
      const res = await fetch('/api/closing-posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not generate a post.');
        setStep('review');
        return;
      }
      setPost(data.post);
      setEditedCopy(data.post.edited_copy ?? data.post.generated_copy);
      setCompliance(data.compliance);
      setStep('review');
    } catch {
      setError('Could not generate a post.');
      setStep('review');
    }
  }, [leadId]);

  useEffect(() => { generate(); }, [generate]);

  function onCopyChange(v: string) {
    setEditedCopy(v);
    const r = checkPostCompliance(v); // pure, client-side — instant feedback
    setCompliance({ passed: r.passed, flags: r.flags });
  }

  async function handleApprove() {
    if (!compliance.passed || !post) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/closing-posts/${post.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edited_copy: editedCopy }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? 'Could not approve.');
        return;
      }
      setStep('preview');
    } finally {
      setBusy(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard?.writeText(editedCopy);
  }

  async function handlePost() {
    if (!post) return;
    copyToClipboard();
    setBusy(true);
    try {
      await fetch(`/api/closing-posts/${post.id}/posted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: selectedPlatforms }),
      });
      setStep('done');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'generating') {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm text-center py-16">
        <div className="w-10 h-10 border-2 border-[#C9A95C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500">Generating a compliant post…</p>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm text-center py-16">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <IconCheck size={28} className="text-green-500" />
        </div>
        <p className="font-semibold text-gray-900">Post copied to your clipboard 🎉</p>
        <p className="text-sm text-gray-500 mt-1">
          Paste it into {selectedPlatforms.length ? selectedPlatforms.join(', ') : 'your social app'} to share the moment.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-5">
      {error && <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>}

      {post && (
        <>
          <PostCopyEditor value={editedCopy} onChange={onCopyChange} disabled={step === 'preview'} />
          <ComplianceCheckBadge passed={compliance.passed} flags={compliance.flags} />
          <PlatformSelector selected={selectedPlatforms} onChange={setSelectedPlatforms} />
          {step === 'preview' && (
            <PostPreview copy={editedCopy} platform={selectedPlatforms[0] ?? 'instagram'} loProfile={loProfile} />
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              onClick={generate}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-300 transition-colors disabled:opacity-50"
            >
              <IconRefresh size={15} /> Regenerate
            </button>
            <button
              onClick={copyToClipboard}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-gray-300 transition-colors"
            >
              <IconCopy size={15} /> Copy
            </button>
            <button
              disabled={!compliance.passed || busy || (step === 'preview' && selectedPlatforms.length === 0)}
              onClick={step === 'review' ? handleApprove : handlePost}
              className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#C9A95C] text-white font-semibold text-sm hover:bg-[#b8953f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IconSend size={16} />
              {busy ? 'Working…' : step === 'review' ? 'Approve & Preview' : 'Copy & Mark Shared'}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Direct publishing to social platforms isn&apos;t connected — &ldquo;Copy &amp; Mark Shared&rdquo; copies the
            approved post for you to paste, and records it for compliance.
          </p>
        </>
      )}
    </div>
  );
}
