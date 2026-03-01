/**
 * DoD L4 TOON checkpoint check (blocking — TOON-first enforced).
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'node:fs';
import { decode as toonDecode } from '@toon-format/toon';
import type { DoDCheckResult } from './dod-types.js';

// Phases that produce output artifacts MUST also produce TOON checkpoints
const TOON_APPLICABLE_PHASES = new Set([
  'scope_definition', 'research', 'impact_analysis', 'requirements',
  'threat_modeling', 'planning', 'state_machine', 'flowchart', 'ui_design',
  'design_review', 'test_design', 'test_selection', 'code_review', 'acceptance_verification',
  'manual_test', 'security_scan', 'performance_test', 'e2e_test', 'health_observation',
]);

export function checkToonCheckpoint(phase: string, docsDir: string): DoDCheckResult {
  if (!TOON_APPLICABLE_PHASES.has(phase)) {
    return { level: 'L4', check: 'toon_checkpoint', passed: true, evidence: 'TOON checkpoint not applicable for this phase' };
  }
  const toonPath = `${docsDir}/${phase}.toon`;
  if (!existsSync(toonPath)) {
    return {
      level: 'L4', check: 'toon_checkpoint', passed: false,
      evidence: `TOON checkpoint missing: ${toonPath}. Create ${phase}.toon in TOON format (see SUMMARY_SECTION instructions).`,
    };
  }
  try {
    toonDecode(readFileSync(toonPath, 'utf-8'));
    return { level: 'L4', check: 'toon_checkpoint', passed: true, evidence: `TOON checkpoint valid: ${toonPath}` };
  } catch (e) {
    return {
      level: 'L4', check: 'toon_checkpoint', passed: false,
      evidence: `TOON checkpoint invalid (decode failed): ${toonPath}. ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
