/**
 * Phase registry - defines all 30+ phases and their configurations
 * @spec docs/spec/features/workflow-phases.md
 */

import type { PhaseConfig, PhaseName, TaskSize, ParallelGroupName } from '../state/types.js';

export const PHASE_REGISTRY: Record<PhaseName, PhaseConfig> = {
  // Stage 1: Discovery
  scope_definition: { name: 'scope_definition', stage: 1, model: 'sonnet', inputFiles: [], outputFile: '{docsDir}/scope-definition.md', requiredSections: ['## サマリー', '## スコープ定義', '## 影響範囲', '## スコープ外'], minLines: 30, allowedExtensions: ['.md', '.mmd'], bashCategories: ['readonly'], dodChecks: [], dependencies: [] },
  research: { name: 'research', stage: 1, model: 'sonnet', inputFiles: ['{docsDir}/scope-definition.md'], outputFile: '{docsDir}/research.md', requiredSections: ['## サマリー', '## 調査結果', '## 既存実装の分析'], minLines: 50, allowedExtensions: ['.md', '.mmd'], bashCategories: ['readonly'], dodChecks: [], dependencies: [] },
  impact_analysis: { name: 'impact_analysis', stage: 1, model: 'sonnet', inputFiles: ['{docsDir}/scope-definition.md', '{docsDir}/research.md'], outputFile: '{docsDir}/impact-analysis.md', requiredSections: ['## サマリー', '## 影響ファイル一覧', '## 依存関係分析', '## リスク評価'], minLines: 40, allowedExtensions: ['.md', '.mmd'], bashCategories: ['readonly'], dodChecks: [], dependencies: [] },
  // Stage 2: Requirements
  requirements: { name: 'requirements', stage: 2, model: 'sonnet', inputFiles: ['{docsDir}/research.md', '{docsDir}/impact-analysis.md'], outputFile: '{docsDir}/requirements.md', requiredSections: ['## サマリー', '## 機能要件', '## 非機能要件', '## 受入基準'], minLines: 50, allowedExtensions: ['.md', '.mmd'], bashCategories: ['readonly'], dodChecks: [], approvalRequired: 'requirements' },
  // Stage 3: Analysis (parallel_analysis)
  threat_modeling: { name: 'threat_modeling', stage: 3, model: 'sonnet', inputFiles: ['{docsDir}/requirements.md'], outputFile: '{docsDir}/threat-model.md', requiredSections: ['## サマリー', '## 脅威シナリオ', '## リスク評価', '## セキュリティ要件'], minLines: 40, allowedExtensions: ['.md', '.mmd'], bashCategories: ['readonly'], dodChecks: [], parallelGroup: 'parallel_analysis' },
  planning: { name: 'planning', stage: 3, model: 'sonnet', inputFiles: ['{docsDir}/requirements.md', '{docsDir}/threat-model.md'], outputFile: '{docsDir}/spec.md', requiredSections: ['## サマリー', '## 概要', '## 実装計画', '## 変更対象ファイル'], minLines: 50, allowedExtensions: ['.md', '.mmd'], bashCategories: ['readonly'], dodChecks: [], parallelGroup: 'parallel_analysis', dependencies: ['threat_modeling'] },
  // Stage 4: Design (parallel_design)
  state_machine: { name: 'state_machine', stage: 4, model: 'haiku', inputFiles: ['{docsDir}/spec.md'], outputFile: '{docsDir}/state-machine.mmd', requiredSections: ['## サマリー'], minLines: 15, allowedExtensions: ['.md', '.mmd'], bashCategories: ['readonly'], dodChecks: [], parallelGroup: 'parallel_design' },
  flowchart: { name: 'flowchart', stage: 4, model: 'haiku', inputFiles: ['{docsDir}/spec.md'], outputFile: '{docsDir}/flowchart.mmd', requiredSections: ['## サマリー'], minLines: 15, allowedExtensions: ['.md', '.mmd'], bashCategories: ['readonly'], dodChecks: [], parallelGroup: 'parallel_design' },
  ui_design: { name: 'ui_design', stage: 4, model: 'sonnet', inputFiles: ['{docsDir}/spec.md'], outputFile: '{docsDir}/ui-design.md', requiredSections: ['## サマリー', '## コンポーネント設計', '## 画面構成', '## インタラクション'], minLines: 50, allowedExtensions: ['.md', '.mmd'], bashCategories: ['readonly'], dodChecks: [], parallelGroup: 'parallel_design' },
  // Stage 5: Design Review
  design_review: { name: 'design_review', stage: 5, model: 'sonnet', inputFiles: ['{docsDir}/state-machine.mmd', '{docsDir}/flowchart.mmd', '{docsDir}/ui-design.md', '{docsDir}/spec.md', '{docsDir}/threat-model.md'], outputFile: '{docsDir}/design-review.md', requiredSections: ['## サマリー', '## AC→設計マッピング'], minLines: 30, allowedExtensions: ['.md', '.mmd'], bashCategories: ['readonly'], dodChecks: [], approvalRequired: 'design' },
  // Stage 6: Test Planning
  test_design: { name: 'test_design', stage: 6, model: 'sonnet', inputFiles: ['{docsDir}/spec.md', '{docsDir}/state-machine.mmd', '{docsDir}/flowchart.mmd'], outputFile: '{docsDir}/test-design.md', requiredSections: ['## サマリー', '## テスト方針', '## テストケース'], minLines: 50, allowedExtensions: ['.md'], bashCategories: ['readonly'], dodChecks: [], approvalRequired: 'test_design' },
  test_selection: { name: 'test_selection', stage: 6, model: 'haiku', inputFiles: ['{docsDir}/test-design.md', '{docsDir}/impact-analysis.md'], outputFile: '{docsDir}/test-selection.md', requiredSections: ['## サマリー', '## 選択テスト一覧', '## 実行コマンド'], minLines: 20, allowedExtensions: ['.md'], bashCategories: ['readonly'], dodChecks: [] },
  // Stage 7: Implementation (TDD)
  test_impl: { name: 'test_impl', stage: 7, model: 'sonnet', inputFiles: ['{docsDir}/test-design.md', '{docsDir}/test-selection.md'], allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.md'], bashCategories: ['readonly', 'testing'], dodChecks: [] },
  implementation: { name: 'implementation', stage: 7, model: 'sonnet', inputFiles: ['{docsDir}/spec.md', '{docsDir}/test-design.md'], allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.md', '.json', '.yml', '.yaml', '.toml', '.env', '.sh'], bashCategories: ['readonly', 'testing', 'implementation'], dodChecks: [] },
  refactoring: { name: 'refactoring', stage: 7, model: 'haiku', inputFiles: [], allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.md'], bashCategories: ['readonly', 'testing', 'implementation'], dodChecks: [] },
  // Stage 8: Quality (parallel_quality)
  build_check: { name: 'build_check', stage: 8, model: 'haiku', inputFiles: [], allowedExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.json', '.yml', '.yaml', '.toml'], bashCategories: ['readonly', 'testing', 'implementation'], dodChecks: [], parallelGroup: 'parallel_quality' },
  code_review: { name: 'code_review', stage: 8, model: 'sonnet', inputFiles: [], outputFile: '{docsDir}/code-review.md', requiredSections: ['## サマリー', '## 設計-実装整合性', '## ユーザー意図との整合性'], minLines: 30, allowedExtensions: ['.md'], bashCategories: ['readonly'], dodChecks: [], approvalRequired: 'code_review', parallelGroup: 'parallel_quality' },
  // Stage 9: Testing
  testing: { name: 'testing', stage: 9, model: 'haiku', inputFiles: [], allowedExtensions: ['.md', '.ts', '.tsx', '.js'], bashCategories: ['readonly', 'testing'], dodChecks: [] },
  regression_test: { name: 'regression_test', stage: 9, model: 'haiku', inputFiles: [], allowedExtensions: ['.md', '.ts', '.tsx', '.js'], bashCategories: ['readonly', 'testing'], dodChecks: [] },
  // Stage 10: Acceptance
  acceptance_verification: { name: 'acceptance_verification', stage: 10, model: 'sonnet', inputFiles: ['{docsDir}/requirements.md', '{docsDir}/test-design.md'], outputFile: '{docsDir}/acceptance-report.md', requiredSections: ['## サマリー', '## 受入基準', '## 検証結果'], minLines: 40, allowedExtensions: ['.md'], bashCategories: ['readonly'], dodChecks: [], approvalRequired: 'acceptance' },
  // Stage 11: Verification (parallel_verification)
  manual_test: { name: 'manual_test', stage: 11, model: 'sonnet', inputFiles: [], outputFile: '{docsDir}/manual-test.md', requiredSections: ['## サマリー', '## テストシナリオ', '## テスト結果'], minLines: 40, allowedExtensions: ['.md'], bashCategories: ['readonly', 'testing'], dodChecks: [], parallelGroup: 'parallel_verification' },
  security_scan: { name: 'security_scan', stage: 11, model: 'sonnet', inputFiles: [], outputFile: '{docsDir}/security-scan.md', requiredSections: ['## サマリー', '## 脆弱性スキャン結果', '## 検出された問題'], minLines: 40, allowedExtensions: ['.md'], bashCategories: ['readonly', 'testing', 'security'], dodChecks: [], parallelGroup: 'parallel_verification' },
  performance_test: { name: 'performance_test', stage: 11, model: 'sonnet', inputFiles: [], outputFile: '{docsDir}/performance-test.md', requiredSections: ['## サマリー', '## パフォーマンス計測結果', '## ボトルネック分析'], minLines: 40, allowedExtensions: ['.md'], bashCategories: ['readonly', 'testing'], dodChecks: [], parallelGroup: 'parallel_verification' },
  e2e_test: { name: 'e2e_test', stage: 11, model: 'sonnet', inputFiles: [], outputFile: '{docsDir}/e2e-test.md', requiredSections: ['## サマリー', '## E2Eテストシナリオ', '## テスト実行結果'], minLines: 40, allowedExtensions: ['.md', '.ts', '.tsx', '.js'], bashCategories: ['readonly', 'testing'], dodChecks: [], parallelGroup: 'parallel_verification' },
  // Stage 12: Documentation
  docs_update: { name: 'docs_update', stage: 12, model: 'haiku', inputFiles: [], allowedExtensions: ['.md', '.mdx'], bashCategories: ['readonly'], dodChecks: [] },
  // Stage 13: Release
  commit: { name: 'commit', stage: 13, model: 'haiku', inputFiles: [], allowedExtensions: [], bashCategories: ['readonly', 'git'], dodChecks: [] },
  push: { name: 'push', stage: 13, model: 'haiku', inputFiles: [], allowedExtensions: [], bashCategories: ['readonly', 'git'], dodChecks: [] },
  ci_verification: { name: 'ci_verification', stage: 13, model: 'haiku', inputFiles: [], allowedExtensions: ['.md'], bashCategories: ['readonly'], dodChecks: [] },
  // Stage 14: Deployment
  deploy: { name: 'deploy', stage: 14, model: 'haiku', inputFiles: [], allowedExtensions: ['.md'], bashCategories: ['readonly'], dodChecks: [] },
  health_observation: { name: 'health_observation', stage: 14, model: 'sonnet', inputFiles: [], outputFile: '{docsDir}/health-report.md', requiredSections: ['## サマリー', '## ヘルス状態', '## パフォーマンス計測結果'], minLines: 20, allowedExtensions: ['.md'], bashCategories: ['readonly'], dodChecks: [] },
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
