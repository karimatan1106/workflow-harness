/**
 * DoD L4 commit-phase checks: DEP-1 (S3-9) package.json/lock sync.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { DoDCheckResult } from './dod-types.js';
/**
 * DEP-1 (S3-9): Detect when package.json is newer than package-lock.json.
 * Accepts optional cwd for testability.
 */
export declare function checkPackageLockSync(phase: string, cwd?: string): DoDCheckResult;
//# sourceMappingURL=dod-l4-commit.d.ts.map