/**
 * TOON serializer/deserializer for the Reflector store.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { ReflectorLesson, StashedFailure, ReflectorStore } from './reflector-types.js';

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

export function serializeStore(store: ReflectorStore): string {
  const lines: string[] = [];
  lines.push(`version: ${store.version}`);
  lines.push(`nextLessonId: ${store.nextLessonId}`);
  lines.push('');
  const lc = store.lessons.length;
  lines.push(`lessons[${lc}]{id,phase,errorPattern,lesson,createdAt,hitCount,helpfulCount,harmfulCount,category,preventionRule}:`);
  for (const l of store.lessons) {
    const cols = [
      l.id, l.phase, esc(l.errorPattern), esc(l.lesson), l.createdAt,
      String(l.hitCount), String(l.helpfulCount), String(l.harmfulCount),
      l.category, l.preventionRule ? esc(l.preventionRule) : '',
    ];
    lines.push('  ' + cols.join(', '));
  }
  lines.push('');
  const sc = store.stashedFailures.length;
  lines.push(`stashedFailures[${sc}]{phase,taskId,errorPattern,errorMessage,retryCount,createdAt}:`);
  for (const f of store.stashedFailures) {
    const cols = [
      f.phase, f.taskId, esc(f.errorPattern), esc(f.errorMessage),
      String(f.retryCount), f.createdAt,
    ];
    lines.push('  ' + cols.join(', '));
  }
  return lines.join('\n') + '\n';
}

export function parseStore(content: string): ReflectorStore {
  const store: ReflectorStore = { version: 3, nextLessonId: 1, lessons: [], stashedFailures: [] };
  const lines = content.split('\n');
  let section: 'none' | 'lessons' | 'stashed' = 'none';
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === '') continue;
    if (line.startsWith('version: ')) continue;
    if (line.startsWith('nextLessonId: ')) { store.nextLessonId = parseInt(line.slice(14), 10); continue; }
    if (line.startsWith('lessons[')) { section = 'lessons'; continue; }
    if (line.startsWith('stashedFailures[')) { section = 'stashed'; continue; }
    if (!line.startsWith('  ')) continue;
    const cells = splitRow(line.trim());
    if (section === 'lessons' && cells.length >= 9) {
      store.lessons.push({
        id: cells[0], phase: cells[1], errorPattern: cells[2], lesson: cells[3],
        createdAt: cells[4], hitCount: parseInt(cells[5], 10),
        helpfulCount: parseInt(cells[6], 10), harmfulCount: parseInt(cells[7], 10),
        category: cells[8] as ReflectorLesson['category'],
        preventionRule: cells[9] && cells[9] !== '' ? cells[9] : undefined,
      });
    } else if (section === 'stashed' && cells.length >= 6) {
      store.stashedFailures.push({
        phase: cells[0], taskId: cells[1], errorPattern: cells[2],
        errorMessage: cells[3], retryCount: parseInt(cells[4], 10), createdAt: cells[5],
      });
    }
  }
  return store;
}
