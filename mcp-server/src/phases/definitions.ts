/**
 * Phase definitions - subagent templates and prompt builders
 * @spec docs/spec/features/workflow-harness.md
 */

import type { PhaseName, TaskState } from '../state/types.js';
import { PHASE_REGISTRY } from './registry.js';
import { formatLessonsForPrompt } from '../tools/reflector.js';
import {
  ARTIFACT_QUALITY_RULES,
  SUMMARY_SECTION_RULE,
  EXIT_CODE_RULE,
  PROCEDURE_ORDER_RULE,
  bashCategoryHelp,
  buildDocCategories,
  loadTraitCategories,
} from './definitions-shared.js';
import {
  getEffectiveSkippedOutputs,
  stripSkippedPhaseLines,
  resolveAndFilterInputFiles,
} from './definitions-mode-filter.js';

export { buildDocCategories, loadTraitCategories };
import * as skelA from './toon-skeletons-a.js';
import * as skelB from './toon-skeletons-b.js';
import { DEFS_STAGE0 } from './defs-stage0.js';
import { DEFS_STAGE1 } from './defs-stage1.js';
import { DEFS_STAGE2 } from './defs-stage2.js';
import { DEFS_STAGE3 } from './defs-stage3.js';
import { DEFS_STAGE4 } from './defs-stage4.js';
import { DEFS_STAGE5 } from './defs-stage5.js';
import { DEFS_STAGE6 } from './defs-stage6.js';

export type { PhaseDefinition } from './definitions-shared.js';

// ─── Phase Definitions ───────────────────────────

export const PHASE_DEFINITIONS: Partial<Record<PhaseName, import('./definitions-shared.js').PhaseDefinition>> = {
  ...DEFS_STAGE0,
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

// ─── ACE artifact-first: output filename → source phase mapping ──

export const OUTPUT_FILE_TO_PHASE: Record<string, string> = {
  'hearing.md': 'hearing',
  'scope-definition.md': 'scope_definition',
  'research.md': 'research',
  'impact-analysis.md': 'impact_analysis',
  'requirements.md': 'requirements',
  'threat-model.md': 'threat_modeling',
  'planning.md': 'planning',
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
  'docs-update.md': 'docs_update',
};

function buildArtifactFirstSection(phase: string, docsDir: string, state?: TaskState): string {
  const config = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  const resolved = resolveAndFilterInputFiles(config?.inputFiles ?? [], docsDir, state);
  const artifactFiles = resolved.filter(f => OUTPUT_FILE_TO_PHASE[f.split('/').pop() ?? ''] !== undefined);
  if (artifactFiles.length === 0) return '';
  return '\n\n成果物入力(ACE)\nread: ' + artifactFiles.join(', ') + '\n';
}

// ─── Prompt Builder ──────────────────────────────

export function buildSubagentPrompt(
  phase: string,
  taskName: string,
  docsDir: string,
  workflowDir: string,
  userIntent: string,
  taskId?: string,
  projectTraits?: Record<string, boolean>,
  refinedIntent?: string,
  docPaths?: string[],
  state?: TaskState,
): string {
  const def = getPhaseDefinition(phase);
  if (!def) return `# ${phase} phase\n\nNo template defined for this phase.`;

  const config = PHASE_REGISTRY[phase as keyof typeof PHASE_REGISTRY];
  const categories = config?.bashCategories ?? def.bashCategories;

  let prompt = def.subagentTemplate;
  // Strip verbose header blocks — replaced by compact auto-header below
  prompt = prompt.replace(/## タスク情報\n(?:- [^\n]+\n)+\n?/g, '');
  prompt = prompt.replace(/## 入力\n(?:以下のファイルを読み込んでください:\n)?(?:- [^\n]+\n)+\n?/g, '');
  prompt = prompt.replace(/^.*(?:読み込んで|ファイルを読み).*$/gm, '');
  prompt = prompt.replace(/## 出力\n[^\n]*に保存してください。\n?\n?/g, '');
  // Fragment expansion FIRST (fragments contain {phase}, {docsDir} etc.)
  prompt = prompt.replace(/\{SUMMARY_SECTION\}/g, SUMMARY_SECTION_RULE);
  prompt = prompt.replace(/\{BASH_CATEGORIES\}/g, bashCategoryHelp(categories));
  prompt = prompt.replace(/\{ARTIFACT_QUALITY\}/g, ARTIFACT_QUALITY_RULES);
  prompt = prompt.replace(/\{EXIT_CODE_RULE\}/g, EXIT_CODE_RULE);
  prompt = prompt.replace(/\{PROCEDURE_ORDER\}/g, PROCEDURE_ORDER_RULE);
  // TOON skeleton expansion
  const skeletons: Record<string, string> = { ...skelA, ...skelB };
  for (const [key, val] of Object.entries(skeletons)) {
    prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
  }
  // Variable substitution AFTER (so variables inside fragments are also replaced)
  prompt = prompt.replace(/\{taskName\}/g, taskName);
  prompt = prompt.replace(/\{docsDir\}/g, docsDir);
  prompt = prompt.replace(/\{workflowDir\}/g, workflowDir);
  prompt = prompt.replace(/\{userIntent\}/g, userIntent);
  prompt = prompt.replace(/\{taskId\}/g, taskId ?? '');
  prompt = prompt.replace(/\{phase\}/g, phase);
  prompt = prompt.replace(/\{docCategories\}/g, buildDocCategories(projectTraits, docPaths));
  // Prepend compact header (task info + input + output in 2 lines)
  // Mode-aware filter: drop inputFiles produced by skipped phases (F-201 / AC-1)
  const skippedOutputs = getEffectiveSkippedOutputs(state);
  const rawInputFiles = (config?.inputFiles ?? []).filter(f => !skippedOutputs.has(f));
  const inputFiles = rawInputFiles.map(f => f.replace(/\{docsDir\}/g, docsDir));
  const outputFile = config?.outputFile?.replace(/\{docsDir\}/g, docsDir) ?? '';
  const intentStr = refinedIntent ?? userIntent;
  const modeMap: Record<string, string> = { full: 'full', summary: 'sum', reference: 'ref' };
  const filesWithModes = inputFiles.map(f => {
    const bn = f.split('/').pop() ?? '';
    const mode = (config?.inputFileModes as Record<string, string> | undefined)?.[bn] ?? 'full';
    return `${f}[${modeMap[mode] ?? 'full'}]`;
  });
  const header = `task:${taskName} intent:${intentStr}\n`
    + (inputFiles.length > 0 ? `in: ${filesWithModes.join(', ')}\n` : '')
    + (outputFile ? `out: ${outputFile}\n` : '');

  // Insert compact header after the phase title line
  const titleEnd = prompt.indexOf('\n');
  if (titleEnd >= 0) {
    prompt = prompt.slice(0, titleEnd + 1) + header + prompt.slice(titleEnd + 1);
  } else {
    prompt = prompt + '\n' + header;
  }

  // Layer instructions for sub-agent
  const allowedTools = config?.allowedTools ?? ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash'];
  const allStandardTools = ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash'];
  const blockedTools = allStandardTools.filter(t => !allowedTools.includes(t));
  let layerSection = `\nlayer: worker\nallowedTools: ${allowedTools.join(', ')}`;
  if (blockedTools.length > 0) {
    layerSection += `\nblockedTools: ${blockedTools.join(', ')}`;
  }
  layerSection += '\n';

  // Insert layer section after the header
  const headerEndIdx = prompt.indexOf(header);
  if (headerEndIdx >= 0) {
    const insertPos = headerEndIdx + header.length;
    prompt = prompt.slice(0, insertPos) + layerSection + prompt.slice(insertPos);
  }

  // ACE artifact-first + Reflector lessons
  const artifactFirst = buildArtifactFirstSection(phase, docsDir, state);
  if (artifactFirst) prompt += artifactFirst;
  const lessons = formatLessonsForPrompt(phase);
  if (lessons) prompt += lessons;

  // Final mode-aware sweep: drop any remaining lines that reference skipped-phase
  // outputs (e.g. hard-coded 「入力」 entries embedded in subagentTemplate strings).
  return stripSkippedPhaseLines(prompt, state);
}
