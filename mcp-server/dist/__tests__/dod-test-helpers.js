/**
 * Shared helpers for dod.ts test files.
 * Import these into each dod-*.test.ts file.
 */
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export function createTempDir() {
    const tempDir = mkdtempSync(join(tmpdir(), 'dod-test-'));
    const docsDir = join(tempDir, 'docs');
    mkdirSync(docsDir, { recursive: true });
    return { tempDir, docsDir };
}
export function removeTempDir(tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
}
export function makeMinimalState(phase, workflowDir, docsDir) {
    return {
        taskId: '00000000-0000-4000-8000-000000000001',
        taskName: 'test-task',
        version: 4,
        phase: phase,
        completedPhases: [],
        skippedPhases: [],
        size: 'small',
        riskScore: { total: 0, factors: { fileCount: 0, hasTests: false, hasConfig: false, hasInfra: false, hasSecurity: false, hasDatabase: false, codeLineEstimate: 0 } },
        userIntent: 'This is a test task with sufficient user intent text',
        openQuestions: [],
        notInScope: [],
        scopeFiles: [],
        scopeDirs: [],
        plannedFiles: [],
        acceptanceCriteria: [],
        rtmEntries: [],
        proofLog: [],
        checkpoint: {
            taskId: '00000000-0000-4000-8000-000000000001',
            phase: phase,
            completedPhases: [],
            timestamp: new Date().toISOString(),
            sha256: '',
            userIntent: 'This is a test task with sufficient user intent text',
            scopeFiles: [],
            acceptanceCriteria: [],
            rtmEntries: [],
        },
        docsDir,
        workflowDir,
        sessionToken: 'a'.repeat(64),
        stateIntegrity: 'fake-integrity-for-tests',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}
export function buildValidArtifact(sections, linesPerSection = 20) {
    const lines = [];
    for (const section of sections) {
        lines.push(section);
        const sectionName = section.replace(/^#+\s*/, '').replace(/\s+/g, '_');
        for (let i = 1; i <= linesPerSection; i++) {
            lines.push(`Content line ${i} for ${sectionName}: providing real substantive information about the topic in detail.`);
        }
        lines.push('');
    }
    return lines.join('\n');
}
//# sourceMappingURL=dod-test-helpers.js.map