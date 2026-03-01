/**
 * Shared types and helper functions for MCP tool handlers.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { TaskState } from '../state/types.js';
export type HandlerResult = {
    content: Array<{
        type: string;
        text: string;
    }>;
};
export declare const respond: (obj: unknown) => HandlerResult;
export declare const respondError: (message: string) => HandlerResult;
export declare const PHASE_APPROVAL_GATES: Record<string, string>;
export declare const PARALLEL_GROUPS: Record<string, string[]>;
/** Validate session token. Returns error string or null on success. (BUG-5 fix) */
export declare function validateSession(state: TaskState, token: unknown): string | null;
/** Build phase guide object from registry (INC-4 fix). */
export declare function buildPhaseGuide(phase: string): {
    model: string;
    bashCategories: string[];
    allowedExtensions: string[];
    requiredSections: string[];
    minLines: number;
};
//# sourceMappingURL=handler-shared.d.ts.map