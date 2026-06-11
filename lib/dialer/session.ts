/**
 * Phase 79 — dialer session persistence. State lives in sessionStorage so a tab
 * refresh keeps the queue/position mid-session; closing the tab clears it, which
 * is the right lifetime for a calling session.
 */

const SESSION_KEY = 'ashley_iq_dialer_session';

export interface DialerSession {
  /** Lead ids in queue order (the full data is re-fetched; we only persist order + progress). */
  queueIds: string[];
  selectedIds: string[];
  calledIds: string[];
  currentIdx: number;
  startedAt: string;
  callCount: number;
  connectedCount: number;
}

export function saveSession(session: DialerSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

export function loadSession(): DialerSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DialerSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* non-fatal */
  }
}
