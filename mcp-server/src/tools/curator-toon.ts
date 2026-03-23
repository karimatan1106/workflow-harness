/**
 * TOON I/O for curator log (curator-log.toon).
 * Uses official @toon-format/toon via toon-io-adapter.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { CuratorReport } from './curator-helpers.js';
import { toonEncode, toonDecodeSafe } from '../state/toon-io-adapter.js';

export function serializeReports(reports: CuratorReport[]): string {
  return toonEncode(reports);
}

export function parseReports(content: string): CuratorReport[] {
  const result = toonDecodeSafe<CuratorReport[]>(content);
  if (result !== null && Array.isArray(result)) return result;
  process.stderr.write('[warn] Failed to parse curator-toon: decode returned null\n');
  return [];
}
