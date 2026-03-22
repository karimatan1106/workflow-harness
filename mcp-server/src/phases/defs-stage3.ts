/**
 * Phase definitions: Stage 3 Review + Test Planning
 * design_review, test_design, test_selection
 */

import type { PhaseDefinition } from './definitions-shared.js';

export const DEFS_STAGE3: Record<string, PhaseDefinition> = {
  design_review: {
    description: 'Review design artifacts for consistency',
    model: 'opus',
    bashCategories: ['readonly'],
    inputFiles: ['{docsDir}/state-machine.mmd', '{docsDir}/flowchart.mmd', '{docsDir}/ui-design.toon', '{docsDir}/planning.toon', '{docsDir}/threat-model.toon'],
    outputFile: '{docsDir}/design-review.toon',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 30,
    subagentTemplate: `# design_reviewフェーズ

タスク情報
- タスク名: {taskName}
- 出力先: {docsDir}/

入力
以下の全設計成果物を読み込んでレビューしてください:
- {docsDir}/planning.toon
- {docsDir}/state-machine.mmd
- {docsDir}/flowchart.mmd
- {docsDir}/ui-design.toon
- {docsDir}/threat-model.toon

作業内容
設計成果物の整合性を検証してください。
1. planning.toonと各設計図の一貫性
2. 要件（requirements.toon）との対応関係
3. セキュリティ要件の反映確認
4. AC-Nと設計要素の対応表を作成

★必須: AC→設計マッピングテーブル (IA-3)
全てのAC-Nに対応する設計要素を以下の形式でマッピングすること:
| AC-N | 設計コンポーネント | 仕様書参照 |
|----|-------------|---------|
| AC-1 | (対応する設計要素) | planning.toon §X.Y |
全てのACにマッピングが必要。空欄のACがある場合、承認がブロックされる。

出力
{docsDir}/design-review.toon に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },

  test_design: {
    description: 'Test strategy and test cases mapped to AC-N',
    model: 'opus',
    bashCategories: ['readonly'],
    inputFiles: ['{docsDir}/planning.toon', '{docsDir}/state-machine.mmd', '{docsDir}/flowchart.mmd'],
    outputFile: '{docsDir}/test-design.toon',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 50,
    subagentTemplate: `# test_designフェーズ

タスク情報
- タスク名: {taskName}
- 出力先: {docsDir}/

入力
- {docsDir}/planning.toon
- {docsDir}/state-machine.mmd
- {docsDir}/flowchart.mmd

作業内容
テスト戦略とテストケースを設計してください。
1. テスト方針（ユニット/統合/E2E）の決定
2. AC-Nに対応するテストケースの定義（TC-AC1-01形式）
3. 境界値・エッジケースのテスト設計
4. テストデータの準備方針

★必須: AC→TC 追跡マトリクス (IA-4)
全てのAC-Nに対応するテストケースを以下の形式でマッピングすること:
| AC-N | テストケースID | テスト内容 |
|----|------------|---------|
| AC-1 | TC-AC1-01 | (テスト内容) |
| AC-1 | TC-AC1-02 | (テスト内容) |
命名規則: TC-{AC番号}-{連番}（例: TC-AC1-01, TC-AC2-01）
全てのACに最低1件のテストケースが必要。カバーなしのACがある場合、承認がブロックされる。

出力
{docsDir}/test-design.toon に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },

  test_selection: {
    description: 'Select relevant tests using dependency analysis',
    model: 'opus',
    bashCategories: ['readonly'],
    inputFiles: ['{docsDir}/test-design.toon', '{docsDir}/impact-analysis.toon'],
    outputFile: '{docsDir}/test-selection.toon',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 20,
    subagentTemplate: `# test_selectionフェーズ

タスク情報
- タスク名: {taskName}
- 出力先: {docsDir}/

入力
- {docsDir}/test-design.toon
- {docsDir}/impact-analysis.toon

作業内容
影響分析に基づき実行すべきテストを選択してください。
1. 変更ファイルに関連するテストの特定
2. 依存関係から間接的に影響を受けるテストの特定
3. 実行コマンドの生成

出力
{docsDir}/test-selection.toon に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },
};
