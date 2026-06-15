/**
 * Phase 138 — robustly coerce an LLM post response into clean post text.
 *
 * The model is asked for minified JSON ({"post_text":...}) but sometimes wraps it
 * in a ```json fence or adds prose. A naive JSON.parse then fails and the raw
 * `json { "post_text": ... }` string leaked into the rendered post. This handles
 * fences + first-object extraction, and also cleans already-saved leaked rows at
 * render time.
 */

/** Strip a leading/trailing markdown code fence (```json … ```). */
export function stripCodeFences(s: string): string {
  return s
    .replace(/^\s*```[a-zA-Z0-9]*\s*\n?/, '')
    .replace(/\n?\s*```\s*$/, '')
    .trim();
}

interface ParsedPost {
  post_text: string;
  hashtags: string | null;
  image_prompt: string | null;
}

/**
 * Parse a model response (possibly fenced / prose-wrapped) into structured fields.
 * Returns null if no usable post_text could be extracted.
 */
export function parsePostJson(raw: string): ParsedPost | null {
  const cleaned = stripCodeFences(raw.trim());
  const candidates = [cleaned, cleaned.match(/\{[\s\S]*\}/)?.[0]].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed.post_text === 'string' && parsed.post_text.trim()) {
        return {
          post_text: parsed.post_text.trim(),
          hashtags: typeof parsed.hashtags === 'string' ? parsed.hashtags : null,
          image_prompt: typeof parsed.image_prompt === 'string' ? parsed.image_prompt : null,
        };
      }
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

/**
 * Render-time guard: given whatever is stored in post_text, return clean display
 * text — extracting post_text from any leaked JSON/fenced blob from older rows.
 */
export function cleanPostText(stored: string | null | undefined): string {
  if (!stored) return '';
  const looksLikeJson = /"post_text"\s*:/.test(stored) || /^\s*```/.test(stored) || /^\s*json\s*[{]/i.test(stored);
  if (looksLikeJson) {
    const parsed = parsePostJson(stored);
    if (parsed) return parsed.post_text;
    // Last resort: pull the post_text value out by regex.
    const m = stored.match(/"post_text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (m) {
      try {
        return JSON.parse(`"${m[1]}"`);
      } catch {
        return m[1];
      }
    }
  }
  return stored;
}
