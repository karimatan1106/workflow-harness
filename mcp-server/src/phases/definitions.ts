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
  'scope-definition.toon': 'scope_definition',
  'research.toon': 'research',
  'impact-analysis.toon': 'impact_analysis',
  'requirements.toon': 'requirements',
  'threat-model.toon': 'threat_modeling',
  'spec.toon': 'planning',
  'state-machine.mmd': 'state_machine',
  'flowchart.mmd': 'flowchart',
  'ui-design.toon': 'ui_design',
  'test-design.toon': 'test_design',
  'test-selection.toon': 'test_selection',
  'code-review.toon': 'code_review',
  'acceptance-report.toon': 'acceptance_verification',
  'manual-test.toon': 'manual_test',
  'security-scan.toon': 'security_scan',
  'performance-test.toon': 'performance_test',
  'e2e-test.toon': 'e2e_test',
};

function buildToonFirstSection(phase: string, docsDir: string): string {
  const config = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  const inputFiles = config?.inputFiles ?? [];
  if (inputFiles.length === 0) return '';
  const resolved = inputFiles.map(f => f.replace(/\{docsDir\}/g, docsDir));
  const toonFiles = resolved.filter(f => {
    const basename = f.split('/').pop() ?? '';
    return OUTPUT_FILE_TO_PHASE[basename] !== undefined;
  });
  if (toonFiles.length === 0) return '';
  return '\n\n=== TOON入力(ACE) ===\nread: ' + toonFiles.join(', ') + '\n';
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
  // Strip verbose header blocks — replaced by compact auto-header below
  prompt = prompt.replace(/## タスク情報\n(?:- [^\n]+\n)+\n?/g, '');
  prompt = prompt.replace(/## 入力\n(?:以下のファイルを読み込んでください:\n)?(?:- [^\n]+\n)+\n?/g, '');
  prompt = prompt.replace(/## 出力\n[^\n]*に保存してください。\n?\n?/g, '');
  // Fragment expansion FIRST (fragments contain {phase}, {docsDir} etc.)
  prompt = prompt.replace(/\{SUMMARY_SECTION\}/g, SUMMARY_SECTION_RULE);
  prompt = prompt.replace(/\{BASH_CATEGORIES\}/g, bashCategoryHelp(categories));
  prompt = prompt.replace(/\{ARTIFACT_QUALITY\}/g, ARTIFACT_QUALITY_RULES);
  prompt = prompt.replace(/\{EXIT_CODE_RULE\}/g, EXIT_CODE_RULE);
  // Variable substitution AFTER (so variables inside fragments are also replaced)
  prompt = prompt.replace(/\{taskName\}/g, taskName);
  prompt = prompt.replace(/\{docsDir\}/g, docsDir);
  prompt = prompt.replace(/\{workflowDir\}/g, workflowDir);
  prompt = prompt.replace(/\{userIntent\}/g, userIntent);
  prompt = prompt.replace(/\{taskId\}/g, taskId ?? '');
  prompt = prompt.replace(/\{phase\}/g, phase);
  // Prepend compact header (task info + input + output in 2 lines)
  const inputFiles = config?.inputFiles?.map(f => f.replace(/\{docsDir\}/g, docsDir)) ?? [];
  const outputFile = config?.outputFile?.replace(/\{docsDir\}/g, docsDir) ?? '';
  const header = `task:${taskName} intent:${userIntent}\n`
    + (inputFiles.length > 0 ? `in: ${inputFiles.join(', ')}\n` : '')
    + (outputFile ? `out: ${outputFile}\n` : '');

  // Insert compact header after the phase title line
  const titleEnd = prompt.indexOf('\n');
  if (titleEnd >= 0) {
    prompt = prompt.slice(0, titleEnd + 1) + header + prompt.slice(titleEnd + 1);
  } else {
    prompt = prompt + '\n' + header;
  }

  // ACE TOON-first + Reflector lessons
  const toonFirst = buildToonFirstSection(phase, docsDir);
  if (toonFirst) prompt += toonFirst;
  const lessons = formatLessonsForPrompt(phase);
  if (lessons) prompt += lessons;

  // Replace ## Markdown headers with === delimiters to prevent format contamination
  // Subagents seeing ## in prompts may replicate it in .toon output, causing parse errors
  prompt = prompt.replace(/^## /gm, '=== ').replace(/^### /gm, '== ');

  return prompt;
}
