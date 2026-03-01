/**
 * DoD L3 checks: artifact quality, RTM/AC completeness, baseline required.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { TaskState } from '../state/types.js';
import type { DoDCheckResult } from './dod-types.js';
export declare function checkL3Quality(phase: string, docsDir: string, workflowDir: string): DoDCheckResult;
export declare function checkRTMCompleteness(state: TaskState, phase: string): DoDCheckResult;
export declare function checkACCompleteness(state: TaskState, phase: string): DoDCheckResult;
export declare function checkArtifactFreshness(phase: string, docsDir: string): DoDCheckResult;
export declare function checkBaselineRequired(state: TaskState, phase: string): DoDCheckResult;
//# sourceMappingURL=dod-l3.d.ts.map