/**
 * Phase definitions: Stage 5 Testing + Acceptance
 * testing, regression_test, acceptance_verification, manual_test, security_scan
 */

import type { PhaseDefinition } from './definitions-shared.js';

export const DEFS_STAGE5: Record<string, PhaseDefinition> = {
  testing: {
    description: 'Execute all tests and capture results',
    model: 'haiku',
    bashCategories: ['readonly', 'testing'],
    inputFiles: [],
    outputFile: null,
    requiredSections: [],
    minLines: 0,
    subagentTemplate: `# testingフェーズ

タスク情報
- タスク名: {taskName}
- タスクID: {taskId}

作業内容
全テストを実行し結果を記録してください。
1. テストスイートの実行
2. harness_capture_baselineでベースラインを記録
3. harness_record_test_resultで結果を記録
4. 失敗テストの分析

{BASH_CATEGORIES}
{EXIT_CODE_RULE}`,
  },

  regression_test: {
    description: 'Compare test results against baseline',
    model: 'haiku',
    bashCategories: ['readonly', 'testing'],
    inputFiles: [],
    outputFile: null,
    requiredSections: [],
    minLines: 0,
    subagentTemplate: `# regression_testフェーズ

タスク情報
- タスク名: {taskName}
- タスクID: {taskId}

作業内容
ベースラインとテスト結果を比較してリグレッションを検出してください。
1. 前回のベースラインと現在のテスト結果を比較
2. 新たに失敗したテストの特定
3. 変更に起因する失敗は修正
4. 変更に起因しない失敗はharness_record_known_bugで記録

{BASH_CATEGORIES}
{EXIT_CODE_RULE}`,
  },

  acceptance_verification: {
    description: 'Verify all acceptance criteria are met',
    model: 'sonnet',
    bashCategories: ['readonly'],
    inputFiles: ['{docsDir}/requirements.toon', '{docsDir}/test-design.toon'],
    outputFile: '{docsDir}/acceptance-report.toon',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 40,
    subagentTemplate: `# acceptance_verificationフェーズ

タスク情報
- タスク名: {taskName}
- ユーザー意図: {userIntent}
- 出力先: {docsDir}/

入力
- {docsDir}/requirements.toon
- {docsDir}/test-design.toon

作業内容
全受入基準（AC-N）が満たされているか検証してください。
1. 各AC-Nの達成状態を確認
2. テスト結果との対応を検証
3. ユーザー意図との最終整合性確認

出力
{docsDir}/acceptance-report.toon に保存してください。

承認ゲートです。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },

  manual_test: {
    description: 'Manual testing scenarios',
    model: 'sonnet',
    bashCategories: ['readonly', 'testing'],
    inputFiles: [],
    outputFile: '{docsDir}/manual-test.toon',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 40,
    subagentTemplate: `# manual_testフェーズ

タスク情報
- タスク名: {taskName}
- 出力先: {docsDir}/

作業内容
手動テストシナリオを実施し結果を記録してください。
1. ユーザー体験の観点からテストシナリオを作成
2. 各シナリオを実施し結果を記録
3. 発見した問題を報告

出力
{docsDir}/manual-test.toon に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },

  security_scan: {
    description: 'Security vulnerability scanning',
    model: 'sonnet',
    bashCategories: ['readonly', 'testing', 'security'],
    inputFiles: [],
    outputFile: '{docsDir}/security-scan.toon',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 40,
    subagentTemplate: `# security_scanフェーズ

タスク情報
- タスク名: {taskName}
- 出力先: {docsDir}/

作業内容
セキュリティ脆弱性のスキャンを実施してください。
1. 依存パッケージのセキュリティチェック
2. コードのセキュリティパターン分析
3. OWASP Top 10の観点からの検証
4. 検出された問題と対策を記録

出力
{docsDir}/security-scan.toon に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },
};
