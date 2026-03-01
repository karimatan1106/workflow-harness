/**
 * Query handlers: get_test_info, record_known_bug, get_known_bugs,
 * get_subphase_template, pre_validate, update_ac_status, update_rtm_status.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { StateManager } from '../../state/manager.js';
import { type HandlerResult } from '../handler-shared.js';
export declare function handleHarnessGetTestInfo(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessRecordKnownBug(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessGetKnownBugs(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessGetSubphaseTemplate(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessPreValidate(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessUpdateAcStatus(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessUpdateRtmStatus(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
//# sourceMappingURL=query.d.ts.map