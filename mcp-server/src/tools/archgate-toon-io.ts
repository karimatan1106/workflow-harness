/**
 * TOON I/O for archgate rule store -- serialize and parse archgate-rules.toon.
 * Uses official @toon-format/toon via toon-io-adapter.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { ArchRuleStore } from './archgate.js';
import { toonEncode, toonDecodeSafe } from '../state/toon-io-adapter.js';

/** N-27: Feedback speed layers for PostToolUse - CI - human-review pipeline */
export const FEEDBACK_SPEED_LAYERS = {
  ms: { name: 'PostToolUse', tools: ['biome', 'oxlint', 'tsc'], maxTime: '100ms' },
  s: { name: 'pre-commit', tools: ['lefthook', 'full-lint', 'type-check'], maxTime: '10s' },
  min: { name: 'CI', tools: ['vitest', 'playwright', 'build'], maxTime: '5min' },
  h: { name: 'human-review', tools: ['code-review', 'acceptance'], maxTime: 'async' },
} as const;

export function serializeRuleStore(store: ArchRuleStore): string {
  return toonEncode(store);
}

export function parseRuleStore(content: string): ArchRuleStore {
  const result = toonDecodeSafe<ArchRuleStore>(content);
  if (result !== null) return result;
  process.stderr.write('[warn] Failed to parse archgate-toon-io: decode returned null\n');
  return { version: 1, rules: [] };
}
