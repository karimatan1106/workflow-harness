/**
 * ACE cross-task knowledge store.
 * Promotes high-quality lessons (quality score >= 0.6) to a persistent
 * ace-context.json for injection into future tasks (OpenSage-style).
 * All operations are non-blocking — exceptions are caught and not re-thrown.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { ReflectorLesson } from './reflector-types.js';
export interface AceBullet {
    id: string;
    content: string;
    category: 'failure' | 'strategy' | 'constraint';
    phase: string;
    helpfulCount: number;
    harmfulCount: number;
    createdAt: string;
}
/**
 * Extract lessons with quality score >= 0.6 and store them as cross-task bullets.
 * Merges with existing bullets (dedup by id), then persists.
 */
export declare function extractAndStoreBullets(lessons: ReflectorLesson[]): void;
/**
 * Return the top-n cross-task bullets sorted by quality score descending.
 * Returns an empty array if ace-context.json is missing or unreadable.
 */
export declare function getTopCrossTaskBullets(n: number): AceBullet[];
//# sourceMappingURL=ace-context.d.ts.map