'use client';

/**
 * Phase 146 — public website chat UI (rendered inside the embed iframe).
 * Self-contained inline styles so it renders identically regardless of the host
 * page's CSS. Calls /api/widget/[key]/start then /message (same origin).
 */
import { useEffect, useRef, useState } from 'react';

interface Turn { role: 'visitor' | 'assistant'; body: string }

export function WidgetChat({ widgetKey }: { widgetKey: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [headline, setHeadline] = useState('Chat with us');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/widget/${widgetKey}/start`, { method: 'POST' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { setToken(j.session_token); setHeadline(j.headline || 'Chat with us'); setTurns([{ role: 'assistant', body: j.greeting }]); })
      .catch(() => setUnavailable(true));
  }, [widgetKey]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, busy]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || !token || busy) return;
    setInput('');
    setTurns((t) => [...t, { role: 'visitor', body: msg }]);
    setBusy(true);
    try {
      const j = await fetch(`/api/widget/${widgetKey}/message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: token, message: msg }),
      }).then((r) => r.json());
      setTurns((t) => [...t, { role: 'assistant', body: j.reply || "Thanks! We'll be in touch shortly." }]);
    } catch {
      setTurns((t) => [...t, { role: 'assistant', body: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setBusy(false);
    }
  };

  const C = {
    wrap: { display: 'flex', flexDirection: 'column' as const, height: '100%', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: '#fff', color: '#1a1a1a' },
    head: { padding: '14px 16px', borderBottom: '1px solid #eee', fontWeight: 600, fontSize: 15 },
    body: { flex: 1, overflowY: 'auto' as const, padding: 14, display: 'flex', flexDirection: 'column' as const, gap: 10 },
    foot: { display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #eee' },
    input: { flex: 1, border: '1px solid #ddd', borderRadius: 10, padding: '10px 12px', fontSize: 14, outline: 'none' as const },
    send: { border: 'none', background: '#1a1a1a', color: '#fff', borderRadius: 10, padding: '0 16px', fontSize: 14, cursor: 'pointer' },
    bubble: (me: boolean) => ({ alignSelf: me ? 'flex-end' as const : 'flex-start' as const, maxWidth: '82%', padding: '9px 12px', borderRadius: 14, fontSize: 14, lineHeight: 1.4, whiteSpace: 'pre-wrap' as const, background: me ? '#1a1a1a' : '#f1f1f3', color: me ? '#fff' : '#1a1a1a' }),
  };

  if (unavailable) return <div style={{ ...C.wrap, alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', color: '#888' }}>This chat is currently unavailable.</div>;

  return (
    <div style={C.wrap}>
      <div style={C.head}>{headline}</div>
      <div style={C.body}>
        {turns.map((t, i) => <div key={i} style={C.bubble(t.role === 'visitor')}>{t.body}</div>)}
        {busy && <div style={C.bubble(false)}>…</div>}
        <div ref={endRef} />
      </div>
      <div style={C.foot}>
        <input style={C.input} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={token ? 'Type your message…' : 'Connecting…'} disabled={!token || busy} />
        <button style={C.send} onClick={send} disabled={!token || busy}>Send</button>
      </div>
      <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center', padding: '0 0 8px' }}>Replies are general info, not a commitment to lend.</div>
    </div>
  );
}
