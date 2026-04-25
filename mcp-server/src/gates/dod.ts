/**
 * Definition of Done (DoD) gate system - orchestrator.
 * Delegates to dod-l1-l2.ts, dod-l3.ts, dod-l4-*.ts modules.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { TaskState, PhaseName } from '../state/types.js';
import { checkL1FileExists, checkL2ExitCode, checkInputFilesExist, checkTDDRedEvidence, checkSpecPathsExist, checkTestResultsExist, checkTestRegression } from './dod-l1-l2.js';
import { checkHearingUserResponse } from './dod-l2-hearing.js';
import { OUTPUT_FILE_TO_PHASE } from '../phases/definitions.js';
import { MODE_PHASES, PHASE_ORDER } from '../phases/registry.js';
import { checkL3Quality, checkRTMCompleteness, checkACCompleteness, checkRTMRequired, checkBaselineRequired, checkArtifactFreshness, checkInvariantCompleteness } from './dod-l3.js';
import { checkL4ContentValidation } from './dod-l4-content.js';
import { checkACFormat, checkNotInScope, checkOpenQuestions, checkIntentConsistency } from './dod-l4-requirements.js';
import { checkDeltaEntryFormat } from './dod-l4-delta.js';
import { checkAcDesignMapping, checkAcTcMapping, checkAcAchievementTable, checkTCCoverage } from './dod-l4-ia.js';
import { checkArtifactDrift } from './dod-l4-art.js';
import { checkPackageLockSync } from './dod-l4-commit.js';
import { checkDeadReferences } from './dod-l4-refs.js';
import { checkToonSafety } from './dod-l4-toon.js';
import { checkDCIValidation } from './dod-l4-dci.js';

export type { DoDCheckResult, DoDResult } from './dod-types.js';

/**
 * Run all DoD checks for the current phase of a task.
 * Returns a DoDResult with individual check results and an overall passed flag.
 */
export async function runDoDChecks(state: TaskState, docsDir: string): Promise<import('./dod-types.js').DoDResult> {
  const { phase, workflowDir } = state;
  const checks: import('./dod-types.js').DoDCheckResult[] = [];
  const errors: string[] = [];

  const push = (c: import('./dod-types.js').DoDCheckResult, prefix: string) => {
    checks.push(c);
    if (!c.passed) errors.push(`[${prefix}] ${c.evidence}`);
  };

  push(checkL1FileExists(phase, docsDir, workflowDir), 'L1');
  // Mode-aware skippedPhases: when state.mode is set (CBR-2), inputs from phases not in
  // MODE_PHASES[mode] are treated as optional (Express skips research/planning/test_design etc.).
  const baseSkipped: string[] = state.skippedPhases ?? [];
  const modeInactivePhases: string[] = state.mode
    ? PHASE_ORDER.filter(p => !MODE_PHASES[state.mode as keyof typeof MODE_PHASES].includes(p as PhaseName))
    : [];
  const effectiveSkipped: string[] = Array.from(new Set([...baseSkipped, ...modeInactivePhases]));
  push(checkInputFilesExist(phase, docsDir, workflowDir, effectiveSkipped, OUTPUT_FILE_TO_PHASE), 'L1');
  push(checkSpecPathsExist(state, phase), 'L1');
  push(checkL2ExitCode(state), 'L2');
  push(checkL3Quality(phase, docsDir, workflowDir), 'L3');
  push(checkToonSafety(phase, docsDir, workflowDir), 'L4');
  push(checkL4ContentValidation(phase, docsDir, workflowDir), 'L4');
  push(checkRTMCompleteness(state, phase), 'L3');
  push(checkRTMRequired(state, phase), 'L3');
  push(checkACCompleteness(state, phase), 'L3');
  push(checkInvariantCompleteness(state, phase), 'L3');
  push(checkACFormat(state, phase, docsDir), 'L4');
  push(checkNotInScope(state, phase, docsDir), 'L4');
  push(checkOpenQuestions(state, phase, docsDir), 'L4');
  push(checkIntentConsistency(state, phase, docsDir), 'L4');
  push(checkBaselineRequired(state, phase), 'L3');
  push(checkArtifactFreshness(phase, docsDir), 'L3');
  push(checkDeltaEntryFormat(phase, docsDir, workflowDir, state.size, state.mode), 'L4');
  push(checkAcDesignMapping(state, phase, docsDir), 'L4');
  push(checkAcTcMapping(phase, docsDir), 'L4');
  push(checkAcAchievementTable(phase, docsDir), 'L4');
  push(checkTCCoverage(state, phase, docsDir), 'L3');
  push(checkArtifactDrift(state, phase), 'L4');
  push(checkPackageLockSync(phase), 'L4');
  push(checkTDDRedEvidence(state, phase), 'L2');
  push(checkTestResultsExist(state, phase), 'L1');
  push(checkTestRegression(state, phase), 'L2');
  push(checkHearingUserResponse(phase, docsDir), 'L2');
  push(checkDeadReferences(phase, docsDir, workflowDir ?? ''), 'L4');
  for (const r of checkDCIValidation(state, phase)) push(r, 'L4');

  return { passed: errors.length === 0, checks, errors };
}

export function formatDoDResult(result: import('./dod-types.js').DoDResult): string {
  const lines: string[] = [`DoD Check: ${result.passed ? 'PASSED' : 'FAILED'}`, ''];
  for (const check of result.checks) {
    lines.push(`  [${check.level}] ${check.passed ? 'OK' : 'NG'} ${check.check}: ${check.evidence}`);
  }
  if (result.errors.length > 0) {
    lines.push('', 'Errors:');
    for (const err of result.errors) lines.push(`  - ${err}`);
  }
  return lines.join('\n');
}
