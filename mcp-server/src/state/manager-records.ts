/**
 * StateManager extension: recording operations (feedback, baseline, tests, proof, bugs).
 * Extracted from manager.ts for responsibility separation.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { TaskState, ProofEntry } from './types.js';

export function applyRecordFeedback(state: TaskState, feedback: string): boolean {
  if (state.integrityWarning) return false;
  if (!state.feedbackLog) state.feedbackLog = [];
  state.feedbackLog.push({ feedback, recordedAt: new Date().toISOString() });
  return true;
}

export function applyRecordBaseline(
  state: TaskState, totalTests: number, passedTests: number, failedTests: string[],
): void {
  state.baseline = {
    capturedAt: new Date().toISOString(),
    totalTests,
    passedTests,
    failedTests,
  };
}

export function applyRecordTestResult(
  state: TaskState, exitCode: number, output: string, summary?: string,
): void {
  if (!state.testResults) state.testResults = [];
  state.testResults.push({
    recordedAt: new Date().toISOString(),
    phase: state.phase,
    exitCode,
    output: output.slice(0, 5000),
    summary,
  });
}

export function applyAddProof(state: TaskState, entry: ProofEntry): void {
  state.proofLog.push(entry);
}

export function applyRecordTestFile(state: TaskState, testFile: string): boolean {
  if (!state.testFiles) state.testFiles = [];
  if (state.testFiles.includes(testFile)) return false;
  state.testFiles.push(testFile);
  return true;
}

export function applyRecordKnownBug(
  state: TaskState,
  bug: { testName: string; description: string; severity: string; targetPhase?: string; issueUrl?: string },
): void {
  if (!state.knownBugs) state.knownBugs = [];
  state.knownBugs.push({
    ...bug,
    severity: bug.severity as 'low' | 'medium' | 'high' | 'critical',
    recordedAt: new Date().toISOString(),
  });
}

export function applySetRefinedIntent(state: TaskState, refinedIntent: string): void {
  state.refinedIntent = refinedIntent;
}
