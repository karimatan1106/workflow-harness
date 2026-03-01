/**
 * Shared helpers for dod.ts test files.
 * Import these into each dod-*.test.ts file.
 */
import type { TaskState } from '../state/types.js';
export declare function createTempDir(): {
    tempDir: string;
    docsDir: string;
};
export declare function removeTempDir(tempDir: string): void;
export declare function makeMinimalState(phase: string, workflowDir: string, docsDir: string): TaskState;
/**
 * Build a valid TOON artifact with the specified keys and enough content
 * to pass L3 quality checks (minLines threshold via content chars).
 */
export declare function buildValidArtifact(keys: string[], linesPerSection?: number): string;
/**
 * Build a TOON artifact for requirements phase with acceptanceCriteria, notInScope, openQuestions.
 */
export declare function buildValidRequirementsToon(opts: {
    acCount?: number;
    hasNotInScope?: boolean;
    hasOpenQuestions?: boolean;
    extraContent?: string;
    userIntent?: string;
}): string;
//# sourceMappingURL=dod-test-helpers.d.ts.map