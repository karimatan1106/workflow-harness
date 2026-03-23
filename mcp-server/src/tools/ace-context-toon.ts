/**
 * TOON I/O for ACE cross-task knowledge store (ace-context.toon).
 * Table: bullets[N]{id,content,category,phase,helpfulCount,harmfulCount,createdAt}
 * @spec docs/spec/features/workflow-harness.md
 */

import type { AceBullet } from './ace-context.js';
import { esc, parseCsvRow } from '../state/toon-helpers.js';

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
  try {
    const bullets: AceBullet[] = [];
    const lines = content.split('\n');
    let inTable = false;
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (line === '') continue;
      if (line.startsWith('bullets[')) { inTable = true; continue; }
      if (!line.startsWith('  ') && inTable) { inTable = false; continue; }
      if (!inTable || !line.startsWith('  ')) continue;
      const cells = parseCsvRow(line.trim());
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
  } catch (e) {
    process.stderr.write(`[warn] Failed to parse ace-context-toon: ${e instanceof Error ? e.message : String(e)}\n`);
    return [];
  }
}
