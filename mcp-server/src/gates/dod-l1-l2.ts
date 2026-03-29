/**
 * DoD L1 (file existence) and L2 (exit code) checks.
 * @spec docs/spec/features/workflow-harness.md
 */

import { existsSync } from 'node:fs';
import { extname } from 'node:path';
import { resolveProjectPath } from '../utils/project-root.js';
import type { TaskState, PhaseConfig } from '../state/types.js';
import { PHASE_REGISTRY } from '../phases/registry.js';
import type { DoDCheckResult } from './dod-types.js';

// Re-export spec checks so existing imports from this module continue to work
export { checkSpecPathsExist } from './dod-spec.js';

export function checkL1FileExists(phase: string, docsDir: string, workflowDir: string): DoDCheckResult {
  const config: PhaseConfig | undefined = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  if (!config || !config.outputFile) {
    return { level: 'L1', check: 'output_file_exists', passed: true, evidence: 'No output file required for this phase' };
  }
  const outputFile = resolveProjectPath(config.outputFile
    .replace('{docsDir}', docsDir)
    .replace('{workflowDir}', workflowDir));
  const exists = existsSync(outputFile);
  return {
    level: 'L1',
    check: 'output_file_exists',
    passed: exists,
    evidence: exists ? `File exists: ${outputFile}` : `File missing: ${outputFile}`,
    ...(!exists && { fix: '成果物ファイルが指定パスに存在しません。正しいパスに保存してください。' }),
  };
}

// IFV-1 (S3-8): Verify all required input files exist before phase completion
export function checkInputFilesExist(phase: string, docsDir: string, workflowDir: string, skippedPhases: string[] = [], fileToPhaseMap: Record<string, string> = {}): DoDCheckResult {
  const config: PhaseConfig | undefined = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  if (!config?.inputFiles || config.inputFiles.length === 0) {
    return { level: 'L1', check: 'input_files_exist', passed: true, evidence: 'No input files required for this phase' };
  }
  const missing: string[] = [];
  for (const inputFile of config.inputFiles) {
    const basename = inputFile.split('/').pop() ?? '';
    const sourcePhase = fileToPhaseMap[basename];
    if (sourcePhase && skippedPhases.includes(sourcePhase)) continue;
    const filePath = resolveProjectPath(inputFile.replace('{docsDir}', docsDir).replace('{workflowDir}', workflowDir));
    if (!existsSync(filePath)) missing.push(filePath);
  }
  const passed = missing.length === 0;
  return {
    level: 'L1', check: 'input_files_exist', passed,
    evidence: passed ? `All ${config.inputFiles.length} input files exist` : `Missing input files: ${missing.join(', ')}`,
    ...(!passed && { fix: '前フェーズの成果物が不足しています。前フェーズを完了させてから再実行してください。' }),
  };
}

export function checkL2ExitCode(state: TaskState): DoDCheckResult {
  // Config-driven DoD exemption (RC-1): check PhaseConfig.dodExemptions instead of hardcoding phase names
  const config = PHASE_REGISTRY[state.phase as keyof typeof PHASE_REGISTRY];
  if (config?.dodExemptions?.includes('exit_code_zero')) {
    return { level: 'L2', check: 'exit_code_zero', passed: true, evidence: `Phase ${state.phase}: exit_code_zero exempted via dodExemptions (checked by tdd_red_evidence instead)` };
  }
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
  // Doc-only scope exemption: skip TDD Red for documentation-only tasks
  if (state.scopeFiles && state.scopeFiles.length > 0) {
    const allDocsOnly = state.scopeFiles.every((f: string) =>
      DOC_ONLY_EXTENSIONS.includes(extname(f))
    );
    if (allDocsOnly) {
      return { level: 'L2', check: 'tdd_red_evidence', passed: true, evidence: 'TDD Red exempt: scopeFiles contain only documentation files (.md/.mmd)' };
    }
  }
  const testImplProofs = state.proofLog.filter(e => e.phase === 'test_impl' && e.level === 'L2');
  if (testImplProofs.length === 0) {
    return {
      level: 'L2', check: 'tdd_red_evidence', passed: false,
      evidence: 'TDD Red フェーズ: テストは失敗している必要があります。先にテストを実行して失敗を記録してください (TDD-1)',
      fix: 'テストを実行して失敗結果をharness_record_proofで記録してください（TDD Redフェーズ）。',
    };
  }
  const hasRedEvidence = testImplProofs.some(e => !e.result);
  return {
    level: 'L2', check: 'tdd_red_evidence', passed: hasRedEvidence,
    evidence: hasRedEvidence
      ? 'TDD Red phase evidence found: test failure recorded before implementation (TDD-1)'
      : 'TDD Red フェーズ: テストは失敗している必要があります。Redフェーズの記録が必要です (TDD-1)',
    ...(!hasRedEvidence && { fix: 'テストを実行して失敗結果をharness_record_proofで記録してください（TDD Redフェーズ）。' }),
  };
}

const DOC_ONLY_EXTENSIONS = ['.md', '.mmd'];
const TEST_EXECUTION_PHASES = new Set(['testing', 'regression_test']);

/** Test Results Exist: ensure at least one test result has been recorded for testing phases */
export function checkTestResultsExist(state: TaskState, phase: string): DoDCheckResult {
  if (!TEST_EXECUTION_PHASES.has(phase)) {
    return { level: 'L1', check: 'test_results_exist', passed: true, evidence: 'Test results check not required for phase: ' + phase };
  }
  if (!state.testResults || state.testResults.length === 0) {
    return {
      level: 'L1',
      check: 'test_results_exist',
      passed: false,
      evidence: 'No test results recorded',
      fix: 'Run tests and record results with harness_record_test_result',
    };
  }
  // Count results recorded during the current phase
  const phaseResults = state.testResults.filter(r => r.phase === phase);
  if (phaseResults.length === 0) {
    return {
      level: 'L1',
      check: 'test_results_exist',
      passed: false,
      evidence: `Test results exist but none recorded for current phase: ${phase}`,
      fix: 'Run tests in this phase and record results with harness_record_test_result',
    };
  }
  return {
    level: 'L1',
    check: 'test_results_exist',
    passed: true,
    evidence: `${phaseResults.length} test result(s) recorded for phase ${phase}`,
  };
}

const REGRESSION_PHASES = new Set(['testing', 'regression_test']);

/** Test Regression Gate: compare baseline.failedTests vs latest testResult.failedTests */
export function checkTestRegression(state: TaskState, phase: string): DoDCheckResult {
  if (!REGRESSION_PHASES.has(phase)) {
    return { level: 'L2', check: 'test_regression_gate', passed: true, evidence: 'Regression gate not required for phase: ' + phase };
  }
  if (!state.baseline) {
    return { level: 'L2', check: 'test_regression_gate', passed: true, evidence: 'No baseline captured — regression gate skipped' };
  }
  if (!state.testResults || state.testResults.length === 0) {
    return { level: 'L2', check: 'test_regression_gate', passed: true, evidence: 'No test results recorded — delegating to exit_code_zero check' };
  }
  const latest = state.testResults[state.testResults.length - 1];
  if (!latest.failedTests) {
    return { level: 'L2', check: 'test_regression_gate', passed: true, evidence: 'failedTests not provided in test result — regression gate skipped (backward compat)' };
  }
  const baselineSet = new Set(state.baseline.failedTests);
  const newFailures = latest.failedTests.filter(t => !baselineSet.has(t));
  if (newFailures.length > 0) {
    return {
      level: 'L2', check: 'test_regression_gate', passed: false,
      evidence: `New test failures detected (${newFailures.length}): ${newFailures.join(', ')}`,
      fix: 'These tests were passing before your changes. Fix all new failures before advancing: ' + newFailures.join(', '),
    };
  }
  const existingFailures = latest.failedTests.filter(t => baselineSet.has(t));
  return {
    level: 'L2', check: 'test_regression_gate', passed: true,
    evidence: existingFailures.length > 0
      ? `No new regressions. ${existingFailures.length} pre-existing failure(s) carried over: ${existingFailures.join(', ')}`
      : 'No new regressions. All tests passing.',
  };
}
