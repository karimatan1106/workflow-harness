/**
 * State manager — write operations (persist, update, create)
 * @spec docs/spec/features/workflow-harness.md
 */
import type { TaskState, PhaseName, Checkpoint, AcceptanceCriterion, RTMEntry } from './types.js';
export declare function computeCheckpointHash(checkpoint: Checkpoint): string;
export declare function persistState(state: TaskState): void;
export declare function ensureStateDirs(state: TaskState): void;
export declare function writeTaskIndex(): void;
export declare function createTaskState(taskName: string, userIntent: string, hmacKey: string, files?: string[], dirs?: string[]): TaskState;
export declare function signAndPersist(state: TaskState, hmacKey: string): void;
export declare function updateCheckpoint(state: TaskState, targetPhase: PhaseName): void;
export declare function refreshCheckpointTraceability(state: TaskState): void;
export declare function applyAddAC(state: TaskState, criterion: AcceptanceCriterion): void;
export declare function applyAddRTM(state: TaskState, entry: RTMEntry): void;
export declare function applyUpdateACStatus(state: TaskState, acId: string, status: 'open' | 'met' | 'not_met', testCaseId?: string): boolean;
export declare function appendProgressLog(state: TaskState, completedPhase: string, nextPhase: string): void;
export declare function applyUpdateRTMStatus(state: TaskState, rtmId: string, status: 'pending' | 'implemented' | 'tested' | 'verified', codeRef?: string, testRef?: string): boolean;
//# sourceMappingURL=manager-write.d.ts.map