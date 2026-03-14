/**
 * Shared TOON format I/O helpers — escape, split, parse utilities.
 * TOON: key-value pairs + table arrays, no nested objects, no backslashes.
 * @spec docs/spec/features/workflow-harness.md
 */

/** Quote a value if it contains comma or double-quote. */
export function esc(v: string): string {
  if (v.includes(',') || v.includes('"')) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

/** Remove surrounding quotes and unescape doubled quotes. */
export function unesc(v: string): string {
  const t = v.trim();
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/""/g, '"');
  return t;
}

/** Split a TOON CSV row respecting quoted values. */
export function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && i + 1 < line.length && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; cur += '"'; }
    } else if (ch === ',' && !inQ) {
      cells.push(cur);
      cur = '';
      if (line[i + 1] === ' ') i++; // skip space after comma
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map(c => unesc(c));
}

/** Parse key-value line. Returns [key, value] or null. */
export function parseKV(line: string): [string, string] | null {
  const m = line.match(/^(\w+):\s*(.*)$/);
  return m ? [m[1], m[2]] : null;
}

/** Detect table header. Returns { name, count, cols } or null. */
export function parseTableHeader(line: string): { name: string; count: number; cols: string[] } | null {
  const m = line.match(/^(\w+)\[(\d+)]\{([^}]+)}:$/);
  if (!m) return null;
  return { name: m[1], count: Number(m[2]), cols: m[3].split(',').map(c => c.trim()) };
}

/** Detect list header (table without columns). Returns { name, count } or null. */
export function parseListHeader(line: string): { name: string; count: number } | null {
  const m = line.match(/^(\w+)\[(\d+)]:$/);
  if (!m) return null;
  return { name: m[1], count: Number(m[2]) };
}
