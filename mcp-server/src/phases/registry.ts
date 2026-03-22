/**
 * Phase registry - defines all 30+ phases and their configurations
 * @spec docs/spec/features/workflow-phases.md
 */

import type { PhaseConfig, PhaseName, TaskSize, ParallelGroupName } from '../state/types.js';

export const PHASE_REGISTRY: Record<PhaseName, PhaseConfig> = {
  // Stage 1: Discovery
  scope_definition: { name: 'scope_definition', stage: 1, model: 'opus', inputFiles: [], outputFile: '{docsDir}/scope-definition.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 30, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], dependencies: [], allowedTools: ['Read', 'Glob', 'Grep', 'Write'] },
  research: { name: 'research', stage: 1, model: 'opus', inputFiles: ['{docsDir}/scope-definition.toon'], outputFile: '{docsDir}/research.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 50, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], dependencies: [], allowedTools: ['Read', 'Glob', 'Grep', 'Write'] },
  impact_analysis: { name: 'impact_analysis', stage: 1, model: 'opus', inputFiles: ['{docsDir}/scope-definition.toon', '{docsDir}/research.toon'], outputFile: '{docsDir}/impact-analysis.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 40, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], dependencies: [], allowedTools: ['Read', 'Glob', 'Grep', 'Write'] },
  // Stage 2: Requirements
  requirements: { name: 'requirements', stage: 2, model: 'opus', inputFiles: ['{docsDir}/research.toon', '{docsDir}/impact-analysis.toon'], outputFile: '{docsDir}/requirements.toon', requiredSections: ['decisions', 'acceptanceCriteria', 'notInScope', 'openQuestions'], minLines: 50, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], approvalRequired: 'requirements', allowedTools: ['Read', 'Glob', 'Grep', 'Write'] },
  // Stage 3: Analysis (parallel_analysis)
  threat_modeling: { name: 'threat_modeling', stage: 3, model: 'opus', inputFiles: ['{docsDir}/requirements.toon'], outputFile: '{docsDir}/threat-model.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 40, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], parallelGroup: 'parallel_analysis', allowedTools: ['Read', 'Glob', 'Grep', 'Write'] },
  planning: { name: 'planning', stage: 3, model: 'opus', inputFiles: ['{docsDir}/requirements.toon', '{docsDir}/threat-model.toon'], outputFile: '{docsDir}/planning.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 50, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], parallelGroup: 'parallel_analysis', dependencies: ['threat_modeling'], allowedTools: ['Read', 'Glob', 'Grep', 'Write'] },
  // Stage 4: Design (parallel_design)
  state_machine: { name: 'state_machine', stage: 4, model: 'haiku', inputFiles: ['{docsDir}/planning.toon'], outputFile: '{docsDir}/state-machine.mmd', requiredSections: ['decisions'], minLines: 15, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], parallelGroup: 'parallel_design', allowedTools: ['Read', 'Glob', 'Grep', 'Write'] },
  flowchart: { name: 'flowchart', stage: 4, model: 'haiku', inputFiles: ['{docsDir}/planning.toon'], outputFile: '{docsDir}/flowchart.mmd', requiredSections: ['decisions'], minLines: 15, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], parallelGroup: 'parallel_design', allowedTools: ['Read', 'Glob', 'Grep', 'Write'] },
  ui_design: { name: 'ui_design', stage: 4, model: 'opus', inputFiles: ['{docsDir}/planning.toon'], outputFile: '{docsDir}/ui-design.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 50, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], parallelGroup: 'parallel_design', allowedTools: ['Read', 'Glob', 'Grep', 'Write'] },
  // Stage 5: Design Review
  design_review: { name: 'design_review', stage: 5, model: 'opus', inputFiles: ['{docsDir}/state-machine.mmd', '{docsDir}/flowchart.mmd', '{docsDir}/ui-design.toon', '{docsDir}/planning.toon', '{docsDir}/threat-model.toon'], outputFile: '{docsDir}/design-review.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 30, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], approvalRequired: 'design', inputFileModes: { 'state-machine.mmd': 'reference', 'flowchart.mmd': 'reference', 'ui-design.toon': 'summary', 'planning.toon': 'summary', 'threat-model.toon': 'summary' }, allowedTools: ['Read', 'Glob', 'Grep', 'Write'] },
  // Stage 6: Test Planning
  test_design: { name: 'test_design', stage: 6, model: 'opus', inputFiles: ['{docsDir}/planning.toon', '{docsDir}/state-machine.mmd', '{docsDir}/flowchart.mmd'], outputFile: '{docsDir}/test-design.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 50, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], approvalRequired: 'test_design', allowedTools: ['Read', 'Glob', 'Grep', 'Write'] },
  test_selection: { name: 'test_selection', stage: 6, model: 'opus', inputFiles: ['{docsDir}/test-design.toon', '{docsDir}/impact-analysis.toon'], outputFile: '{docsDir}/test-selection.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 20, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], allowedTools: ['Read', 'Glob', 'Grep', 'Write'] },
  // Stage 7: Implementation (TDD)
  test_impl: { name: 'test_impl', stage: 7, model: 'opus', inputFiles: ['{docsDir}/test-design.toon', '{docsDir}/test-selection.toon'], allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.toon'], bashCategories: ['readonly', 'testing'], dodChecks: [], dodExemptions: ['exit_code_zero'], allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash'] },
  implementation: { name: 'implementation', stage: 7, model: 'opus', inputFiles: ['{docsDir}/planning.toon', '{docsDir}/test-design.toon'], allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.toon', '.json', '.yml', '.yaml', '.toml', '.env', '.sh'], bashCategories: ['readonly', 'testing', 'implementation'], dodChecks: [], allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash'] },
  refactoring: { name: 'refactoring', stage: 7, model: 'haiku', inputFiles: [], allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.toon'], bashCategories: ['readonly', 'testing', 'implementation'], dodChecks: [], allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash'] },
  // Stage 8: Quality (parallel_quality)
  build_check: { name: 'build_check', stage: 8, model: 'haiku', inputFiles: [], allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.json', '.yml', '.yaml', '.toml'], bashCategories: ['readonly', 'testing', 'implementation'], dodChecks: [], parallelGroup: 'parallel_quality', allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash'] },
  code_review: { name: 'code_review', stage: 8, model: 'opus', inputFiles: [], outputFile: '{docsDir}/code-review.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 30, allowedExtensions: ['.toon'], bashCategories: ['readonly'], dodChecks: [], approvalRequired: 'code_review', parallelGroup: 'parallel_quality', allowedTools: ['Read', 'Glob', 'Grep', 'Write'] },
  // Stage 9: Testing
  testing: { name: 'testing', stage: 9, model: 'haiku', inputFiles: [], allowedExtensions: ['.toon', '.ts', '.tsx', '.js'], bashCategories: ['readonly', 'testing'], dodChecks: [], allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash'] },
  regression_test: { name: 'regression_test', stage: 9, model: 'haiku', inputFiles: [], allowedExtensions: ['.toon', '.ts', '.tsx', '.js'], bashCategories: ['readonly', 'testing'], dodChecks: [], allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Bash'] },
  // Stage 10: Acceptance
  acceptance_verification: { name: 'acceptance_verification', stage: 10, model: 'opus', inputFiles: ['{docsDir}/requirements.toon', '{docsDir}/test-design.toon'], outputFile: '{docsDir}/acceptance-report.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 40, allowedExtensions: ['.toon'], bashCategories: ['readonly'], dodChecks: [], approvalRequired: 'acceptance', inputFileModes: { 'requirements.toon': 'summary', 'test-design.toon': 'full' }, allowedTools: ['Read', 'Glob', 'Grep', 'Write'] },
  // Stage 11: Verification (parallel_verification)
  manual_test: { name: 'manual_test', stage: 11, model: 'opus', inputFiles: [], outputFile: '{docsDir}/manual-test.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 40, allowedExtensions: ['.toon'], bashCategories: ['readonly', 'testing'], dodChecks: [], parallelGroup: 'parallel_verification', allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Bash'] },
  security_scan: { name: 'security_scan', stage: 11, model: 'opus', inputFiles: [], outputFile: '{docsDir}/security-scan.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 40, allowedExtensions: ['.toon'], bashCategories: ['readonly', 'testing', 'security'], dodChecks: [], parallelGroup: 'parallel_verification', allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Bash'] },
  performance_test: { name: 'performance_test', stage: 11, model: 'opus', inputFiles: [], outputFile: '{docsDir}/performance-test.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 40, allowedExtensions: ['.toon'], bashCategories: ['readonly', 'testing'], dodChecks: [], parallelGroup: 'parallel_verification', allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Bash'] },
  e2e_test: { name: 'e2e_test', stage: 11, model: 'opus', inputFiles: [], outputFile: '{docsDir}/e2e-test.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 40, allowedExtensions: ['.toon', '.ts', '.tsx', '.js'], bashCategories: ['readonly', 'testing'], dodChecks: [], parallelGroup: 'parallel_verification', allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Bash'] },
  // Stage 12: Documentation
  docs_update: { name: 'docs_update', stage: 12, model: 'haiku', inputFiles: ['{docsDir}/planning.toon', '{docsDir}/requirements.toon', '{docsDir}/code-review.toon'], outputFile: '{docsDir}/docs-update.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 30, allowedExtensions: ['.toon', '.md', '.mdx'], bashCategories: ['readonly'], dodChecks: [], inputFileModes: { 'planning.toon': 'summary', 'requirements.toon': 'summary', 'code-review.toon': 'summary' }, allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Edit'] },
  // Stage 13: Release
  commit: { name: 'commit', stage: 13, model: 'opus', inputFiles: [], allowedExtensions: [], bashCategories: ['readonly', 'git'], dodChecks: [], allowedTools: ['Read', 'Glob', 'Grep', 'Bash'] },
  push: { name: 'push', stage: 13, model: 'opus', inputFiles: [], allowedExtensions: [], bashCategories: ['readonly', 'git'], dodChecks: [], allowedTools: ['Read', 'Glob', 'Grep', 'Bash'] },
  ci_verification: { name: 'ci_verification', stage: 13, model: 'haiku', inputFiles: [], allowedExtensions: ['.toon'], bashCategories: ['readonly'], dodChecks: [], allowedTools: ['Read', 'Glob', 'Grep'] },
  // Stage 14: Deployment
  deploy: { name: 'deploy', stage: 14, model: 'haiku', inputFiles: [], allowedExtensions: ['.toon'], bashCategories: ['readonly'], dodChecks: [], allowedTools: ['Read', 'Glob', 'Grep', 'Bash'] },
  health_observation: { name: 'health_observation', stage: 14, model: 'haiku', inputFiles: [], outputFile: '{docsDir}/health-report.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 20, allowedExtensions: ['.toon'], bashCategories: ['readonly'], dodChecks: [], allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Bash'] },
  // Terminal State
  completed: { name: 'completed', stage: 99, model: 'opus', inputFiles: [], allowedExtensions: [], bashCategories: ['readonly'], dodChecks: [], allowedTools: ['Read'] },
};

export const PHASE_ORDER: PhaseName[] = [
  'scope_definition',
  'research',
  'impact_analysis',
  'requirements',
  'threat_modeling',
  'planning',
  'state_machine',
  'flowchart',
  'ui_design',
  'design_review',
  'test_design',
  'test_selection',
  'test_impl',
  'implementation',
  'refactoring',
  'build_check',
  'code_review',
  'testing',
  'regression_test',
  'acceptance_verification',
  'manual_test',
  'security_scan',
  'performance_test',
  'e2e_test',
  'docs_update',
  'commit',
  'push',
  'ci_verification',
  'deploy',
  'health_observation',
  'completed',
];

export const SIZE_SKIP_MAP: Record<TaskSize, PhaseName[]> = {
  small: [],
  medium: [],
  large: [],
};

export const SIZE_MINLINES_FACTOR: Record<TaskSize, number> = {
  small: 0.6,
  medium: 1.0,
  large: 1.0,
};

export function getActivePhases(size: TaskSize): PhaseName[] {
  const skip = SIZE_SKIP_MAP[size];
  return PHASE_ORDER.filter((p) => !skip.includes(p));
}

export function getNextPhase(
  currentPhase: PhaseName,
  size: TaskSize,
): PhaseName | null {
  const active = getActivePhases(size);
  const idx = active.indexOf(currentPhase);
  if (idx === -1 || idx === active.length - 1) return null;
  return active[idx + 1];
}

export function getParallelGroup(phase: PhaseName): ParallelGroupName | null {
  const config = PHASE_REGISTRY[phase];
  return config?.parallelGroup ?? null;
}

export function getPhasesInGroup(group: ParallelGroupName): PhaseName[] {
  return PHASE_ORDER.filter(
    (p) => PHASE_REGISTRY[p]?.parallelGroup === group,
  );
}

export function isParallelPhase(phase: PhaseName): boolean {
  return getParallelGroup(phase) !== null;
}

export function getActiveParallelGroups(size: TaskSize): ParallelGroupName[] {
  const active = getActivePhases(size);
  const groups = new Set<ParallelGroupName>();
  for (const p of active) {
    const g = getParallelGroup(p);
    if (g) groups.add(g);
  }
  return [...groups];
}

export function getPhaseConfig(phase: PhaseName, size?: TaskSize): PhaseConfig {
  const config = PHASE_REGISTRY[phase];
  if (!config) throw new Error(`Unknown phase: ${phase}`);
  if (size && SIZE_MINLINES_FACTOR[size] !== 1.0) {
    return { ...config, minLines: Math.max(20, Math.floor((config.minLines ?? 0) * SIZE_MINLINES_FACTOR[size])) };
  }
  return config;
}
