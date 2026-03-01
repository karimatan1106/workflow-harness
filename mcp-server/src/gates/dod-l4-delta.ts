/**
 * DoD L4 Delta Entry format check: validates ## サマリー section entries.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'node:fs';
import type { PhaseConfig } from '../state/types.js';
import { PHASE_REGISTRY } from '../phases/registry.js';
import type { DoDCheckResult } from './dod-types.js';

const DELTA_ENTRY_REGEX = /^- \[[A-Z]{1,4}-\d{1,3}\]\[[a-z_]+\] .+/;
const DELTA_ENTRY_MIN_COUNT = 5;
const DELTA_ENTRY_CATEGORIES = new Set([
  'decision', 'constraint', 'risk', 'finding', 'next', 'dependency', 'assumption',
]);
const DELTA_ENTRY_APPLICABLE_PHASES = new Set([
  'scope_definition', 'research', 'impact_analysis', 'requirements',
  'threat_modeling', 'planning', 'state_machine', 'flowchart', 'ui_design',
  'design_review', 'test_design', 'test_selection', 'code_review', 'acceptance_verification',
  'manual_test', 'security_scan', 'performance_test', 'e2e_test', 'health_observation',
]);

export function checkDeltaEntryFormat(phase: string, docsDir: string, workflowDir: string): DoDCheckResult {
  if (!DELTA_ENTRY_APPLICABLE_PHASES.has(phase)) {
    return { level: 'L4', check: 'delta_entry_format', passed: true, evidence: 'Delta Entry format check not applicable for phase: ' + phase };
  }
  const config: PhaseConfig | undefined = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  if (!config || !config.outputFile) {
    return { level: 'L4', check: 'delta_entry_format', passed: true, evidence: 'No output file for Delta Entry check' };
  }
  const outputFile = config.outputFile.replace('{docsDir}', docsDir).replace('{workflowDir}', workflowDir);
  if (!existsSync(outputFile)) {
    return { level: 'L4', check: 'delta_entry_format', passed: false, evidence: 'Cannot check Delta Entry: file missing: ' + outputFile };
  }
  const content = readFileSync(outputFile, 'utf8');
  const lines = content.split('\n');
  let inSummary = false;
  const deltaEntries: string[] = [];
  const invalidEntries: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+サマリー/.test(trimmed)) { inSummary = true; continue; }
    if (inSummary && /^##\s/.test(trimmed)) break;
    if (inSummary && trimmed.startsWith('- [')) {
      if (DELTA_ENTRY_REGEX.test(trimmed)) {
        const catMatch = trimmed.match(/^\- \[[A-Z]{1,4}-\d{1,3}\]\[([a-z_]+)\]/);
        if (catMatch && DELTA_ENTRY_CATEGORIES.has(catMatch[1])) { deltaEntries.push(trimmed); }
        else { invalidEntries.push(trimmed.substring(0, 60)); }
      } else { invalidEntries.push(trimmed.substring(0, 60)); }
    }
  }

  if (!inSummary) {
    return {
      level: 'L4', check: 'delta_entry_format', passed: false,
      evidence: 'No ## サマリー section found\n修正方法: 成果物の先頭に ## サマリー セクションを追加し、- [ID][category] 形式で5件以上のDeltaエントリを記述してください。',
    };
  }
  const errors: string[] = [];
  if (deltaEntries.length < DELTA_ENTRY_MIN_COUNT) {
    errors.push(`Delta Entry count: ${deltaEntries.length} < required ${DELTA_ENTRY_MIN_COUNT}. Format: - [ID][category] content\n修正方法: ## サマリー に - [R-001][finding] 形式のエントリをあと${DELTA_ENTRY_MIN_COUNT - deltaEntries.length}件追加してください。`);
  }
  if (invalidEntries.length > 0) errors.push('Invalid Delta Entry format: ' + invalidEntries.slice(0, 3).join('; '));
  const passed = errors.length === 0;
  return {
    level: 'L4', check: 'delta_entry_format', passed,
    evidence: passed ? `Delta Entry format OK: ${deltaEntries.length} valid entries in ## サマリー` : errors.join('; '),
  };
}
