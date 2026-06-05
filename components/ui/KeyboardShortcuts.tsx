'use client';

import { useEffect, useState } from 'react';
import { X, Keyboard } from 'lucide-react';

interface Shortcut {
  keys: string[];
  description: string;
  context?: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['⌘', 'K'], description: 'Open command palette' },
  { keys: ['⌘', '/'], description: 'Search leads' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['N'], description: 'New lead', context: 'Leads page' },
  { keys: ['E'], description: 'Edit lead', context: 'Lead detail' },
  { keys: ['T'], description: 'Add task', context: 'Lead detail' },
  { keys: ['C'], description: 'Log call', context: 'Lead detail' },
  { keys: ['Esc'], description: 'Close modal / dismiss' },
];

interface KeyboardShortcutsProps {
  /** If provided, renders a trigger button inline */
  showTrigger?: boolean;
}

export function KeyboardShortcuts({ showTrigger }: KeyboardShortcutsProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger inside inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!open) {
    if (showTrigger) {
      return (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs text-label-3 hover:text-label-2 hover:bg-fill transition-colors"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard size={13} />
          Shortcuts
        </button>
      );
    }
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />

      {/* Modal */}
      <div
        className="relative bg-surface rounded-sheet shadow-sheet border border-border w-full max-w-sm animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-label-2" />
            <h2 className="text-[15px] font-semibold text-black">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-fill transition-colors"
          >
            <X size={14} className="text-label-2" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="p-4 space-y-1">
          {SHORTCUTS.map((shortcut, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 px-2 py-2 rounded-[6px] hover:bg-fill/50 transition-colors"
            >
              <div>
                <span className="text-sm text-black">{shortcut.description}</span>
                {shortcut.context && (
                  <span className="text-[11px] text-label-3 ml-1.5">— {shortcut.context}</span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {shortcut.keys.map((key, j) => (
                  <kbd
                    key={j}
                    className="inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 bg-[rgba(60,60,67,0.08)] border border-[rgba(60,60,67,0.15)] rounded-[5px] text-[11px] font-medium text-black shadow-[0_1px_0_rgba(0,0,0,0.12)]"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border">
          <p className="text-[11px] text-label-3 text-center">
            Press <kbd className="inline-flex items-center px-1 py-0.5 bg-[rgba(60,60,67,0.08)] border border-[rgba(60,60,67,0.15)] rounded-[4px] text-[10px] font-medium text-label-2">?</kbd> to toggle this panel
          </p>
        </div>
      </div>
    </div>
  );
}
