'use client';

import { useEffect, useRef, useState } from 'react';
import { IconPhone, IconPhoneOff, IconBackspace, IconSearch, IconX } from '@tabler/icons-react';
import { formatPhone } from '@/lib/utils';
import { AddContactPrompt } from './AddContactPrompt';

interface DialContact { id: string; name: string; phone: string; stage: string }

const GOLD = '#C9A95C';
const KEYS: [string, string][] = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
];

function mmss(s: number): string {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

type CallState = 'idle' | 'dialing' | 'connected' | 'ended';

/** Tab 3 — the MLO's "work phone": dial any number, in or out of the CRM. */
export function Dialpad({ callerIdNumber }: { callerIdNumber: string | null }) {
  const [digits, setDigits] = useState('');
  const [state, setState] = useState<CallState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const dialedRef = useRef('');

  // Contact search → call a specific person (logs the call against their lead).
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DialContact[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<DialContact | null>(null);
  const leadIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (state !== 'connected') return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  // Debounced contact lookup.
  useEffect(() => {
    if (selected) return; // a contact is picked — don't keep searching
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/dialer/contacts?q=${encodeURIComponent(q)}`);
        const j = (await res.json()) as { contacts?: DialContact[] };
        setResults(j.contacts ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, selected]);

  function pickContact(c: DialContact) {
    setSelected(c);
    setDigits(c.phone.replace(/\D/g, ''));
    leadIdRef.current = c.id;
    setResults([]);
    setQuery('');
  }

  function clearSelected() {
    setSelected(null);
    leadIdRef.current = null;
    setDigits('');
  }

  const tenDigits = digits.replace(/\D/g, '').length >= 10;

  async function handleCall() {
    if (!tenDigits || state !== 'idle') return;
    setError('');
    setSeconds(0);
    setState('dialing');
    dialedRef.current = digits;
    try {
      const res = await fetch('/api/dialer/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_phone: digits, lead_id: leadIdRef.current ?? undefined }),
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? 'Failed to place call');
      setState('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place call');
      setState('idle');
    }
  }

  function handleHangup() {
    setState('ended');
    setTimeout(() => {
      setState('idle');
      setSeconds(0);
      setShowAddPrompt(true); // offer to save the number after the call
    }, 600);
  }

  async function saveContact(c: { type: 'lead' | 'partner'; name: string; phone: string }) {
    await fetch('/api/dialer/save-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    }).catch(() => {});
    setShowAddPrompt(false);
    setDigits('');
    clearSelected();
  }

  return (
    <div className="max-w-[320px] mx-auto bg-white rounded-2xl border border-black/[0.06] shadow-card p-6">
      {callerIdNumber && (
        <p className="text-[11px] text-label-3 text-center mb-3">Calling from {formatPhone(callerIdNumber)}</p>
      )}

      {/* Search & select a person to call */}
      {state === 'idle' && (
        <div className="relative mb-3">
          {selected ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gold-50 border border-gold-100">
              <span className="text-[13px] font-medium text-label truncate">{selected.name} · {formatPhone(selected.phone)}</span>
              <button onClick={clearSelected} className="text-label-3 hover:text-label flex-shrink-0" aria-label="Clear contact"><IconX size={15} /></button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-black/[0.1] bg-bg">
                <IconSearch size={15} className="text-label-3 flex-shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a contact to call…"
                  className="flex-1 bg-transparent text-[13px] text-label outline-none placeholder:text-label-3"
                />
              </div>
              {(results.length > 0 || searching) && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-white rounded-xl border border-black/[0.08] shadow-card max-h-56 overflow-y-auto">
                  {searching && results.length === 0 && <p className="px-3 py-2 text-[12px] text-label-3">Searching…</p>}
                  {results.map((c) => (
                    <button key={c.id} onClick={() => pickContact(c)} className="w-full text-left px-3 py-2 hover:bg-bg flex items-center justify-between gap-2">
                      <span className="text-[13px] text-label truncate">{c.name}</span>
                      <span className="text-[11px] text-label-3 flex-shrink-0">{formatPhone(c.phone)}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="h-10 flex items-center justify-center text-2xl font-semibold text-label tabular-nums">
        {digits ? formatPhone(digits) : <span className="text-label-3 text-base font-normal">Enter number</span>}
      </div>

      {error && <p className="text-[11px] text-red text-center mt-1">{error}</p>}

      {state === 'connected' || state === 'ended' ? (
        <div className="flex flex-col items-center mt-6">
          <p className="text-xs font-medium" style={{ color: state === 'connected' ? '#1a7a3c' : '#6B7B8D' }}>
            {state === 'connected' ? 'Connected' : 'Call ended'}
          </p>
          <p className="text-3xl font-bold text-label tabular-nums mt-2">{mmss(seconds)}</p>
          <button
            onClick={handleHangup}
            disabled={state === 'ended'}
            className="mt-5 w-full flex items-center justify-center gap-2 py-3 bg-red text-white text-sm font-semibold rounded-xl hover:bg-red/90 transition-colors disabled:opacity-50"
          >
            <IconPhoneOff size={16} /> Hang up
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mt-5 max-w-[240px] mx-auto">
            {KEYS.map(([digit, letters]) => (
              <button
                key={digit}
                onClick={() => setDigits((d) => d + digit)}
                className="aspect-square rounded-full bg-bg hover:bg-black/[0.07] transition-colors flex flex-col items-center justify-center"
              >
                <span className="text-xl font-semibold text-label leading-none">{digit}</span>
                {letters && <span className="text-[9px] tracking-widest text-label-3 mt-0.5">{letters}</span>}
              </button>
            ))}
          </div>

          <div className="flex justify-center mt-3 h-8">
            {digits && (
              <button onClick={() => setDigits((d) => d.slice(0, -1))} className="text-label-2 hover:text-label p-2">
                <IconBackspace size={20} />
              </button>
            )}
          </div>

          <button
            onClick={handleCall}
            disabled={!tenDigits || state === 'dialing'}
            className="mt-2 w-full flex items-center justify-center gap-2 py-3 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40"
            style={{ background: GOLD }}
          >
            <IconPhone size={16} /> {state === 'dialing' ? 'Dialing…' : 'Call'}
          </button>
        </>
      )}

      {showAddPrompt && (
        <AddContactPrompt
          phoneNumber={dialedRef.current}
          onSave={saveContact}
          onSkip={() => {
            setShowAddPrompt(false);
            setDigits('');
            clearSelected();
          }}
        />
      )}
    </div>
  );
}
