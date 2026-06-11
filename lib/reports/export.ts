/**
 * Phase 78 — client-side report exports. No server route, no library.
 */

/** Download an array of flat objects as a CSV file. */
export function exportToCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Print the current report area to PDF via the browser print dialog. */
export function exportToPDF(title: string) {
  const prev = document.title;
  document.title = title;
  window.print();
  // Restore after the print dialog settles.
  setTimeout(() => {
    document.title = prev;
  }, 500);
}
