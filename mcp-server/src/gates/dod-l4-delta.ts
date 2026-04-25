/**
 * DoD L4 Delta Entry format check: validates decisions[] array in TOON artifacts.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolveProjectPath } from '../utils/project-root.js';
import { decode as toonDecode } from '@toon-format/toon';
import type { PhaseConfig, TaskSize } from '../state/types.js';
import { PHASE_REGISTRY } from '../phases/registry.js';
import type { DoDCheckResult } from './dod-types.js';
import type { WorkflowMode } from '../state/workflow-mode.js';

const DELTA_ENTRY_MIN_BY_SIZE: Record<string, number> = { small: 3, medium: 4, large: 5 };
const DELTA_ENTRY_MIN_BY_MODE: Record<WorkflowMode, number> = {
  express: 3,
  standard: 5,
  full: 5,
};

function deltaMin(size: string, mode?: WorkflowMode): number {
  // mode takes precedence if provided
  if (mode) return DELTA_ENTRY_MIN_BY_MODE[mode];
  return DELTA_ENTRY_MIN_BY_SIZE[size] ?? 5;
}
const DELTA_ENTRY_APPLICABLE_PHASES = new Set([
  'scope_definition', 'research', 'impact_analysis', 'requirements',
  'threat_modeling', 'planning', 'ui_design',
  'design_review', 'test_design', 'test_selection', 'code_review', 'acceptance_verification',
  'manual_test', 'security_scan', 'performance_test', 'e2e_test', 'health_observation',
]);

export function checkDeltaEntryFormat(phase: string, docsDir: string, workflowDir: string, size: TaskSize = 'large', mode?: WorkflowMode): DoDCheckResult {
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
  const minRequired = deltaMin(size, mode);

  // DJ-1: Markdown phase artifacts use ## decisions section with list items
  if (outputFile.endsWith('.md')) {
    const lines = content.split('\n');
    let inDecisions = false;
    const decisionItems: string[] = [];
    for (const line of lines) {
      if (/^#{1,3}\s+decisions/i.test(line)) { inDecisions = true; continue; }
      if (inDecisions && /^#{1,3}\s/.test(line)) break;
      if (inDecisions && /^-\s+\S/.test(line)) decisionItems.push(line);
    }
    if (decisionItems.length < minRequired) {
      // TOON fallback: accept decisions[N] form where N >= required
      const toonMatches = [...content.matchAll(/^\s*decisions\[(\d+)\]/gm)];
      const maxToonCount = toonMatches.reduce((max, m) => Math.max(max, parseInt(m[1], 10) || 0), 0);
      if (maxToonCount >= minRequired) {
        return {
          level: 'L4', check: 'delta_entry_format', passed: true,
          evidence: `Delta Entry format OK: ${maxToonCount} decisions[] entries (TOON form in .md artifact)`,
        };
      }
      if (decisionItems.length === 0) {
        return {
          level: 'L4', check: 'delta_entry_format', passed: false,
          evidence: `Markdown artifact missing ## decisions section with list items\n修正方法: ## decisions セクションに最低${minRequired}件のリスト項目を追加してください。`,
          fix: '## decisions セクションにリスト項目を追加してください。',
          example: '## decisions\n- D-001: 要件を明確化する (ユーザー意図との整合性確保のため)',
        };
      }
      return {
        level: 'L4', check: 'delta_entry_format', passed: false,
        evidence: `decisions count: ${decisionItems.length} < required ${minRequired}\n修正方法: ## decisions にあと${minRequired - decisionItems.length}件追加してください。`,
        fix: `## decisions にあと${minRequired - decisionItems.length}件追加してください。`,
      };
    }
    return {
      level: 'L4', check: 'delta_entry_format', passed: true,
      evidence: `Delta Entry format OK: ${decisionItems.length} decision items in Markdown artifact`,
    };
  }
  // Mermaid diagram files: skip TOON delta check
  if (outputFile.endsWith('.mmd')) {
    return {
      level: 'L4', check: 'delta_entry_format', passed: true,
      evidence: 'Mermaid diagram file, skipping TOON delta check',
    };
  }

  // Internal .toon files: TOON decode path
  let obj: unknown;
  try {
    obj = toonDecode(content);
  } catch (e) {
    return {
      level: 'L4', check: 'delta_entry_format', passed: false,
      evidence: `TOON decode failed: ${e instanceof Error ? e.message : String(e)}`,
      fix: '.toonファイルはkey: value形式のみ。',
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
      evidence: `TOON artifact missing decisions[] array\n修正方法: decisions[N]{id,statement,rationale}: テーブルに最低${minRequired}エントリを追加してください。`,
      fix: '必須TOONキー(decisions)を成果物に追加してください。',
      example: 'decisions[5]{id,statement,rationale}:\n  SD-1, "要件を明確化する", "ユーザー意図との整合性確保のため"',
    };
  }
  if (decisions.length < minRequired) {
    return {
      level: 'L4', check: 'delta_entry_format', passed: false,
      evidence: `decisions[] count: ${decisions.length} < required ${minRequired}\n修正方法: decisions[N]{id,statement,rationale}: テーブルにあと${minRequired - decisions.length}エントリ追加してください。`,
      fix: `decisions[]テーブルにあと${minRequired - decisions.length}エントリ追加してください。`,
    };
  }
  return {
    level: 'L4', check: 'delta_entry_format', passed: true,
    evidence: `Delta Entry format OK: ${decisions.length} decisions[] entries in TOON artifact`,
  };
}
