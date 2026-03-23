/**
 * Shared types and helper functions for MCP tool handlers.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { TaskState, TaskSize } from '../state/types.js';
import { PHASE_REGISTRY } from '../phases/registry.js';

export type HandlerResult = { content: Array<{ type: string; text: string }> };

export const respond = (obj: unknown): HandlerResult => ({
  content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }],
});

export const respondError = (message: string): HandlerResult => ({
  content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
});

export const PHASE_APPROVAL_GATES: Record<string, string> = {
  requirements: 'requirements',
  design_review: 'design',
  test_design: 'test_design',
  code_review: 'code_review',
  acceptance_verification: 'acceptance',
  hearing: 'hearing',
};

/** Approvals that require explicit user confirmation vs Claude self-approval */
export const USER_APPROVAL_REQUIRED: Record<string, boolean> = {
  requirements: true,      // User must confirm scope
  design: false,           // Claude self-approval OK (technical judgment)
  test_design: false,      // Claude self-approval OK
  code_review: false,      // Claude self-approval OK
  acceptance: true,        // User must confirm final acceptance
  hearing: true,           // User must confirm hearing outcome
};

/** FB#7: Auto-approve requirements for small tasks when ACs are sufficient and no open questions */
export function shouldRequireApproval(phase: string, size: TaskSize, acCount: number, openQuestionCount: number): boolean {
  if (!(phase in PHASE_APPROVAL_GATES)) return false;
  if (size === 'small' && phase === 'requirements' && acCount >= 3 && openQuestionCount === 0) return false;
  return true;
}

export const PARALLEL_GROUPS: Record<string, string[]> = {
  parallel_analysis: ['threat_modeling', 'planning'],
  parallel_design: ['state_machine', 'flowchart', 'ui_design'],
  parallel_quality: ['build_check', 'code_review'],
  parallel_verification: ['manual_test', 'security_scan', 'performance_test', 'e2e_test'],
};

/** Validate session token. Returns error string or null on success. (BUG-5 fix) */
export function validateSession(state: TaskState, token: unknown): string | null {
  if (!token || typeof token !== 'string') return 'sessionToken is required';
  if (token !== state.sessionToken) return 'Invalid sessionToken';
  return null;
}

/** Phase-to-skill-file routing (SKILL.md Section 1). Max 4 files per phase. */
const SKILL_FILE_ROUTING: Record<string, string[]> = {
  scope_definition: ['workflow-phases.md', 'workflow-gates.md'],
  research: ['workflow-phases.md', 'workflow-gates.md'],
  impact_analysis: ['workflow-phases.md', 'workflow-gates.md'],
  requirements: ['workflow-phases.md', 'workflow-gates.md'],
  threat_modeling: ['workflow-phases.md', 'workflow-execution.md'],
  planning: ['workflow-phases.md', 'workflow-execution.md'],
  state_machine: ['workflow-phases.md', 'workflow-docs.md'],
  flowchart: ['workflow-phases.md', 'workflow-docs.md'],
  ui_design: ['workflow-phases.md', 'workflow-docs.md'],
  design_review: ['workflow-phases.md', 'workflow-docs.md'],
  test_design: ['workflow-phases.md', 'workflow-execution.md', 'workflow-gates.md'],
  test_selection: ['workflow-phases.md', 'workflow-execution.md', 'workflow-gates.md'],
  test_impl: ['workflow-phases.md', 'workflow-execution.md', 'workflow-gates.md'],
  implementation: ['workflow-phases.md', 'workflow-execution.md', 'workflow-rules.md'],
  refactoring: ['workflow-phases.md', 'workflow-rules.md', 'workflow-gates.md'],
  build_check: ['workflow-phases.md', 'workflow-rules.md', 'workflow-gates.md'],
  code_review: ['workflow-phases.md', 'workflow-rules.md', 'workflow-gates.md'],
  testing: ['workflow-phases.md', 'workflow-execution.md', 'workflow-operations.md'],
  regression_test: ['workflow-phases.md', 'workflow-execution.md', 'workflow-operations.md'],
  acceptance_verification: ['workflow-phases.md'],
  manual_test: ['workflow-phases.md'],
  security_scan: ['workflow-phases.md'],
  performance_test: ['workflow-phases.md'],
  e2e_test: ['workflow-phases.md'],
  docs_update: ['workflow-phases.md', 'workflow-docs.md'],
  commit: ['workflow-phases.md'],
  push: ['workflow-phases.md'],
  ci_verification: ['workflow-phases.md'],
  deploy: ['workflow-phases.md'],
  health_observation: ['workflow-phases.md'],
  hearing: ['workflow-phases.md', 'workflow-gates.md'],
};

/** Build phase guide object from registry (INC-4 fix). */
export function buildPhaseGuide(phase: string): {
  model: string;
  bashCategories: string[];
  allowedExtensions: string[];
  requiredSections: string[];
  minLines: number;
  skillFiles: string[];
} {
  const skillFiles = SKILL_FILE_ROUTING[phase] ?? [];
  const config = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  if (config) {
    return {
      model: config.model,
      bashCategories: config.bashCategories,
      allowedExtensions: config.allowedExtensions,
      requiredSections: config.requiredSections ?? [],
      minLines: config.minLines ?? 0,
      skillFiles,
    };
  }
  return { model: 'sonnet', bashCategories: ['readonly'], allowedExtensions: ['.md'], requiredSections: [], minLines: 0, skillFiles };
}
