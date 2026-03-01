/**
 * Type definitions for the Reflector module.
 * @spec docs/spec/features/workflow-harness.md
 */

export interface ReflectorLesson {
  id: string;              // ACE bullet format ID (e.g., L-001)
  phase: string;
  errorPattern: string;   // regex-safe substring of the error
  lesson: string;         // 1-line actionable instruction
  createdAt: string;
  hitCount: number;        // backward-compat: helpfulCount + harmfulCount
  helpfulCount: number;   // times injected before phase succeeded
  harmfulCount: number;   // times injected but same error recurred
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
  nextLessonId: number;   // ID counter for L-NNN generation
  lessons: ReflectorLesson[];
  stashedFailures: StashedFailure[];
}

// v2 store shape (before ACE fields)
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

export function isV2Store(store: unknown): store is ReflectorStoreV2 {
  return typeof store === 'object' && store !== null && (store as any).version === 2;
}

export function migrateV2toV3(store: ReflectorStoreV2): ReflectorStore {
  let nextId = 1;
  const lessons: ReflectorLesson[] = store.lessons.map(l => ({
    id: `L-${String(nextId++).padStart(3, '0')}`,
    phase: l.phase,
    errorPattern: l.errorPattern,
    lesson: l.lesson,
    createdAt: l.createdAt,
    hitCount: l.hitCount,
    helpfulCount: 0,
    harmfulCount: 0,
    category: 'failure' as const,
  }));
  return {
    version: 3,
    nextLessonId: nextId,
    lessons,
    stashedFailures: store.stashedFailures || [],
  };
}
