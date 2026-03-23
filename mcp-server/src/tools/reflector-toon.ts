/**
 * TOON serializer/deserializer for the Reflector store.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { ReflectorStore } from './reflector-types.js';
import { toonEncode, toonDecodeSafe } from '../state/toon-io-adapter.js';

export function serializeStore(store: ReflectorStore): string {
  return toonEncode(store);
}

export function parseStore(content: string): ReflectorStore {
  const result = toonDecodeSafe<ReflectorStore>(content);
  if (result) return result;
  process.stderr.write('[warn] Failed to parse reflector-toon, returning default store\n');
  return { version: 3, nextLessonId: 1, lessons: [], stashedFailures: [] };
}
