/**
 * TaskState TOON parser — converts .toon text to TaskState.
 * Delegates to official @toon-format/toon via adapter.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { TaskState } from './types.js';
import { toonDecodeSafe } from './toon-io-adapter.js';

export function parseState(content: string): TaskState | null {
  return toonDecodeSafe<TaskState>(content);
}
