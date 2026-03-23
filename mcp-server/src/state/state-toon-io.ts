/**
 * TaskState TOON serialization.
 * Delegates to official @toon-format/toon via adapter.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { TaskState } from './types.js';
import { toonEncode } from './toon-io-adapter.js';

export function serializeState(state: TaskState): string {
  return toonEncode(state);
}

export { parseState } from './state-toon-parse.js';
