/**
 * Type definitions for the Reflector module.
 * @spec docs/spec/features/workflow-harness.md
 */
export interface ReflectorLesson {
    id: string;
    phase: string;
    errorPattern: string;
    lesson: string;
    createdAt: string;
    hitCount: number;
    helpfulCount: number;
    harmfulCount: number;
    category: 'failure' | 'strategy' | 'constraint';
}
export interface StashedFailure {
    phase: string;
    taskId: string;
    errorPattern: string;
    errorMessage: string;
    retryCount: number;
    createdAt: string;
}
export interface ReflectorStore {
    version: 3;
    nextLessonId: number;
    lessons: ReflectorLesson[];
    stashedFailures: StashedFailure[];
}
export interface ReflectorStoreV2 {
    version: 2;
    lessons: Array<{
        phase: string;
        errorPattern: string;
        lesson: string;
        createdAt: string;
        hitCount: number;
    }>;
    stashedFailures: StashedFailure[];
}
export declare function isV2Store(store: unknown): store is ReflectorStoreV2;
export declare function migrateV2toV3(store: ReflectorStoreV2): ReflectorStore;
//# sourceMappingURL=reflector-types.d.ts.map