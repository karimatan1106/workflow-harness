/**
 * TaskState type definition + re-exports from types-core.ts
 * @spec docs/spec/features/workflow-harness.md
 */
export type { ControlLevel, DoDCheck, GateContext, PhaseName, TaskSize, RiskScore, ParallelGroupName, ApprovalType, RTMEntry, AcceptanceCriterion, ProofEntry, Checkpoint, SubPhaseStatus, PhaseConfig, } from './types-core.js';
export { PHASE_NAMES, PARALLEL_GROUPS, APPROVAL_GATES, TaskSizeSchema, PhaseNameSchema, ApprovalTypeSchema, TaskStateSchema, } from './types-core.js';
import type { PhaseName, TaskSize, RiskScore, AcceptanceCriterion, RTMEntry, ProofEntry, Checkpoint, SubPhaseStatus } from './types-core.js';
export interface TaskState {
    taskId: string;
    taskName: string;
    version: 4;
    phase: PhaseName;
    completedPhases: PhaseName[];
    skippedPhases: PhaseName[];
    subPhaseStatus?: Record<string, SubPhaseStatus>;
    size: TaskSize;
    riskScore: RiskScore;
    userIntent: string;
    openQuestions: string[];
    notInScope: string[];
    scopeFiles: string[];
    scopeDirs: string[];
    scopeGlob?: string;
    plannedFiles: string[];
    acceptanceCriteria: AcceptanceCriterion[];
    rtmEntries: RTMEntry[];
    proofLog: ProofEntry[];
    checkpoint: Checkpoint;
    docsDir: string;
    workflowDir: string;
    approvals?: Record<string, {
        approvedAt: string;
    }>;
    feedbackLog?: Array<{
        feedback: string;
        recordedAt: string;
    }>;
    baseline?: {
        capturedAt: string;
        totalTests: number;
        passedTests: number;
        failedTests: string[];
    };
    testResults?: Array<{
        recordedAt: string;
        phase: PhaseName;
        exitCode: number;
        output: string;
        summary?: string;
    }>;
    resetHistory?: Array<{
        reason: string;
        resetAt: string;
        targetPhase: string;
    }>;
    testFiles?: string[];
    knownBugs?: Array<{
        testName: string;
        description: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        targetPhase?: string;
        issueUrl?: string;
        recordedAt: string;
    }>;
    retryCount?: Record<string, number>;
    artifactTimestamps?: Record<string, number>;
    requirementCount?: number;
    artifactHashes?: Record<string, string>;
    parallelPhaseBackupLog?: string[];
    sessionToken: string;
    stateIntegrity: string;
    createdAt: string;
    updatedAt: string;
    parentTaskId?: string;
    childTaskIds?: string[];
}
//# sourceMappingURL=types.d.ts.map