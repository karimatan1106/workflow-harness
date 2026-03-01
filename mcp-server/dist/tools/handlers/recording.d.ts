/**
 * Recording handlers: record_proof, add_ac, add_rtm, record_feedback,
 * capture_baseline, record_test_result, record_test.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { StateManager } from '../../state/manager.js';
import { type HandlerResult } from '../handler-shared.js';
export declare function handleHarnessRecordProof(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessAddAc(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessAddRtm(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessRecordFeedback(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessCaptureBaseline(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessRecordTestResult(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
export declare function handleHarnessRecordTest(args: Record<string, unknown>, sm: StateManager): Promise<HandlerResult>;
//# sourceMappingURL=recording.d.ts.map