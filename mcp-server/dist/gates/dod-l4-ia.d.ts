/**
 * DoD L4 Intent Accuracy checks: IA-3 (AC→design), IA-4 (AC→TC), IA-5 (AC Achievement).
 * @spec docs/spec/features/workflow-harness.md
 */
import type { TaskState } from '../state/types.js';
import type { DoDCheckResult } from './dod-types.js';
/** IA-3: design_review artifact must contain acDesignMapping key in TOON */
export declare function checkAcDesignMapping(state: TaskState, phase: string, docsDir: string): DoDCheckResult;
/** IA-4: test_design artifact must contain acTcMapping key in TOON */
export declare function checkAcTcMapping(phase: string, docsDir: string): DoDCheckResult;
/** CRV-1 (S3-30): test-design.toon must have TC count >= AC count */
export declare function checkTCCoverage(state: TaskState, phase: string, docsDir: string): DoDCheckResult;
/** IA-5: code_review artifact must contain acAchievementStatus key with no not_met entries */
export declare function checkAcAchievementTable(phase: string, docsDir: string): DoDCheckResult;
//# sourceMappingURL=dod-l4-ia.d.ts.map