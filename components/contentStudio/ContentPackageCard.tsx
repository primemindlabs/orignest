'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { IconBrandLinkedin, IconBrandInstagram, IconBrandFacebook, IconCopy, IconPencil, IconCheck, IconX, IconPhoto } from '@tabler/icons-react';
import { auditPostCompliance } from '@/lib/contentStudio/auditPostCompliance';
import { ComplianceWarning } from './ComplianceWarning';
import { PostPreview } from './PostPreview';
import type { ContentPostRow, Platform } from '@/lib/contentStudio/types';
import { cleanPostText } from '@/lib/contentStudio/sanitizePost';

const PLATFORM_ICON: Record<Platform, typeof IconBrandLinkedin> = {
  linkedin: IconBrandLinkedin,
  instagram: IconBrandInstagram,
  facebook: IconBrandFacebook,
};

const DAY_LABEL = (d: string) => d.charAt(0).toUpperCase() + d.slice(1);

type Props = {
  post: ContentPostRow;
  onAction: (id: string, action: 'edit' | 'skip' | 'publish', editedText?: string) => Promise<void>;
};

export function ContentPackageCard({ post, onAction }: Props) {
  const display = cleanPostText(post.edited_text ?? post.post_text);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(display);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'design' | 'text'>('design');
  const Icon = PLATFORM_ICON[post.platform];

  const issues = auditPostCompliance(editing ? draft : display);
  const muted = post.status === 'skipped' || post.status === 'published';

  const copy = async () => {
    const full = [display, post.hashtags, post.nmls_footer].filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(full);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy');
    }
  };

  const run = async (action: 'edit' | 'skip' | 'publish', text?: string) => {
    setBusy(true);
    try { await onAction(post.id, action, text); } finally { setBusy(false); }
  };

  return (
    <div className={`bg-white rounded-xl border border-[#E8E4DE] px-5 py-4 ${muted ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-[#6B7B8D]" />
        <span className="text-xs font-semibold text-[#1A1A1A]">{DAY_LABEL(post.post_day)}</span>
        <span className="text-[10px] text-[#6B7B8D] uppercase tracking-wide">{post.content_type.replace(/_/g, ' ')}</span>
        {post.status !== 'draft' && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#F4F2EF] text-[#6B7B8D]">{post.status}</span>
        )}
        {!editing && (
          <div className="ml-auto inline-flex rounded-md border border-[#E8E4DE] overflow-hidden">
            <button onClick={() => setView('design')} className={`px-2 py-0.5 text-[10px] font-medium ${view === 'design' ? 'bg-[#C9A95C] text-white' : 'text-[#6B7B8D]'}`}>Design</button>
            <button onClick={() => setView('text')} className={`px-2 py-0.5 text-[10px] font-medium ${view === 'text' ? 'bg-[#C9A95C] text-white' : 'text-[#6B7B8D]'}`}>Text</button>
          </div>
        )}
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          className="w-full text-sm border border-[#E8E4DE] rounded-lg px-3 py-2 focus:outline-none focus:border-[#C9A95C] leading-relaxed"
        />
      ) : view === 'design' ? (
        <PostPreview post={post} />
      ) : (
        <p className="text-sm text-[#1A1A1A] whitespace-pre-wrap leading-relaxed">{display}</p>
      )}

      {post.hashtags && !editing && view === 'text' && <p className="text-sm text-[#876830] mt-2">{post.hashtags}</p>}

      {post.image_prompt && !editing && (
        <p className="text-xs text-[#6B7B8D] mt-2 flex items-start gap-1.5">
          <IconPhoto size={13} className="flex-shrink-0 mt-0.5" /> {post.image_prompt}
        </p>
      )}

      <p className="text-[11px] text-[#9A9A95] mt-2 leading-snug">{post.nmls_footer}</p>

      <ComplianceWarning issues={issues} />

      <div className="flex items-center gap-2 mt-3">
        {editing ? (
          <>
            <button onClick={() => run('edit', draft).then(() => setEditing(false))} disabled={busy} className="flex items-center gap-1.5 bg-[#C9A95C] text-white text-xs px-3 py-1.5 rounded-lg hover:brightness-95 disabled:opacity-40">
              <IconCheck size={13} /> Save
            </button>
            <button onClick={() => { setDraft(display); setEditing(false); }} className="text-xs text-[#6B7B8D] px-2 py-1.5">Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} disabled={muted} className="flex items-center gap-1.5 border border-[#E8E4DE] text-[#4A4A4A] text-xs px-3 py-1.5 rounded-lg hover:bg-[#FAFAF8] disabled:opacity-40">
              <IconPencil size={13} /> Edit
            </button>
            <button onClick={copy} className="flex items-center gap-1.5 border border-[#E8E4DE] text-[#4A4A4A] text-xs px-3 py-1.5 rounded-lg hover:bg-[#FAFAF8]">
              <IconCopy size={13} /> Copy
            </button>
            <button onClick={() => run('publish')} disabled={busy || muted} className="flex items-center gap-1.5 bg-[#F0F9F4] text-[#1A7A45] text-xs px-3 py-1.5 rounded-lg hover:bg-[#E0F4EA] disabled:opacity-40">
              <IconCheck size={13} /> Mark posted
            </button>
            <button onClick={() => run('skip')} disabled={busy || muted} className="flex items-center gap-1.5 text-[#6B7B8D] text-xs px-2 py-1.5 rounded-lg hover:text-[#C4724A] hover:bg-[#FFF4F0] disabled:opacity-40 ml-auto">
              <IconX size={13} /> Skip
            </button>
          </>
        )}
      </div>
    </div>
  );
}
