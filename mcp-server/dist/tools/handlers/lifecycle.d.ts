/**
 * Lifecycle handlers: harness_start, harness_status, harness_next.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { StateManager } from '../../state/manager.js';
import { type HandlerResult } from '../handler-shared.js';
export declare function handleHarnessStart(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessStatus(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessNext(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
//# sourceMappingURL=lifecycle.d.ts.map