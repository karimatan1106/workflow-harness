/**
 * State manager — read operations (load, list, query)
 * @spec docs/spec/features/workflow-harness.md
 */
import type { TaskState, PhaseName, TaskSize } from './types.js';
export declare function getStatePath(taskId: string, taskName: string): string;
export declare function getDocsPath(taskName: string): string;
export declare function loadTaskFromDisk(taskId: string): TaskState | null;
export declare function listTasksFromDisk(): Array<{
    taskId: string;
    taskName: string;
    phase: PhaseName;
    size: TaskSize;
}>;
export declare function buildTaskIndex(STATE_DIR_PARAM: string): Array<{
    taskId: string;
    taskName: string;
    phase: string;
    size: string;
    status: string;
}>;
//# sourceMappingURL=manager-read.d.ts.map