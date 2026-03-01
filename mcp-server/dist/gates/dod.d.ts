/**
 * Definition of Done (DoD) gate system - orchestrator.
 * Delegates to dod-l1-l2.ts, dod-l3.ts, dod-l4-*.ts modules.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { TaskState } from '../state/types.js';
export type { DoDCheckResult, DoDResult } from './dod-types.js';
/**
 * Run all DoD checks for the current phase of a task.
 * Returns a DoDResult with individual check results and an overall passed flag.
 */
export declare function runDoDChecks(state: TaskState, docsDir: string): Promise<import('./dod-types.js').DoDResult>;
export declare function formatDoDResult(result: import('./dod-types.js').DoDResult): string;
//# sourceMappingURL=dod.d.ts.map