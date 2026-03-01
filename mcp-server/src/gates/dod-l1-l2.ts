/**
 * DoD L1 (file existence) and L2 (exit code) checks.
 * @spec docs/spec/features/workflow-harness.md
 */

import { existsSync } from 'node:fs';
import type { TaskState, PhaseConfig } from '../state/types.js';
import { PHASE_REGISTRY } from '../phases/registry.js';
import type { DoDCheckResult } from './dod-types.js';

export function checkL1FileExists(phase: string, docsDir: string, workflowDir: string): DoDCheckResult {
  const config: PhaseConfig | undefined = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  if (!config || !config.outputFile) {
    return { level: 'L1', check: 'output_file_exists', passed: true, evidence: 'No output file required for this phase' };
  }
  const outputFile = config.outputFile
    .replace('{docsDir}', docsDir)
    .replace('{workflowDir}', workflowDir);
  const exists = existsSync(outputFile);
  return {
    level: 'L1',
    check: 'output_file_exists',
    passed: exists,
    evidence: exists ? `File exists: ${outputFile}` : `File missing: ${outputFile}`,
  };
}

// IFV-1 (S3-8): Verify all required input files exist before phase completion
export function checkInputFilesExist(phase: string, docsDir: string, workflowDir: string): DoDCheckResult {
  const config: PhaseConfig | undefined = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  if (!config?.inputFiles || config.inputFiles.length === 0) {
    return { level: 'L1', check: 'input_files_exist', passed: true, evidence: 'No input files required for this phase' };
  }
  const missing: string[] = [];
  for (const inputFile of config.inputFiles) {
    const filePath = inputFile.replace('{docsDir}', docsDir).replace('{workflowDir}', workflowDir);
    if (!existsSync(filePath)) missing.push(filePath);
  }
  const passed = missing.length === 0;
  return {
    level: 'L1', check: 'input_files_exist', passed,
    evidence: passed ? `All ${config.inputFiles.length} input files exist` : `Missing input files: ${missing.join(', ')}`,
  };
}

export function checkL2ExitCode(state: TaskState): DoDCheckResult {
  const recentProof = state.proofLog
    .filter(e => e.phase === state.phase && e.level === 'L2')
    .slice(-1)[0];
  if (!recentProof) {
    return { level: 'L2', check: 'exit_code_zero', passed: true, evidence: 'No L2 proof required for this phase' };
  }
  return {
    level: 'L2',
    check: 'exit_code_zero',
    passed: recentProof.result,
    evidence: recentProof.evidence || (recentProof.result ? 'exit code 0' : 'non-zero exit code'),
  };
}

/** TDD-1 (S2-16): test_impl must record at least one failing test run (Red phase evidence) */
export function checkTDDRedEvidence(state: TaskState, phase: string): DoDCheckResult {
  if (phase !== 'test_impl') {
    return { level: 'L2', check: 'tdd_red_evidence', passed: true, evidence: 'TDD Red evidence check not required for phase: ' + phase };
  }
  const testImplProofs = state.proofLog.filter(e => e.phase === 'test_impl' && e.level === 'L2');
  if (testImplProofs.length === 0) {
    return {
      level: 'L2', check: 'tdd_red_evidence', passed: false,
      evidence: 'TDD Red フェーズ: テストは失敗している必要があります。先にテストを実行して失敗を記録してください (TDD-1)',
    };
  }
  const hasRedEvidence = testImplProofs.some(e => !e.result);
  return {
    level: 'L2', check: 'tdd_red_evidence', passed: hasRedEvidence,
    evidence: hasRedEvidence
      ? 'TDD Red phase evidence found: test failure recorded before implementation (TDD-1)'
      : 'TDD Red フェーズ: テストは失敗している必要があります。Redフェーズの記録が必要です (TDD-1)',
  };
}
