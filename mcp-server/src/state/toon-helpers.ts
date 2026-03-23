/**
 * TOON format helpers — escape, unescape, table array serialization.
 * TOON rules: key: value (colon-space), no backslashes, no nested objects.
 * Comma-containing values double-quoted, inner quotes doubled.
 * Arrays as semicolon-separated within a single cell.
 * @spec docs/spec/features/workflow-harness.md
 */

/** Escape a value for TOON CSV cell. Double-quote if contains comma/newline. */
export function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('\n') || s.includes('"')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Unescape a TOON CSV cell. */
export function unesc(s: string): string {
  s = s.trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/""/g, '"');
  }
  return s;
}

/** Join array as semicolon-separated string. */
export function toSemiList(arr: unknown[]): string {
  return arr.map(v => String(v)).join(';');
}

/** Parse semicolon-separated string to string array. */
export function fromSemiList(s: string): string[] {
  if (!s || s.trim() === '') return [];
  return s.split(';').map(v => v.trim());
}

/** Parse a CSV row respecting double-quoted fields. */
export function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  cells.push(current.trim());
  return cells;
}

/** Serialize a table array header. */
export function tableHeader(name: string, count: number, cols: string[]): string {
  return `${name}[${count}]{${cols.join(',')}}:`;
}

/** Serialize rows for a table array (indented CSV). */
export function tableRows(rows: string[][]): string {
  return rows.map(row => '  ' + row.map(c => esc(c)).join(', ')).join('\n');
}

/**
 * Parse TOON key-value pairs from a multi-line string.
 * Skips empty lines, indented lines (table rows), and table header lines.
 * Quoted values are unescaped via unesc().
 */
export function parseToonKv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!content) return result;
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    if (line.startsWith('  ')) continue;
    if (/^\S+\[\d+\]\{[^}]+\}:\s*$/.test(line)) continue;
    const sepIdx = line.indexOf(': ');
    if (sepIdx === -1) continue;
    const key = line.slice(0, sepIdx).trim();
    result[key] = unesc(line.slice(sepIdx + 2));
  }
  return result;
}

/**
 * Parse a table array block from lines starting at given index.
 * Returns parsed rows and how many lines consumed.
 */
export function parseTableBlock(
  lines: string[], startIdx: number,
): { cols: string[]; rows: string[][]; consumed: number } {
  const headerLine = lines[startIdx];
  const match = headerLine.match(/^(\S+)\[(\d+)\]\{([^}]+)\}:\s*$/);
  if (!match) return { cols: [], rows: [], consumed: 1 };
  const cols = match[3].split(',').map(c => c.trim());
  const rows: string[][] = [];
  let i = startIdx + 1;
  while (i < lines.length && lines[i].startsWith('  ')) {
    const row = parseCsvRow(lines[i].trim());
    // Resilient handling: if unquoted commas in the last field produced
    // extra cells, join the surplus back into the final column.
    if (row.length > cols.length) {
      const fixed = row.slice(0, cols.length - 1);
      fixed.push(row.slice(cols.length - 1).join(', '));
      rows.push(fixed);
    } else {
      rows.push(row);
    }
    i++;
  }
  return { cols, rows, consumed: i - startIdx };
}

/** Parse a single TOON key-value line. Returns [key, value] or null. */
export function parseKV(line: string): [string, string] | null {
  const m = line.match(/^(\w+):\s*(.*)$/);
  return m ? [m[1], m[2]] : null;
}

/** Detect list header (e.g. `name[3]:`). Returns { name, count } or null. */
export function parseListHeader(line: string): { name: string; count: number } | null {
  const m = line.match(/^(\w+)\[(\d+)]:$/);
  if (!m) return null;
  return { name: m[1], count: Number(m[2]) };
}
