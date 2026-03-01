/**
 * DoD L4 artifact drift check: ART-1 (S2-6).
 * Detects when approved artifacts are modified after approval.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { TaskState } from '../state/types.js';
import type { DoDCheckResult } from './dod-types.js';
/** ART-1 (S2-6): Detect if approved artifacts have been modified since approval */
export declare function checkArtifactDrift(state: TaskState, phase: string): DoDCheckResult;
//# sourceMappingURL=dod-l4-art.d.ts.map