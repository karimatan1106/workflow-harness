/**
 * Phase definitions: Stage 6 Verification + Release + Deploy
 * performance_test, e2e_test, docs_update, commit, push,
 * ci_verification, deploy, health_observation
 */

import type { PhaseDefinition } from './definitions-shared.js';

export const DEFS_STAGE6: Record<string, PhaseDefinition> = {
  performance_test: {
    description: 'Performance benchmarking',
    model: 'sonnet',
    bashCategories: ['readonly', 'testing'],
    inputFiles: [],
    outputFile: '{docsDir}/performance-test.toon',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 40,
    subagentTemplate: `# performance_testフェーズ

タスク情報
- タスク名: {taskName}
- 出力先: {docsDir}/

作業内容
パフォーマンステストを実施してください。
1. レスポンス時間の計測
2. メモリ使用量の確認
3. ボトルネックの特定と分析
4. 改善提案

出力
{docsDir}/performance-test.toon に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },

  e2e_test: {
    description: 'End-to-end testing',
    model: 'sonnet',
    bashCategories: ['readonly', 'testing'],
    inputFiles: [],
    outputFile: '{docsDir}/e2e-test.toon',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 40,
    subagentTemplate: `# e2e_testフェーズ

タスク情報
- タスク名: {taskName}
- 出力先: {docsDir}/

作業内容
E2Eテストを実施してください。
1. ユーザーシナリオに基づくテストの実施
2. フロントエンド・バックエンド統合の確認
3. テスト結果の記録

出力
{docsDir}/e2e-test.toon に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },

  docs_update: {
    description: 'Update specifications, README, CHANGELOG',
    model: 'sonnet',
    bashCategories: ['readonly', 'implementation'],
    inputFiles: ['{docsDir}/spec.toon', '{docsDir}/requirements.toon', '{docsDir}/code-review.toon'],
    outputFile: '{docsDir}/docs-update.toon',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 30,
    subagentTemplate: `# docs_updateフェーズ

作業内容
実装内容を永続ドキュメントに反映してください。以下の項目を確認し、該当する変更があれば更新すること。

{docCategories}

ドキュメント配置ルール
- 永続パス: docs/architecture/, docs/operations/, docs/spec/features/, CHANGELOG.md, README.md
- 一時パス: docs/workflows/{taskName}/ — ワークフロー終了後に破棄される
- ファイル名: kebab-case、対象機能名をプレフィックスに使用

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },

  commit: {
    description: 'Git commit with conventional format',
    model: 'haiku',
    bashCategories: ['readonly', 'git'],
    inputFiles: [],
    outputFile: null,
    requiredSections: [],
    minLines: 0,
    subagentTemplate: `# commitフェーズ

作業内容
Conventional Commits形式でコミットしてください。
1. 変更ファイルのステージング（git add）
2. コミットメッセージの作成（feat/fix/refactor等）
3. コミットの実行

{BASH_CATEGORIES}
{EXIT_CODE_RULE}`,
  },

  push: {
    description: 'Push to remote',
    model: 'haiku',
    bashCategories: ['readonly', 'git'],
    inputFiles: [],
    outputFile: null,
    requiredSections: [],
    minLines: 0,
    subagentTemplate: `# pushフェーズ

作業内容
リモートリポジトリにプッシュしてください。

{BASH_CATEGORIES}
{EXIT_CODE_RULE}`,
  },

  ci_verification: {
    description: 'Verify CI/CD pipeline passes',
    model: 'haiku',
    bashCategories: ['readonly'],
    inputFiles: [],
    outputFile: null,
    requiredSections: [],
    minLines: 0,
    subagentTemplate: `# ci_verificationフェーズ

作業内容
CI/CDパイプラインの結果を確認してください。

{BASH_CATEGORIES}
{EXIT_CODE_RULE}`,
  },

  deploy: {
    description: 'Deploy to target environment',
    model: 'haiku',
    bashCategories: ['readonly'],
    inputFiles: [],
    outputFile: null,
    requiredSections: [],
    minLines: 0,
    subagentTemplate: `# deployフェーズ

作業内容
対象環境へのデプロイを実施してください。

{BASH_CATEGORIES}
{EXIT_CODE_RULE}`,
  },

  health_observation: {
    description: 'Monitor post-deployment health',
    model: 'sonnet',
    bashCategories: ['readonly'],
    inputFiles: [],
    outputFile: '{docsDir}/health-report.toon',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 20,
    subagentTemplate: `# health_observationフェーズ

タスク名: {taskName}
- 出力先: {docsDir}/

作業内容
デプロイ後のヘルス状態を監視してください。
1. アプリケーションの正常動作確認
2. エラーログの確認
3. パフォーマンスメトリクスの確認

出力
{docsDir}/health-report.toon に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },
};
