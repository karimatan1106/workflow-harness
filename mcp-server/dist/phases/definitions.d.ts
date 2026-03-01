/**
 * Phase definitions - subagent templates and prompt builders
 * @spec docs/spec/features/workflow-harness.md
 */
import type { PhaseName } from '../state/types.js';
export type { PhaseDefinition } from './definitions-shared.js';
export declare const PHASE_DEFINITIONS: Partial<Record<PhaseName, import('./definitions-shared.js').PhaseDefinition>>;
export declare function getPhaseDefinition(phase: string): import('./definitions-shared.js').PhaseDefinition | null;
export declare function buildSubagentPrompt(phase: string, taskName: string, docsDir: string, workflowDir: string, userIntent: string, taskId?: string): string;
//# sourceMappingURL=definitions.d.ts.map