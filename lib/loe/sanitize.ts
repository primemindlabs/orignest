/**
 * Phase 62.1 — LOE text sanitizer. PURE. Strips anything that must never appear in
 * a Letter of Explanation even if the model emits it: SSN patterns, DOB-like years,
 * and long account-number runs.
 */
export function sanitizeLOEText(text: string): string {
  let t = text ?? '';
  t = t.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED]');     // SSN XXX-XX-XXXX
  t = t.replace(/\b\d{9}\b/g, '[REDACTED]');                  // bare 9-digit SSN
  t = t.replace(/\b\d{8,17}\b/g, '****');                     // account numbers
  return t.trim();
}
