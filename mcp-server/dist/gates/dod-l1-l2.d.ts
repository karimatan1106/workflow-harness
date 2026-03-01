/**
 * DoD L1 (file existence) and L2 (exit code) checks.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { TaskState } from '../state/types.js';
import type { DoDCheckResult } from './dod-types.js';
export declare function checkL1FileExists(phase: string, docsDir: string, workflowDir: string): DoDCheckResult;
export declare function checkInputFilesExist(phase: string, docsDir: string, workflowDir: string): DoDCheckResult;
export declare function checkL2ExitCode(state: TaskState): DoDCheckResult;
/** TDD-1 (S2-16): test_impl must record at least one failing test run (Red phase evidence) */
export declare function checkTDDRedEvidence(state: TaskState, phase: string): DoDCheckResult;
//# sourceMappingURL=dod-l1-l2.d.ts.map