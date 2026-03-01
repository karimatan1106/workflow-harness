/**
 * Type definitions for the Reflector module.
 * @spec docs/spec/features/workflow-harness.md
 */
export function isV2Store(store) {
    return typeof store === 'object' && store !== null && store.version === 2;
}
export function migrateV2toV3(store) {
    let nextId = 1;
    const lessons = store.lessons.map(l => ({
        id: `L-${String(nextId++).padStart(3, '0')}`,
        phase: l.phase,
        errorPattern: l.errorPattern,
        lesson: l.lesson,
        createdAt: l.createdAt,
        hitCount: l.hitCount,
        helpfulCount: 0,
        harmfulCount: 0,
        category: 'failure',
    }));
    return {
        version: 3,
        nextLessonId: nextId,
        lessons,
        stashedFailures: store.stashedFailures || [],
    };
}
//# sourceMappingURL=reflector-types.js.map