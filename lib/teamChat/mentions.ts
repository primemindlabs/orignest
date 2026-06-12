// Phase 88 — PURE @mention parsing for team chat. Given the raw message body and the
// org's team members, returns the profiles.id of everyone @mentioned. No DB, no I/O —
// trivially testable. Matches "@First", "@FirstLast", "@First.Last" (case-insensitive),
// preferring the longest unique handle so "@JohnSmith" beats a stray "@John".

export interface MentionMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

/** Normalize a name into the comparable handle form used in message bodies. */
function handle(first: string | null, last: string | null): string {
  return `${first ?? ''}${last ?? ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function firstHandle(first: string | null): string {
  return (first ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function parseMentions(body: string, members: MentionMember[]): string[] {
  if (!body.includes('@')) return [];
  // Capture the alnum run after each '@' (a user types "@JohnSmith" or "@John").
  const tokens = Array.from(body.matchAll(/@([a-z0-9.]+)/gi)).map((m) =>
    m[1].toLowerCase().replace(/[^a-z0-9]/g, ''),
  );
  if (tokens.length === 0) return [];

  const ids = new Set<string>();
  for (const token of tokens) {
    if (!token) continue;
    // Prefer a full first+last handle match; fall back to a unique first-name match.
    const full = members.find((m) => handle(m.first_name, m.last_name) === token);
    if (full) {
      ids.add(full.id);
      continue;
    }
    const firstMatches = members.filter((m) => firstHandle(m.first_name) === token);
    if (firstMatches.length === 1) ids.add(firstMatches[0].id);
    // Ambiguous first-name-only mentions are intentionally skipped (no wrong-pings).
  }
  return Array.from(ids);
}
