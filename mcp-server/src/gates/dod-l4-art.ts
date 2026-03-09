/**
 * DoD L4 artifact drift check: ART-1 (S2-6).
 * Detects when approved artifacts are modified after approval.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { TaskState } from '../state/types.js';
import type { DoDCheckResult } from './dod-types.js';

// Phases where drift detection applies (i.e., use previously approved artifacts as inputs)
const DRIFT_CHECK_PHASES = new Set([
  'test_design', 'test_impl', 'implementation', 'build_check', 'code_review',
  'testing', 'regression_test', 'acceptance_verification',
]);

/** ART-1 (S2-6): Detect if approved artifacts have been modified since approval */
export function checkArtifactDrift(state: TaskState, phase: string): DoDCheckResult {
  if (!DRIFT_CHECK_PHASES.has(phase)) {
    return { level: 'L4', check: 'artifact_drift', passed: true, evidence: 'Artifact drift check not applicable for phase: ' + phase };
  }
  const hashes = state.artifactHashes;
  if (!hashes || Object.keys(hashes).length === 0) {
    return { level: 'L4', check: 'artifact_drift', passed: true, evidence: 'No approved artifact hashes recorded; drift check skipped' };
  }
  const drifted: string[] = [];
  for (const [filePath, storedHash] of Object.entries(hashes)) {
    if (!existsSync(filePath)) continue;
    const currentHash = createHash('sha256').update(readFileSync(filePath)).digest('hex');
    if (currentHash !== storedHash) drifted.push(filePath.split('/').slice(-1)[0]);
  }
  if (drifted.length > 0) {
    return {
      level: 'L4', check: 'artifact_drift', passed: false,
      evidence: `Approved artifacts modified since approval: ${drifted.join(', ')} (ART-1)\n修正方法: 変更を元に戻すか harness_approve で再承認してください。`,
      fix: '承認済み成果物が変更されています。変更を元に戻すかharness_approveで再承認してください。',
    };
  }
  return { level: 'L4', check: 'artifact_drift', passed: true, evidence: `All ${Object.keys(hashes).length} approved artifacts are unmodified (ART-1)` };
}
