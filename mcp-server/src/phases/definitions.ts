/**
 * Phase definitions - subagent templates and prompt builders
 * @spec docs/spec/features/workflow-harness.md
 */

import type { PhaseName } from '../state/types.js';
import { PHASE_REGISTRY } from './registry.js';
import { formatLessonsForPrompt } from '../tools/reflector.js';
import {
  ARTIFACT_QUALITY_RULES,
  SUMMARY_SECTION_RULE,
  EXIT_CODE_RULE,
  bashCategoryHelp,
} from './definitions-shared.js';
import { DEFS_STAGE1 } from './defs-stage1.js';
import { DEFS_STAGE2 } from './defs-stage2.js';
import { DEFS_STAGE3 } from './defs-stage3.js';
import { DEFS_STAGE4 } from './defs-stage4.js';
import { DEFS_STAGE5 } from './defs-stage5.js';
import { DEFS_STAGE6 } from './defs-stage6.js';

export type { PhaseDefinition } from './definitions-shared.js';

// ─── Phase Definitions ───────────────────────────

export const PHASE_DEFINITIONS: Partial<Record<PhaseName, import('./definitions-shared.js').PhaseDefinition>> = {
  ...DEFS_STAGE1,
  ...DEFS_STAGE2,
  ...DEFS_STAGE3,
  ...DEFS_STAGE4,
  ...DEFS_STAGE5,
  ...DEFS_STAGE6,
};

// ─── Lookup Functions ────────────────────────────

export function getPhaseDefinition(phase: string): import('./definitions-shared.js').PhaseDefinition | null {
  return PHASE_DEFINITIONS[phase as PhaseName] ?? null;
}

// ─── ACE TOON-first: output filename → source phase mapping ──

const OUTPUT_FILE_TO_PHASE: Record<string, string> = {
  'scope-definition.md': 'scope_definition',
  'research.md': 'research',
  'impact-analysis.md': 'impact_analysis',
  'requirements.md': 'requirements',
  'threat-model.md': 'threat_modeling',
  'spec.md': 'planning',
  'state-machine.mmd': 'state_machine',
  'flowchart.mmd': 'flowchart',
  'ui-design.md': 'ui_design',
  'test-design.md': 'test_design',
  'test-selection.md': 'test_selection',
  'code-review.md': 'code_review',
  'acceptance-report.md': 'acceptance_verification',
  'manual-test.md': 'manual_test',
  'security-scan.md': 'security_scan',
  'performance-test.md': 'performance_test',
  'e2e-test.md': 'e2e_test',
};

function buildToonFirstSection(phase: string, docsDir: string): string {
  const config = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  const inputFiles = config?.inputFiles ?? [];
  if (inputFiles.length === 0) return '';

  const entries: string[] = [];
  for (const inputFile of inputFiles) {
    const basename = inputFile.replace(/^\{docsDir\}\//, '');
    const sourcePhase = OUTPUT_FILE_TO_PHASE[basename];
    if (sourcePhase) {
      entries.push(`- \`${docsDir}/${sourcePhase}.toon\` が存在すれば \`${docsDir}/${basename}\` の代わりに読む`);
    }
  }

  if (entries.length === 0) return '';

  return '\n\n## TOON-first コンテキスト読み込み（ACE）\n'
    + '前フェーズの成果物を読む際、以下のTOONファイルが存在する場合はMDより先に読むこと（40-50%トークン効率向上）。\n'
    + 'TOONファイルが存在しない場合はMDファイルにフォールバックする。\n'
    + entries.join('\n')
    + '\n';
}

// ─── Prompt Builder ──────────────────────────────

export function buildSubagentPrompt(
  phase: string,
  taskName: string,
  docsDir: string,
  workflowDir: string,
  userIntent: string,
  taskId?: string,
): string {
  const def = getPhaseDefinition(phase);
  if (!def) return `# ${phase} phase\n\nNo template defined for this phase.`;

  const config = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  const categories = config?.bashCategories ?? def.bashCategories;

  let prompt = def.subagentTemplate;
  prompt = prompt.replace(/\{taskName\}/g, taskName);
  prompt = prompt.replace(/\{docsDir\}/g, docsDir);
  prompt = prompt.replace(/\{workflowDir\}/g, workflowDir);
  prompt = prompt.replace(/\{userIntent\}/g, userIntent);
  prompt = prompt.replace(/\{taskId\}/g, taskId ?? '');
  prompt = prompt.replace(/\{SUMMARY_SECTION\}/g, SUMMARY_SECTION_RULE);
  prompt = prompt.replace(/\{BASH_CATEGORIES\}/g, bashCategoryHelp(categories));
  prompt = prompt.replace(/\{ARTIFACT_QUALITY\}/g, ARTIFACT_QUALITY_RULES);
  prompt = prompt.replace(/\{EXIT_CODE_RULE\}/g, EXIT_CODE_RULE);
  // {phase} must be replaced AFTER fragment expansion (SUMMARY_SECTION contains {phase})
  prompt = prompt.replace(/\{phase\}/g, phase);

  // ACE TOON-first: inject reading instructions for TOON context handoff
  const toonFirstSection = buildToonFirstSection(phase, docsDir);
  if (toonFirstSection) {
    prompt += toonFirstSection;
  }

  // ACE Reflector: inject lessons learned from past failures
  const reflectorSection = formatLessonsForPrompt(phase);
  if (reflectorSection) {
    prompt += reflectorSection;
  }

  return prompt;
}
