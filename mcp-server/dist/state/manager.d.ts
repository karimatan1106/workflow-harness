/**
 * StateManager — thin orchestrator delegating to manager-read / manager-write
 * @spec docs/spec/features/workflow-harness.md
 */
import type { TaskState, PhaseName, TaskSize, AcceptanceCriterion, RTMEntry, ProofEntry } from './types.js';
export declare class StateManager {
    private hmacKey;
    constructor();
    createTask(taskName: string, userIntent: string, files?: string[], dirs?: string[]): TaskState;
    loadTask(taskId: string): TaskState | null;
    advancePhase(taskId: string): {
        success: boolean;
        nextPhase?: PhaseName;
        error?: string;
    };
    approveGate(taskId: string, approvalType: string): {
        success: boolean;
        error?: string;
    };
    completeSubPhase(taskId: string, subPhase: string): {
        success: boolean;
        error?: string;
    };
    goBack(taskId: string, targetPhase: PhaseName): {
        success: boolean;
        error?: string;
    };
    resetTask(taskId: string, targetPhase: PhaseName, reason: string): {
        success: boolean;
        error?: string;
    };
    addAcceptanceCriterion(taskId: string, criterion: AcceptanceCriterion): boolean;
    addRTMEntry(taskId: string, entry: RTMEntry): boolean;
    recordFeedback(taskId: string, feedback: string): boolean;
    recordBaseline(taskId: string, totalTests: number, passedTests: number, failedTests: string[]): boolean;
    recordTestResult(taskId: string, exitCode: number, output: string, summary?: string): boolean;
    addProof(taskId: string, entry: ProofEntry): boolean;
    updateScope(taskId: string, files: string[], dirs: string[], glob?: string, addMode?: boolean): boolean;
    listTasks(): Array<{
        taskId: string;
        taskName: string;
        phase: PhaseName;
        size: TaskSize;
    }>;
    recordTestFile(taskId: string, testFile: string): boolean;
    getTestInfo(taskId: string): {
        testFiles: string[];
        baseline: TaskState['baseline'] | null;
    } | null;
    updateAcceptanceCriterionStatus(taskId: string, acId: string, status: 'open' | 'met' | 'not_met', testCaseId?: string): boolean;
    updateRTMEntryStatus(taskId: string, rtmId: string, status: 'pending' | 'implemented' | 'tested' | 'verified', codeRef?: string, testRef?: string): boolean;
    recordKnownBug(taskId: string, bug: {
        testName: string;
        description: string;
        severity: string;
        targetPhase?: string;
        issueUrl?: string;
    }): boolean;
    getKnownBugs(taskId: string): Array<{
        testName: string;
        description: string;
        severity: string;
        targetPhase?: string;
        issueUrl?: string;
        recordedAt: string;
    }>;
    incrementRetryCount(taskId: string, phase: string): number;
    getRetryCount(taskId: string, phase: string): number;
    resetRetryCount(taskId: string, phase: string): void;
    recordArtifactHash(taskId: string, fp: string, hash: string): boolean;
}
//# sourceMappingURL=manager.d.ts.map