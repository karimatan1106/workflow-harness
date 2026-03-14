/**
 * TOON I/O for ACE cross-task knowledge store (ace-context.toon).
 * Table: bullets[N]{id,content,category,phase,helpfulCount,harmfulCount,createdAt}
 * @spec docs/spec/features/workflow-harness.md
 */

import type { AceBullet } from './ace-context.js';

/** Quote a value if it contains comma or double-quote. */
function esc(v: string): string {
  if (v.includes(',') || v.includes('"')) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

/** Remove surrounding quotes and unescape doubled quotes. */
function unesc(v: string): string {
  const t = v.trim();
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/""/g, '"');
  return t;
}

/** Split a TOON CSV row respecting quoted values. */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && i + 1 < line.length && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; cur += '"'; }
    } else if (ch === ',' && !inQ) {
      cells.push(cur);
      cur = '';
      if (line[i + 1] === ' ') i++;
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map(c => unesc(c));
}

export function serializeBullets(bullets: AceBullet[]): string {
  const lines: string[] = [];
  lines.push(`bullets[${bullets.length}]{id,content,category,phase,helpfulCount,harmfulCount,createdAt}:`);
  for (const b of bullets) {
    const cols = [
      b.id, esc(b.content), b.category, b.phase,
      String(b.helpfulCount), String(b.harmfulCount), b.createdAt,
    ];
    lines.push('  ' + cols.join(', '));
  }
  return lines.join('\n') + '\n';
}

export function parseBullets(content: string): AceBullet[] {
  const bullets: AceBullet[] = [];
  const lines = content.split('\n');
  let inTable = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === '') continue;
    if (line.startsWith('bullets[')) { inTable = true; continue; }
    if (!line.startsWith('  ') && inTable) { inTable = false; continue; }
    if (!inTable || !line.startsWith('  ')) continue;
    const cells = splitRow(line.trim());
    if (cells.length >= 7) {
      bullets.push({
        id: cells[0],
        content: cells[1],
        category: cells[2] as AceBullet['category'],
        phase: cells[3],
        helpfulCount: parseInt(cells[4], 10),
        harmfulCount: parseInt(cells[5], 10),
        createdAt: cells[6],
      });
    }
  }
  return bullets;
}
