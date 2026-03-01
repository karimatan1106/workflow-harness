/**
 * Phase definitions: Stage 4 TDD + Quality
 * test_impl, implementation, refactoring, build_check, code_review
 */

import type { PhaseDefinition } from './definitions-shared.js';

export const DEFS_STAGE4: Record<string, PhaseDefinition> = {
  test_impl: {
    description: 'Write failing tests (TDD Red phase)',
    model: 'sonnet',
    bashCategories: ['readonly', 'testing'],
    inputFiles: ['{docsDir}/test-design.md', '{docsDir}/test-selection.md'],
    outputFile: null,
    requiredSections: [],
    minLines: 0,
    subagentTemplate: `# test_implフェーズ（TDD Red）

## タスク情報
- タスク名: {taskName}

## 入力
- {docsDir}/test-design.md
- {docsDir}/test-selection.md

## 作業内容
テスト設計に基づきテストコードを作成してください（TDD Redフェーズ）。
1. test-design.mdのテストケースを実装
2. テストは失敗する状態で作成（実装コードがまだないため）
3. テストファイルのパスを記録

テストが失敗することを確認してください。

{BASH_CATEGORIES}
{EXIT_CODE_RULE}`,
  },

  implementation: {
    description: 'Write code to pass tests (TDD Green phase)',
    model: 'sonnet',
    bashCategories: ['readonly', 'testing', 'implementation'],
    inputFiles: ['{docsDir}/spec.md', '{docsDir}/test-design.md'],
    outputFile: null,
    requiredSections: [],
    minLines: 0,
    subagentTemplate: `# implementationフェーズ（TDD Green）

## タスク情報
- タスク名: {taskName}

## 入力
以下の設計成果物を全て読み込んでから実装してください:
- {docsDir}/spec.md
- {docsDir}/state-machine.mmd
- {docsDir}/flowchart.mmd
- {docsDir}/ui-design.md
- {docsDir}/test-design.md

## 設計チェックリスト（実装開始前に必須確認）
- spec.mdに記載された全機能を実装したか
- state-machine.mmdの全状態遷移を実装したか
- flowchart.mmdの全処理フローを実装したか
- test-design.mdの全テストケースに対応するコードがあるか

## 作業内容
テストが通るように実装コードを作成してください。
全てのテストが成功する（Green）状態にしてください。

{BASH_CATEGORIES}
{EXIT_CODE_RULE}`,
  },

  refactoring: {
    description: 'Improve code quality while maintaining green tests',
    model: 'haiku',
    bashCategories: ['readonly', 'testing', 'implementation'],
    inputFiles: [],
    outputFile: null,
    requiredSections: [],
    minLines: 0,
    subagentTemplate: `# refactoringフェーズ

## タスク情報
- タスク名: {taskName}

## 作業内容
テストを維持しながらコード品質を改善してください（/simplify 手順 S1-6）。

以下の3観点でコードを評価・改善すること:
1. **code quality**: コードの重複排除・命名改善・関数責務分離
2. **code efficiency**: パフォーマンス改善・不要な処理の削除
3. **CLAUDE.md compliance**: 200行ファイル制限・禁止パターン・フォーマット準拠

テストが引き続き全てパスすることを確認してください。
ツール呼び出し結果をraw JSON/JONSLで出力しないこと（S1-14）。

{BASH_CATEGORIES}
{EXIT_CODE_RULE}`,
  },

  build_check: {
    description: 'Verify builds succeed',
    model: 'haiku',
    bashCategories: ['readonly', 'testing', 'implementation'],
    inputFiles: [],
    outputFile: null,
    requiredSections: [],
    minLines: 0,
    subagentTemplate: `# build_checkフェーズ

## タスク情報
- タスク名: {taskName}

## 作業内容
ビルドが成功することを確認してください。
1. TypeScriptコンパイル（tsc --noEmit）
2. ビルドコマンド（npm run build）
3. エラーがあれば修正

{BASH_CATEGORIES}
{EXIT_CODE_RULE}`,
  },

  code_review: {
    description: 'Review implementation against design',
    model: 'sonnet',
    bashCategories: ['readonly'],
    inputFiles: [],
    outputFile: '{docsDir}/code-review.md',
    requiredSections: ['## サマリー', '## 設計-実装整合性', '## ユーザー意図との整合性'],
    minLines: 30,
    subagentTemplate: `# code_reviewフェーズ

## タスク情報
- タスク名: {taskName}
- ユーザー意図: {userIntent}
- 出力先: {docsDir}/

## 入力
以下の設計成果物と実装コードを比較してください:
- {docsDir}/spec.md
- {docsDir}/requirements.md
- {docsDir}/threat-model.md

## レビュー姿勢（SRB-1）
**外部レビュアーの視点**でレビューすること。実装者と同一セッションの知識を前提にしないこと。
コードだけを見て「設計通りか」「ユーザー意図を満たすか」を判断する。

## 作業内容
設計と実装の整合性を検証してください。
1. spec.mdの全機能が実装されているか
2. 設計書にない追加機能（勝手な追加）がないか
3. ユーザー意図が正しく反映されているか
4. セキュリティ要件の対策実装確認
5. 未実装項目がある場合はimplementationフェーズに差し戻し

## ★必須: AC達成状況テーブル (IA-5)
全てのAC-Nの達成状況を以下の形式で報告すること:
| AC-N | ステータス | 実装証拠（ファイル:行番号） |
|----|---------|-------------------|
| AC-1 | 合格/不合格 | src/xxx.ts:42 |
不合格のACが1件でもある場合、承認がブロックされる。

## 出力
{docsDir}/code-review.md に保存してください。

承認ゲートです。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },
};
