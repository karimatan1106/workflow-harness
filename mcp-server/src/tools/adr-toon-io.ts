/**
 * TOON I/O for ADR store — serialize and parse adr-store.toon.
 * TOON format: key-value pairs + table arrays, no nested objects.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { ADRStore, ADREntry, ADRStatus } from './adr.js';
import { esc, parseCsvRow } from '../state/toon-helpers.js';

const ADR_COLS = 'id,statement,rationale,context,status,taskId,createdAt,updatedAt,supersededBy,deprecatedReason';

export function serializeADRStore(store: ADRStore): string {
  const L: string[] = [];
  L.push('version: 1');
  L.push('');
  const n = store.entries.length;
  L.push(`entries[${n}]{${ADR_COLS}}:`);
  for (const e of store.entries) {
    L.push(`  ${esc(e.id)}, ${esc(e.statement)}, ${esc(e.rationale)}, ${esc(e.context)}, ${e.status}, ${esc(e.taskId)}, ${e.createdAt}, ${e.updatedAt}, ${e.supersededBy ?? ''}, ${e.deprecatedReason ? esc(e.deprecatedReason) : ''}`);
  }
  L.push('');
  return L.join('\n');
}

export function parseADRStore(content: string): ADRStore {
  try {
    const store: ADRStore = { version: 1, entries: [] };
    const lines = content.split('\n');
    let inTable = false;
    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed) { inTable = false; continue; }
      const hdr = trimmed.match(/^entries\[\d+]\{[^}]+}:$/);
      if (hdr) { inTable = true; continue; }
      if (inTable && raw.startsWith('  ')) {
        const v = parseCsvRow(trimmed);
        const entry: ADREntry = {
          id: v[0],
          statement: v[1],
          rationale: v[2],
          context: v[3],
          status: v[4] as ADRStatus,
          taskId: v[5],
          createdAt: v[6],
          updatedAt: v[7],
        };
        if (v[8]) entry.supersededBy = v[8];
        if (v[9]) entry.deprecatedReason = v[9];
        store.entries.push(entry);
      }
    }
    return store;
  } catch (e) {
    process.stderr.write(`[warn] Failed to parse adr-toon-io: ${e instanceof Error ? e.message : String(e)}\n`);
    return { version: 1, entries: [] };
  }
}
