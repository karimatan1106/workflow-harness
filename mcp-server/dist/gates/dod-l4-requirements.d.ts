/**
 * DoD L4 requirements checks: AC format (IA-2), NOT_IN_SCOPE (IA-2), OPEN_QUESTIONS (IA-1).
 * @spec docs/spec/features/workflow-harness.md
 */
import type { TaskState } from '../state/types.js';
import type { DoDCheckResult } from './dod-types.js';
export declare function checkACFormat(state: TaskState, phase: string, docsDir: string): DoDCheckResult;
export declare function checkNotInScope(state: TaskState, phase: string, docsDir: string): DoDCheckResult;
export declare function checkIntentConsistency(state: TaskState, phase: string, docsDir: string): DoDCheckResult;
export declare function checkOpenQuestions(state: TaskState, phase: string, docsDir: string): DoDCheckResult;
//# sourceMappingURL=dod-l4-requirements.d.ts.map