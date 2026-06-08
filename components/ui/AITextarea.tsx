'use client';

import { forwardRef, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Sparkles } from 'lucide-react';

type AIContext = 'note' | 'sms' | 'email' | 'task' | 'condition';

interface LeadContext {
  name?: string;
  stage?: string;
  loanType?: string;
  lastContact?: string;
  loanAmount?: number;
}

interface AITextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  context: AIContext;
  leadContext?: LeadContext;
  onValueChange?: (value: string) => void;
}

const CONTEXT_PROMPTS: Record<AIContext, Array<{ label: string; prompt: string }>> = {
  note: [
    { label: 'Summarize call', prompt: 'Summarize a follow-up call with this borrower — key points, next steps, and what was discussed.' },
    { label: 'Write follow-up note', prompt: 'Write a professional follow-up note after a borrower conversation.' },
    { label: 'Draft LOE request', prompt: 'Draft a letter of explanation request for this borrower.' },
  ],
  sms: [
    { label: 'Follow-up text', prompt: 'Write a short, warm follow-up text message to this borrower. Keep it under 160 characters.' },
    { label: 'Request documents', prompt: 'Write an SMS requesting outstanding documents from this borrower. Keep it under 160 characters.' },
    { label: 'Confirm appointment', prompt: 'Write an SMS confirming an upcoming appointment. Keep it under 160 characters.' },
  ],
  email: [
    { label: 'Draft follow-up email', prompt: 'Write a professional follow-up email to this mortgage borrower.' },
    { label: 'Rate quote explanation', prompt: 'Write an email explaining the rate quote and loan terms to the borrower.' },
    { label: 'Document checklist', prompt: 'Write an email with a clear document checklist the borrower needs to provide.' },
  ],
  task: [
    { label: 'Write task description', prompt: 'Write a clear, actionable task description for a mortgage loan officer.' },
    { label: 'Draft reminder', prompt: 'Write a task reminder note for following up on this lead.' },
    { label: 'Next steps note', prompt: 'Write a concise next-steps note for this loan file.' },
  ],
  condition: [
    { label: 'Explain condition', prompt: 'Write a clear, plain-English explanation of this loan condition for the borrower.' },
    { label: 'Draft stip request', prompt: 'Write a professional stip/condition request to the borrower.' },
    { label: 'Condition response', prompt: 'Write a response addressing this underwriting condition.' },
  ],
};

export const AITextarea = forwardRef<HTMLTextAreaElement, AITextareaProps>(
  ({ context, leadContext, onValueChange, className, value, defaultValue, onChange, ...props }, forwardedRef) => {
    const [internalValue, setInternalValue] = useState(
      (value as string) ?? (defaultValue as string) ?? ''
    );
    const [showMenu, setShowMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingLabel, setLoadingLabel] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Merge refs
    const setRef = useCallback(
      (el: HTMLTextAreaElement | null) => {
        (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
        if (typeof forwardedRef === 'function') forwardedRef(el);
        else if (forwardedRef) forwardedRef.current = el;
      },
      [forwardedRef]
    );

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInternalValue(e.target.value);
      onChange?.(e);
      onValueChange?.(e.target.value);
    };

    const runAI = async (option: { label: string; prompt: string }) => {
      setShowMenu(false);
      setLoading(true);
      setLoadingLabel(option.label);

      try {
        const contextParts: string[] = [];
        if (leadContext?.name) contextParts.push(`Borrower: ${leadContext.name}`);
        if (leadContext?.stage) contextParts.push(`Stage: ${leadContext.stage}`);
        if (leadContext?.loanType) contextParts.push(`Loan type: ${leadContext.loanType}`);
        if (leadContext?.lastContact) contextParts.push(`Last contact: ${leadContext.lastContact}`);
        if (leadContext?.loanAmount) contextParts.push(`Loan amount: $${leadContext.loanAmount.toLocaleString()}`);

        const res = await fetch('/api/ai/contextual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context,
            type: option.label,
            prompt: option.prompt,
            leadData: contextParts.join('\n') || undefined,
            existingContent: internalValue || undefined,
          }),
        });

        if (!res.ok) throw new Error('AI request failed');
        if (!res.body) throw new Error('No response body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let aiText = '';

        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          const text = decoder.decode(chunk);
          // Parse SSE data lines
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') break;
              try {
                const parsed = JSON.parse(data) as { text?: string };
                if (parsed.text) {
                  aiText += parsed.text;
                  setInternalValue(aiText);
                  onValueChange?.(aiText);
                }
              } catch {
                // not JSON, skip
              }
            }
          }
        }
      } catch {
        // silently fail — textarea stays as-is
      } finally {
        setLoading(false);
        setLoadingLabel('');
        textareaRef.current?.focus();
      }
    };

    const prompts = CONTEXT_PROMPTS[context];
    const displayValue = value !== undefined ? (value as string) : internalValue;

    return (
      <div className="relative">
        <textarea
          ref={setRef}
          {...props}
          value={displayValue}
          onChange={handleChange}
          className={clsx(
            'w-full rounded-[10px] bg-[rgba(118,118,128,0.12)] border border-black/[0.06] text-sm text-black placeholder:text-[#AEAEB2] resize-none',
            'px-3 py-2.5 pr-14',
            'focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue/40',
            'transition-all duration-200 ease-out',
            loading && 'opacity-80',
            className
          )}
          disabled={loading}
        />

        {/* AI button */}
        <div className="absolute bottom-2.5 right-2.5">
          <button
            type="button"
            onClick={() => setShowMenu((s) => !s)}
            disabled={loading}
            className={clsx(
              'flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium transition-all duration-150',
              loading
                ? 'bg-blue/10 text-blue/60 cursor-not-allowed'
                : 'bg-blue/10 text-blue hover:bg-blue/15 active:bg-blue/20'
            )}
            aria-label="AI writing assistant"
          >
            {loading ? (
              <>
                <div className="w-2.5 h-2.5 border border-blue/40 border-t-blue rounded-full animate-spin" />
                <span className="hidden sm:inline">{loadingLabel}</span>
              </>
            ) : (
              <><Sparkles className="w-3 h-3" strokeWidth={2} /> AI</>
            )}
          </button>

          <AnimatePresence>
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <motion.div
                  ref={menuRef}
                  initial={{ opacity: 0, scale: 0.95, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 4 }}
                  transition={{ duration: 0.12, ease: 'easeOut' }}
                  className="absolute bottom-8 right-0 z-50 bg-white/95 backdrop-blur-xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.16)] border border-black/[0.06] py-1.5 min-w-[200px]"
                >
                  {prompts.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => runAI(option)}
                      className="w-full text-left px-3 py-2 text-sm text-black hover:bg-[rgba(0,122,255,0.06)] transition-colors"
                    >
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }
);

AITextarea.displayName = 'AITextarea';
