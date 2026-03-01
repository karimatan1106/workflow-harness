/**
 * DoD result type definitions.
 * @spec docs/spec/features/workflow-harness.md
 */

export interface DoDCheckResult {
  level: 'L1' | 'L2' | 'L3' | 'L4';
  check: string;
  passed: boolean;
  evidence: string;
}

export interface DoDResult {
  passed: boolean;
  checks: DoDCheckResult[];
  errors: string[];
}
