/**
 * TOON serializer/parser for DCI (Design-Code Index).
 * Delegates to @toon-format/toon via toon-io-adapter.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { DCIIndex } from './types.js';
import { toonEncode, toonDecodeSafe } from '../state/toon-io-adapter.js';

export function serializeDCI(index: DCIIndex): string {
  return toonEncode(index);
}

export function parseDCI(content: string): DCIIndex {
  const result = toonDecodeSafe<DCIIndex>(content);
  if (result) return result;
  return {
    version: '1',
    generatedAt: '',
    projectRoot: '',
    codeToDesign: {},
    designToCode: {},
    orphans: { codeWithoutSpec: [], specWithoutCode: [] },
  };
}
