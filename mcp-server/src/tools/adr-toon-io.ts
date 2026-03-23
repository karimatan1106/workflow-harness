/**
 * TOON I/O for ADR store -- serialize and parse adr-store.toon.
 * Uses official @toon-format/toon via toon-io-adapter.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { ADRStore } from './adr.js';
import { toonEncode, toonDecodeSafe } from '../state/toon-io-adapter.js';

export function serializeADRStore(store: ADRStore): string {
  return toonEncode(store);
}

export function parseADRStore(content: string): ADRStore {
  const result = toonDecodeSafe<ADRStore>(content);
  if (result !== null) return result;
  process.stderr.write('[warn] Failed to parse adr-toon-io: decode returned null\n');
  return { version: 1, entries: [] };
}
