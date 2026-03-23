/**
 * TOON I/O for ACE cross-task knowledge store (ace-context.toon).
 * Uses official @toon-format/toon via toon-io-adapter.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { AceBullet } from './ace-context.js';
import { toonEncode, toonDecodeSafe } from '../state/toon-io-adapter.js';

export function serializeBullets(bullets: AceBullet[]): string {
  return toonEncode(bullets);
}

export function parseBullets(content: string): AceBullet[] {
  const result = toonDecodeSafe<AceBullet[]>(content);
  if (result !== null && Array.isArray(result)) return result;
  process.stderr.write('[warn] Failed to parse ace-context-toon: decode returned null\n');
  return [];
}
