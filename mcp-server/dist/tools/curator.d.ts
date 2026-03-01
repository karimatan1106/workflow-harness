/**
 * Curator — prunes stale/duplicate memory entries after task completion.
 * Inspired by ACE paper (arXiv 2510.04618) Generator→Reflector→Curator pipeline.
 *
 * Design:
 * - Triggered after harness_next returns "completed" phase
 * - Scans reflector-log.json for stale lessons (old, low quality score)
 * - Deduplicates lessons with similar errorPatterns (fuzzy threshold 0.7)
 * - Prunes lessons that reference deleted phases or obsolete patterns
 * - Keeps reflector-log.json lean for fast injection
 *
 * @spec docs/spec/features/workflow-harness.md
 */
import type { CuratorReport } from './curator-helpers.js';
export type { CuratorReport, CuratorAction } from './curator-helpers.js';
/**
 * Run the Curator cycle. Called when a task reaches "completed" phase.
 * Returns a report of actions taken for logging.
 */
export declare function runCuratorCycle(taskId: string, taskName: string): CuratorReport;
//# sourceMappingURL=curator.d.ts.map