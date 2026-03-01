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
export declare function buildValidArtifact(sections: string[], linesPerSection?: number): string;
//# sourceMappingURL=dod-test-helpers.d.ts.map