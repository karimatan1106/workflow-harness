/**
 * Reflector — learns from validation failures to improve future subagent prompts.
 * Stores (phase, errorPattern, lesson) tuples; injects relevant lessons into prompts.
 * Max 50 lessons kept (quality-score eviction).
 * @spec docs/spec/features/workflow-harness.md
 */
import type { ReflectorLesson, ReflectorStore } from './reflector-types.js';
export type { ReflectorLesson } from './reflector-types.js';
export declare function loadStore(): ReflectorStore;
/**
 * Stash a DoD failure for later promotion when retry succeeds.
 * Called on the FAILURE path of harness_next.
 */
export declare function stashFailure(taskId: string, phase: string, errorMessage: string, retryCount: number): void;
/**
 * Promote a stashed failure to a lesson when retry succeeds.
 * Called on the SUCCESS path of harness_next when retryCount > 1.
 * Returns true if a lesson was promoted.
 */
export declare function promoteStashedFailure(taskId: string, phase: string, retryCount: number): boolean;
/**
 * Get lessons relevant to a given phase, sorted by quality score (highest first).
 */
export declare function getLessonsForPhase(phase: string): ReflectorLesson[];
/**
 * Format lessons as a prompt section in ACE bullet format.
 * Returns empty string if no lessons exist for the phase.
 */
export declare function formatLessonsForPrompt(phase: string): string;
/**
 * Extract a short error pattern from a full error message.
 */
export declare function extractErrorPattern(errorMessage: string): string;
//# sourceMappingURL=reflector.d.ts.map