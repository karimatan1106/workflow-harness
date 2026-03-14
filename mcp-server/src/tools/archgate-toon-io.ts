/**
 * TOON I/O for archgate rule store — serialize and parse archgate-rules.toon.
 * TOON format: key-value pairs + table arrays, no nested objects.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { ArchRule, ArchCheckType, ArchRuleStore } from './archgate.js';

function esc(v: string): string {
  if (v.includes(',') || v.includes('"')) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === ',') { out.push(cur.trim()); cur = ''; }
    else if (ch === '"') inQ = true;
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const RULE_COLS = 'id,adrId,description,checkType,threshold,pattern,glob,createdAt';

export function serializeRuleStore(store: ArchRuleStore): string {
  const L: string[] = [];
  L.push('version: 1');
  L.push('');
  const n = store.rules.length;
  L.push(`rules[${n}]{${RULE_COLS}}:`);
  for (const r of store.rules) {
    const threshold = r.threshold !== undefined ? String(r.threshold) : '';
    const pattern = r.pattern ? esc(r.pattern) : '';
    const glob = r.glob ? esc(r.glob) : '';
    L.push(`  ${esc(r.id)}, ${esc(r.adrId)}, ${esc(r.description)}, ${r.checkType}, ${threshold}, ${pattern}, ${glob}, ${r.createdAt}`);
  }
  L.push('');
  return L.join('\n');
}

/** N-27: Feedback speed layers for PostToolUse - CI - human-review pipeline */
export const FEEDBACK_SPEED_LAYERS = {
  ms: { name: 'PostToolUse', tools: ['biome', 'oxlint', 'tsc'], maxTime: '100ms' },
  s: { name: 'pre-commit', tools: ['lefthook', 'full-lint', 'type-check'], maxTime: '10s' },
  min: { name: 'CI', tools: ['vitest', 'playwright', 'build'], maxTime: '5min' },
  h: { name: 'human-review', tools: ['code-review', 'acceptance'], maxTime: 'async' },
} as const;

export function parseRuleStore(content: string): ArchRuleStore {
  const store: ArchRuleStore = { version: 1, rules: [] };
  const lines = content.split('\n');
  let inTable = false;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) { inTable = false; continue; }
    const hdr = trimmed.match(/^rules\[\d+]\{[^}]+}:$/);
    if (hdr) { inTable = true; continue; }
    if (inTable && raw.startsWith('  ')) {
      const v = splitCsvRow(trimmed);
      const rule: ArchRule = {
        id: v[0],
        adrId: v[1],
        description: v[2],
        checkType: v[3] as ArchCheckType,
        createdAt: v[7],
      };
      if (v[4]) rule.threshold = Number(v[4]);
      if (v[5]) rule.pattern = v[5];
      if (v[6]) rule.glob = v[6];
      store.rules.push(rule);
    }
  }
  return store;
}
