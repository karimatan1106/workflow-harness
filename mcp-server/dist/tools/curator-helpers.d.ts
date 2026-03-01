/**
 * Curator helper utilities — pattern normalization, scoring, and report persistence.
 * @spec docs/spec/features/workflow-harness.md
 */
export interface CuratorAction {
    action: 'pruned' | 'merged' | 'kept';
    phase: string;
    errorPattern: string;
    reason: string;
}
export interface CuratorReport {
    timestamp: string;
    taskId: string;
    taskName: string;
    lessonsBefore: number;
    lessonsAfter: number;
    stashedBefore: number;
    stashedAfter: number;
    actions: CuratorAction[];
}
/**
 * Compute quality score for a lesson based on helpful/harmful counts.
 * Returns 0.5 as the neutral initial score when both counts are zero.
 * For all other cases: helpfulCount / (helpfulCount + harmfulCount + 1)
 */
export declare function computeQualityScore(helpfulCount: number, harmfulCount: number): number;
/**
 * Normalize an error pattern for deduplication.
 * Strips numbers, whitespace variations, and truncates.
 */
export declare function normalizePattern(pattern: string): string;
/**
 * Compute similarity between two patterns (0.0 to 1.0).
 * Used to detect near-duplicate lessons during deduplication.
 */
export declare function computePatternSimilarity(a: string, b: string): number;
/**
 * Save curator report to the log file (keeps last 20 reports).
 */
export declare function saveCuratorReport(report: CuratorReport): void;
//# sourceMappingURL=curator-helpers.d.ts.map