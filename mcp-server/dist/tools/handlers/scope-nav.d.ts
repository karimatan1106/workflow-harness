/**
 * Scope and navigation handlers: harness_set_scope, harness_complete_sub, harness_back, harness_reset.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { StateManager } from '../../state/manager.js';
import { type HandlerResult } from '../handler-shared.js';
export declare function handleHarnessSetScope(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessCompleteSub(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessBack(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessReset(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
//# sourceMappingURL=scope-nav.d.ts.map