/**
 * DoD result type definitions.
 * @spec docs/spec/features/workflow-harness.md
 */

export interface DoDCheckResult {
  level: 'L1' | 'L2' | 'L3' | 'L4';
  check: string;
  passed: boolean;
  evidence: string;
  /** Actionable fix instruction (populated when passed=false) */
  fix?: string;
  /** Example of correct output format (populated when fix benefits from example) */
  example?: string;
}

export interface DoDResult {
  passed: boolean;
  checks: DoDCheckResult[];
  errors: string[];
}
