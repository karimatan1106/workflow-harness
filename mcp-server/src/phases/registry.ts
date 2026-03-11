/**
 * Phase registry - defines all 30+ phases and their configurations
 * @spec docs/spec/features/workflow-phases.md
 */

import type { PhaseConfig, PhaseName, TaskSize, ParallelGroupName } from '../state/types.js';

export const PHASE_REGISTRY: Record<PhaseName, PhaseConfig> = {
  // Stage 1: Discovery
  scope_definition: { name: 'scope_definition', stage: 1, model: 'sonnet', inputFiles: [], outputFile: '{docsDir}/scope-definition.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 30, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], dependencies: [] },
  research: { name: 'research', stage: 1, model: 'sonnet', inputFiles: ['{docsDir}/scope-definition.toon'], outputFile: '{docsDir}/research.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 50, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], dependencies: [] },
  impact_analysis: { name: 'impact_analysis', stage: 1, model: 'sonnet', inputFiles: ['{docsDir}/scope-definition.toon', '{docsDir}/research.toon'], outputFile: '{docsDir}/impact-analysis.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 40, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], dependencies: [] },
  // Stage 2: Requirements
  requirements: { name: 'requirements', stage: 2, model: 'sonnet', inputFiles: ['{docsDir}/research.toon', '{docsDir}/impact-analysis.toon'], outputFile: '{docsDir}/requirements.toon', requiredSections: ['decisions', 'acceptanceCriteria', 'notInScope', 'openQuestions'], minLines: 50, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], approvalRequired: 'requirements' },
  // Stage 3: Analysis (parallel_analysis)
  threat_modeling: { name: 'threat_modeling', stage: 3, model: 'sonnet', inputFiles: ['{docsDir}/requirements.toon'], outputFile: '{docsDir}/threat-model.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 40, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], parallelGroup: 'parallel_analysis' },
  planning: { name: 'planning', stage: 3, model: 'sonnet', inputFiles: ['{docsDir}/requirements.toon', '{docsDir}/threat-model.toon'], outputFile: '{docsDir}/planning.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 50, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], parallelGroup: 'parallel_analysis', dependencies: ['threat_modeling'] },
  // Stage 4: Design (parallel_design)
  state_machine: { name: 'state_machine', stage: 4, model: 'haiku', inputFiles: ['{docsDir}/planning.toon'], outputFile: '{docsDir}/state-machine.mmd', requiredSections: ['decisions'], minLines: 15, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], parallelGroup: 'parallel_design' },
  flowchart: { name: 'flowchart', stage: 4, model: 'haiku', inputFiles: ['{docsDir}/planning.toon'], outputFile: '{docsDir}/flowchart.mmd', requiredSections: ['decisions'], minLines: 15, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], parallelGroup: 'parallel_design' },
  ui_design: { name: 'ui_design', stage: 4, model: 'sonnet', inputFiles: ['{docsDir}/planning.toon'], outputFile: '{docsDir}/ui-design.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 50, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], parallelGroup: 'parallel_design' },
  // Stage 5: Design Review
  design_review: { name: 'design_review', stage: 5, model: 'sonnet', inputFiles: ['{docsDir}/state-machine.mmd', '{docsDir}/flowchart.mmd', '{docsDir}/ui-design.toon', '{docsDir}/planning.toon', '{docsDir}/threat-model.toon'], outputFile: '{docsDir}/design-review.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 30, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], approvalRequired: 'design', inputFileModes: { 'state-machine.mmd': 'reference', 'flowchart.mmd': 'reference', 'ui-design.toon': 'summary', 'planning.toon': 'summary', 'threat-model.toon': 'summary' } },
  // Stage 6: Test Planning
  test_design: { name: 'test_design', stage: 6, model: 'sonnet', inputFiles: ['{docsDir}/planning.toon', '{docsDir}/state-machine.mmd', '{docsDir}/flowchart.mmd'], outputFile: '{docsDir}/test-design.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 50, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [], approvalRequired: 'test_design' },
  test_selection: { name: 'test_selection', stage: 6, model: 'haiku', inputFiles: ['{docsDir}/test-design.toon', '{docsDir}/impact-analysis.toon'], outputFile: '{docsDir}/test-selection.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 20, allowedExtensions: ['.toon', '.mmd'], bashCategories: ['readonly'], dodChecks: [] },
  // Stage 7: Implementation (TDD)
  test_impl: { name: 'test_impl', stage: 7, model: 'sonnet', inputFiles: ['{docsDir}/test-design.toon', '{docsDir}/test-selection.toon'], allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.toon'], bashCategories: ['readonly', 'testing'], dodChecks: [], dodExemptions: ['exit_code_zero'] },
  implementation: { name: 'implementation', stage: 7, model: 'sonnet', inputFiles: ['{docsDir}/planning.toon', '{docsDir}/test-design.toon'], allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.toon', '.json', '.yml', '.yaml', '.toml', '.env', '.sh'], bashCategories: ['readonly', 'testing', 'implementation'], dodChecks: [] },
  refactoring: { name: 'refactoring', stage: 7, model: 'haiku', inputFiles: [], allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.toon'], bashCategories: ['readonly', 'testing', 'implementation'], dodChecks: [] },
  // Stage 8: Quality (parallel_quality)
  build_check: { name: 'build_check', stage: 8, model: 'haiku', inputFiles: [], allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.json', '.yml', '.yaml', '.toml'], bashCategories: ['readonly', 'testing', 'implementation'], dodChecks: [], parallelGroup: 'parallel_quality' },
  code_review: { name: 'code_review', stage: 8, model: 'sonnet', inputFiles: [], outputFile: '{docsDir}/code-review.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 30, allowedExtensions: ['.toon'], bashCategories: ['readonly'], dodChecks: [], approvalRequired: 'code_review', parallelGroup: 'parallel_quality' },
  // Stage 9: Testing
  testing: { name: 'testing', stage: 9, model: 'haiku', inputFiles: [], allowedExtensions: ['.toon', '.ts', '.tsx', '.js'], bashCategories: ['readonly', 'testing'], dodChecks: [] },
  regression_test: { name: 'regression_test', stage: 9, model: 'haiku', inputFiles: [], allowedExtensions: ['.toon', '.ts', '.tsx', '.js'], bashCategories: ['readonly', 'testing'], dodChecks: [] },
  // Stage 10: Acceptance
  acceptance_verification: { name: 'acceptance_verification', stage: 10, model: 'sonnet', inputFiles: ['{docsDir}/requirements.toon', '{docsDir}/test-design.toon'], outputFile: '{docsDir}/acceptance-report.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 40, allowedExtensions: ['.toon'], bashCategories: ['readonly'], dodChecks: [], approvalRequired: 'acceptance', inputFileModes: { 'requirements.toon': 'summary', 'test-design.toon': 'full' } },
  // Stage 11: Verification (parallel_verification)
  manual_test: { name: 'manual_test', stage: 11, model: 'sonnet', inputFiles: [], outputFile: '{docsDir}/manual-test.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 40, allowedExtensions: ['.toon'], bashCategories: ['readonly', 'testing'], dodChecks: [], parallelGroup: 'parallel_verification' },
  security_scan: { name: 'security_scan', stage: 11, model: 'sonnet', inputFiles: [], outputFile: '{docsDir}/security-scan.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 40, allowedExtensions: ['.toon'], bashCategories: ['readonly', 'testing', 'security'], dodChecks: [], parallelGroup: 'parallel_verification' },
  performance_test: { name: 'performance_test', stage: 11, model: 'sonnet', inputFiles: [], outputFile: '{docsDir}/performance-test.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 40, allowedExtensions: ['.toon'], bashCategories: ['readonly', 'testing'], dodChecks: [], parallelGroup: 'parallel_verification' },
  e2e_test: { name: 'e2e_test', stage: 11, model: 'sonnet', inputFiles: [], outputFile: '{docsDir}/e2e-test.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 40, allowedExtensions: ['.toon', '.ts', '.tsx', '.js'], bashCategories: ['readonly', 'testing'], dodChecks: [], parallelGroup: 'parallel_verification' },
  // Stage 12: Documentation
  docs_update: { name: 'docs_update', stage: 12, model: 'sonnet', inputFiles: ['{docsDir}/planning.toon', '{docsDir}/requirements.toon', '{docsDir}/code-review.toon'], outputFile: '{docsDir}/docs-update.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 30, allowedExtensions: ['.toon', '.md', '.mdx'], bashCategories: ['readonly', 'implementation'], dodChecks: [], inputFileModes: { 'planning.toon': 'summary', 'requirements.toon': 'summary', 'code-review.toon': 'summary' } },
  // Stage 13: Release
  commit: { name: 'commit', stage: 13, model: 'haiku', inputFiles: [], allowedExtensions: [], bashCategories: ['readonly', 'git'], dodChecks: [] },
  push: { name: 'push', stage: 13, model: 'haiku', inputFiles: [], allowedExtensions: [], bashCategories: ['readonly', 'git'], dodChecks: [] },
  ci_verification: { name: 'ci_verification', stage: 13, model: 'haiku', inputFiles: [], allowedExtensions: ['.toon'], bashCategories: ['readonly'], dodChecks: [] },
  // Stage 14: Deployment
  deploy: { name: 'deploy', stage: 14, model: 'haiku', inputFiles: [], allowedExtensions: ['.toon'], bashCategories: ['readonly'], dodChecks: [] },
  health_observation: { name: 'health_observation', stage: 14, model: 'sonnet', inputFiles: [], outputFile: '{docsDir}/health-report.toon', requiredSections: ['decisions', 'artifacts', 'next'], minLines: 20, allowedExtensions: ['.toon'], bashCategories: ['readonly'], dodChecks: [] },
  // Terminal State
  completed: { name: 'completed', stage: 99, model: 'haiku', inputFiles: [], allowedExtensions: [], bashCategories: ['readonly'], dodChecks: [] },
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
  small: [
    'impact_analysis',
    'threat_modeling',
    'state_machine',
    'flowchart',
    'ui_design',
    'design_review',
    'test_selection',
    'refactoring',
    'code_review',
    'regression_test',
    'acceptance_verification',
    'manual_test',
    'security_scan',
    'performance_test',
    'e2e_test',
    'docs_update',
    'ci_verification',
    'deploy',
    'health_observation',
  ],
  medium: [
    'impact_analysis',
    'state_machine',
    'flowchart',
    'ui_design',
    'design_review',
    'test_selection',
    'refactoring',
    'acceptance_verification',
  ],
  large: [],
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

export function getPhaseConfig(phase: PhaseName): PhaseConfig {
  const config = PHASE_REGISTRY[phase];
  if (!config) throw new Error(`Unknown phase: ${phase}`);
  return config;
}
