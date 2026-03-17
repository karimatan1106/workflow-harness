/**
 * DoD L4 Delta Entry format check: validates decisions[] array in TOON artifacts.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolveProjectPath } from '../utils/project-root.js';
import { decode as toonDecode } from '@toon-format/toon';
import type { PhaseConfig } from '../state/types.js';
import { PHASE_REGISTRY } from '../phases/registry.js';
import type { DoDCheckResult } from './dod-types.js';

const DELTA_ENTRY_MIN_COUNT = 5;
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
  const outputFile = resolveProjectPath(config.outputFile.replace('{docsDir}', docsDir).replace('{workflowDir}', workflowDir));
  if (!existsSync(outputFile)) {
    return { level: 'L4', check: 'delta_entry_format', passed: false, evidence: 'Cannot check Delta Entry: file missing: ' + outputFile, fix: '成果物ファイルが指定パスに存在しません。正しいパスに保存してください。' };
  }
  const content = readFileSync(outputFile, 'utf8');
  let obj: unknown;
  try {
    obj = toonDecode(content);
  } catch (e) {
    return {
      level: 'L4', check: 'delta_entry_format', passed: false,
      evidence: `TOON decode failed: ${e instanceof Error ? e.message : String(e)}`,
      fix: '.toonファイルに ## ヘッダーやMarkdown記法を書かないこと。TOON形式は key: value のみ。',
    };
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return {
      level: 'L4', check: 'delta_entry_format', passed: false,
      evidence: 'TOON artifact is not an object',
      fix: 'TOON成果物がオブジェクト形式になっていません。key: value 形式で記述してください。',
    };
  }
  const record = obj as Record<string, unknown>;
  const decisions = record['decisions'];
  if (!Array.isArray(decisions)) {
    return {
      level: 'L4', check: 'delta_entry_format', passed: false,
      evidence: `TOON artifact missing decisions[] array\n修正方法: decisions[N]{id,statement,rationale}: テーブルに最低${DELTA_ENTRY_MIN_COUNT}エントリを追加してください。`,
      fix: '必須TOONキー(decisions)を成果物に追加してください。',
      example: 'decisions[5]{id,statement,rationale}:\n  SD-1, "要件を明確化する", "ユーザー意図との整合性確保のため"',
    };
  }
  if (decisions.length < DELTA_ENTRY_MIN_COUNT) {
    return {
      level: 'L4', check: 'delta_entry_format', passed: false,
      evidence: `decisions[] count: ${decisions.length} < required ${DELTA_ENTRY_MIN_COUNT}\n修正方法: decisions[N]{id,statement,rationale}: テーブルにあと${DELTA_ENTRY_MIN_COUNT - decisions.length}エントリ追加してください。`,
      fix: `decisions[]テーブルにあと${DELTA_ENTRY_MIN_COUNT - decisions.length}エントリ追加してください。`,
    };
  }
  return {
    level: 'L4', check: 'delta_entry_format', passed: true,
    evidence: `Delta Entry format OK: ${decisions.length} decisions[] entries in TOON artifact`,
  };
}
