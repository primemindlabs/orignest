'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, RefreshCw, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

type FieldType = 'note' | 'email' | 'sms' | 'task';

interface ComposeOption {
  id: string;
  label: string;
  contextType: 'draft_followup' | 'summarize_call' | 'write_intro_email' | 'rate_explanation' | 'custom';
}

const OPTIONS: ComposeOption[] = [
  { id: 'followup', label: 'Draft follow-up', contextType: 'draft_followup' },
  { id: 'summarize', label: 'Summarize call', contextType: 'summarize_call' },
  { id: 'intro', label: 'Write intro email', contextType: 'write_intro_email' },
  { id: 'rate', label: 'Rate explanation', contextType: 'rate_explanation' },
  { id: 'custom', label: 'Custom prompt...', contextType: 'custom' },
];

interface AIComposeProps {
  fieldType: FieldType;
  leadId?: string;
  existingText?: string;
  onGenerated: (text: string) => void;
}

export function AICompose({ fieldType, leadId, existingText, onGenerated }: AIComposeProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  async function generate(option: ComposeOption) {
    if (option.contextType === 'custom') {
      setShowCustomInput(true);
      setOpen(false);
      return;
    }
    await doGenerate(option.contextType, undefined);
  }

  async function doGenerate(
    contextType: ComposeOption['contextType'],
    customText: string | undefined
  ) {
    setGenerating(true);
    setDraft(null);
    setOpen(false);
    setShowCustomInput(false);

    try {
      const res = await fetch('/api/ai/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldType,
          contextType,
          leadId,
          existingText,
          customPrompt: customText,
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error: string };
        toast.error(err.error ?? 'AI compose failed');
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setDraft(accumulated);
      }
    } catch {
      toast.error('Failed to generate. Check your connection.');
    } finally {
      setGenerating(false);
    }
  }

  function accept() {
    if (!draft) return;
    onGenerated(draft);
    setDraft(null);
    toast.success('AI text applied');
  }

  function regenerate() {
    if (!draft) return;
    doGenerate('draft_followup', undefined);
  }

  function dismiss() {
    setDraft(null);
  }

  return (
    <div className="relative inline-block">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={generating}
        title="AI Compose"
        className="flex items-center gap-1 h-6 px-2 rounded-md bg-[#007AFF]/8 hover:bg-[#007AFF]/14 text-[#007AFF] text-[11px] font-medium transition-colors disabled:opacity-50"
      >
        <Sparkles size={11} />
        {generating ? (
          <span className="flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-[#007AFF] animate-bounce [animation-delay:0ms]" />
            <span className="inline-block w-1 h-1 rounded-full bg-[#007AFF] animate-bounce [animation-delay:150ms]" />
            <span className="inline-block w-1 h-1 rounded-full bg-[#007AFF] animate-bounce [animation-delay:300ms]" />
          </span>
        ) : (
          'AI'
        )}
      </button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 top-8 w-[200px] bg-white rounded-xl border border-black/[0.06] shadow-menu z-50 overflow-hidden py-1"
          >
            {OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => generate(opt)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#1C1C1E] hover:bg-black/[0.04] transition-colors text-left"
              >
                <Sparkles size={12} className="text-[#007AFF] flex-shrink-0" />
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom prompt input */}
      <AnimatePresence>
        {showCustomInput && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute right-0 top-8 w-[280px] bg-white rounded-xl border border-black/[0.06] shadow-menu z-50 p-3"
          >
            <p className="text-[11px] font-medium text-[#6C6C70] mb-2">Custom AI prompt</p>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Draft a congratulatory message for their loan approval..."
              className="w-full h-20 text-[13px] bg-[#F2F2F7] rounded-lg px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-[#007AFF]/30 text-[#1C1C1E] placeholder:text-[#AEAEB2]"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => doGenerate('custom', customPrompt)}
                disabled={!customPrompt.trim()}
                className="flex-1 h-8 rounded-lg bg-[#007AFF] text-white text-[12px] font-medium hover:bg-[#007AFF]/90 transition-colors disabled:opacity-50"
              >
                Generate
              </button>
              <button
                type="button"
                onClick={() => { setShowCustomInput(false); setCustomPrompt(''); }}
                className="w-8 h-8 rounded-lg border border-black/[0.08] text-[#6C6C70] hover:bg-black/[0.04] transition-colors flex items-center justify-center"
              >
                <X size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generated draft preview */}
      <AnimatePresence>
        {draft && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute right-0 top-8 w-[320px] bg-white rounded-xl border border-[#007AFF]/20 shadow-elevated z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 bg-[#007AFF]/5 border-b border-[#007AFF]/10">
              <div className="flex items-center gap-1.5">
                <Sparkles size={11} className="text-[#007AFF]" />
                <span className="text-[11px] font-medium text-[#007AFF]">AI Draft</span>
              </div>
              <button type="button" onClick={dismiss} className="text-[#AEAEB2] hover:text-[#1C1C1E] transition-colors">
                <X size={11} />
              </button>
            </div>
            <div className="px-3 py-3 max-h-[160px] overflow-y-auto">
              <p className="text-[13px] text-[#1C1C1E] whitespace-pre-wrap leading-relaxed">{draft}</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border-t border-black/[0.06]">
              <button
                type="button"
                onClick={accept}
                className="flex items-center gap-1 h-7 px-3 rounded-lg bg-[#34C759] text-white text-[12px] font-medium hover:bg-[#34C759]/90 transition-colors"
              >
                <Check size={11} /> Use this
              </button>
              <button
                type="button"
                onClick={regenerate}
                disabled={generating}
                className="flex items-center gap-1 h-7 px-2 rounded-lg border border-black/[0.08] text-[#6C6C70] text-[12px] hover:bg-black/[0.04] transition-colors disabled:opacity-50"
              >
                <RefreshCw size={11} /> Retry
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="ml-auto h-7 px-2 rounded-lg text-[#AEAEB2] text-[12px] hover:text-[#1C1C1E] transition-colors"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
