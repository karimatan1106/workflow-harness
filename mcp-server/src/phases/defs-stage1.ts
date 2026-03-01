/**
 * Phase definitions: Stage 1 Discovery + Requirements
 * scope_definition, research, impact_analysis, requirements
 */

import type { PhaseDefinition } from './definitions-shared.js';

export const DEFS_STAGE1: Record<string, PhaseDefinition> = {
  scope_definition: {
    description: 'Define affected files/directories and set risk score',
    model: 'sonnet',
    bashCategories: ['readonly'],
    inputFiles: [],
    outputFile: '{docsDir}/scope-definition.md',
    requiredSections: ['## サマリー', '## スコープ定義', '## 影響範囲', '## スコープ外'],
    minLines: 30,
    subagentTemplate: `# scope_definitionフェーズ

## タスク情報
- タスク名: {taskName}
- ユーザー意図: {userIntent}
- 出力先: {docsDir}/

## 作業内容
対象プロジェクトを調査し、変更の影響範囲を特定してください。
1. 変更対象のファイル・ディレクトリを列挙
2. 依存関係の初期分析
3. リスクスコアの算出根拠を記録
4. スコープ外の項目を明示

## 大規模スコープ対応（BCH-1）
影響ファイル数が100を超える場合は '/batch' の使用を検討してください。
/batch は複数ファイルをまとめて処理し、コンテキスト過負荷を防ぎます。

## 出力
{docsDir}/scope-definition.md に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },

  research: {
    description: 'Investigate codebase, existing patterns, dependencies',
    model: 'sonnet',
    bashCategories: ['readonly'],
    inputFiles: ['{docsDir}/scope-definition.md'],
    outputFile: '{docsDir}/research.md',
    requiredSections: ['## サマリー', '## 調査結果', '## 既存実装の分析'],
    minLines: 50,
    subagentTemplate: `# researchフェーズ

## タスク情報
- タスク名: {taskName}
- ユーザー意図: {userIntent}
- 出力先: {docsDir}/

## 入力
以下のファイルを読み込んでください:
- {docsDir}/scope-definition.md

## 作業内容
コードベースを調査し、既存のパターン・依存関係・制約を分析してください。
1. 関連コードの読み込みと分析
2. 既存の設計パターンの把握
3. 技術的制約の特定
4. 実装に必要な前提知識の整理

## 必須記載セクション（research.mdに含めること）

### ## 暗黙の制約・Magic Number 一覧（S1-16）
コードベースで発見した暗黙的な制約・数値・仮定を以下の表形式で記録する:
| 値 | 用途 | 根拠・出典 |
|---|-----|---------|
| [数値/文字列] | [何に使うか] | [なぜこの値か・どのファイルで定義] |

### ## 依存バージョン固有挙動（S1-17）
node --version / tsc --version / npm --version の出力を記録し、バージョン固有の挙動を記述する:
| ライブラリ/RT | バージョン | 固有の挙動・回避策 |
|-------------|---------|---------------|
| Node.js | vX.X.X | [固有挙動] |

## init.sh 生成（S1-10）
{docsDir}/init.sh を作成し、以下を記述すること:
- ビルドコマンド (npm run build等)
- 基本テスト確認コマンド (npm test等)
- 環境セットアップコマンド

## 出力注意（S1-14）
- raw JSON/JSONL を直接出力しないこと
- ツール呼び出し結果は構造化サマリーとして人間可読な形式にまとめること

## 出力
{docsDir}/research.md に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },

  impact_analysis: {
    description: 'Analyze blast radius using dependency graphs',
    model: 'sonnet',
    bashCategories: ['readonly'],
    inputFiles: ['{docsDir}/scope-definition.md', '{docsDir}/research.md'],
    outputFile: '{docsDir}/impact-analysis.md',
    requiredSections: ['## サマリー', '## 影響ファイル一覧', '## 依存関係分析', '## リスク評価'],
    minLines: 40,
    subagentTemplate: `# impact_analysisフェーズ

## タスク情報
- タスク名: {taskName}
- ユーザー意図: {userIntent}
- 出力先: {docsDir}/

## 入力
- {docsDir}/scope-definition.md
- {docsDir}/research.md

## 作業内容
変更の影響範囲（ブラストレディウス）を分析してください。
1. 変更対象ファイルの依存関係グラフを作成
2. 間接的に影響を受けるモジュールの特定
3. リスク評価と軽減策の提案
4. 影響を受けるテストの特定

## 出力
{docsDir}/impact-analysis.md に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },

  requirements: {
    description: 'Define functional/non-functional requirements with acceptance criteria',
    model: 'sonnet',
    bashCategories: ['readonly'],
    inputFiles: ['{docsDir}/research.md', '{docsDir}/impact-analysis.md'],
    outputFile: '{docsDir}/requirements.md',
    requiredSections: ['## サマリー', '## 機能要件', '## 非機能要件', '## 受入基準'],
    minLines: 50,
    subagentTemplate: `# requirementsフェーズ

## タスク情報
- タスク名: {taskName}
- ユーザー意図: {userIntent}
- 出力先: {docsDir}/

## 入力
- {docsDir}/research.md
- {docsDir}/impact-analysis.md

## 作業内容
機能要件・非機能要件を定義し、受入基準（AC-N）を設定してください。
1. ユーザー意図から機能要件を導出
2. パフォーマンス・セキュリティ等の非機能要件を定義
3. 受入基準をAC-1, AC-2...の形式で最低3件定義
4. スコープ外の項目を明示（NOT_IN_SCOPE）
5. 未解決の質問を列挙（OPEN_QUESTIONS）

## ★必須: 受入基準（AC-N）の形式 (IA-2)
- \`## 受入基準\` セクションに最低3件の受入基準を記載すること
- 形式: \`AC-1: <具体的な受入条件の説明>\` （正規表現: /^AC-\\d+:/m）
- 各ACは検証可能・測定可能な条件であること（「改善する」ではなく「レスポンスタイムが200ms以下になる」等）
- harness_add_ac を呼び出して各ACをタスク状態に登録すること

## ★必須: スコープ外（NOT_IN_SCOPE）(IA-2)
- \`## NOT_IN_SCOPE\` または \`## スコープ外\` セクションを必ず含めること
- 明示的に「今回は対応しない」項目を列挙し、スコープの肥大化を防止

## ★必須: 未解決の質問（OPEN_QUESTIONS）(IA-1)
- \`## OPEN_QUESTIONS\` セクションを必ず含めること
- ユーザーに確認が必要な不明点を列挙（空の場合は「なし」と記載）
- Orchestratorは空でないOPEN_QUESTIONSをユーザーに確認してから承認に進む

## 出力
{docsDir}/requirements.md に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },
};
