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
    rows.push(row);
    i++;
  }
  return { cols, rows, consumed: i - startIdx };
}
