/**
 * Shared types and helper functions for MCP tool handlers.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { TaskState } from '../state/types.js';
import { PHASE_REGISTRY } from '../phases/registry.js';

export type HandlerResult = { content: Array<{ type: string; text: string }> };

export const respond = (obj: unknown): HandlerResult => ({
  content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }],
});

export const respondError = (message: string): HandlerResult => ({
  content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }],
});

export const PHASE_APPROVAL_GATES: Record<string, string> = {
  requirements: 'requirements',
  design_review: 'design',
  test_design: 'test_design',
  code_review: 'code_review',
  acceptance_verification: 'acceptance',
};

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

/** Build phase guide object from registry (INC-4 fix). */
export function buildPhaseGuide(phase: string): {
  model: string;
  bashCategories: string[];
  allowedExtensions: string[];
  requiredSections: string[];
  minLines: number;
} {
  const config = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  if (config) {
    return {
      model: config.model,
      bashCategories: config.bashCategories,
      allowedExtensions: config.allowedExtensions,
      requiredSections: config.requiredSections ?? [],
      minLines: config.minLines ?? 0,
    };
  }
  return { model: 'sonnet', bashCategories: ['readonly'], allowedExtensions: ['.md'], requiredSections: [], minLines: 0 };
}
