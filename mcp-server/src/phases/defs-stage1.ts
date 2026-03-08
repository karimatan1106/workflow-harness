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
    outputFile: '{docsDir}/scope-definition.toon',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 30,
    subagentTemplate: `# scope_definitionフェーズ

## タスク情報
- タスク名: {taskName}
- ユーザー意図: {userIntent}
- 出力先: {docsDir}/

## 作業内容
対象プロジェクトを調査し、変更の影響範囲を特定してください。

### Step 0: Serena利用可否チェック
\`\`\`bash
indexer/.venv/Scripts/python.exe -c "from serena.agent import SerenaAgent" 2>/dev/null && echo "SERENA_OK" || echo "SERENA_UNAVAILABLE"
\`\`\`
SERENA_UNAVAILABLEの場合はStep 1b/2bのフォールバックを使用する。

### Step 1: LSP-firstエントリポイント検索（LLM推測禁止）
ユーザー意図のキーワードでLSP検索し、候補を絞り込む:
\`\`\`bash
# 1a. キーワードで全出現箇所を検索（--limit 100で制御）
indexer/.venv/Scripts/python.exe indexer/serena-query.py --limit 100 search_for_pattern --substring_pattern "<意図のキーワード>" --restrict_search_to_code_files true
# 1b. モジュール構造から候補ディレクトリを確認
indexer/.venv/Scripts/python.exe indexer/serena-query.py get_symbols_overview --relative_path <候補dir>
# 1c. 候補シンボルの定義位置を確定
indexer/.venv/Scripts/python.exe indexer/serena-query.py --limit 50 find_symbol --name_path_pattern "<候補名>"
\`\`\`
結果が多すぎる場合（_pagination.has_more: true）→ パターンを絞り込んで再検索。
**フォールバック(1b)**: Grep/Globで \`grep -r "キーワード" src/ | head -50\` を使用。

### Step 2: 依存追跡（分岐係数制御）
Step 1で確定したエントリポイントから参照元を辿る:
\`\`\`bash
# 2a. 直接参照元を取得（--limit 100で各hop最大100件）
indexer/.venv/Scripts/python.exe indexer/serena-query.py --limit 100 find_referencing_symbols --name_path <確定したname_path> --relative_path <file>
\`\`\`
**分岐係数ルール**: 各hopで最大100件。has_more: true時はパターン絞り込みで再検索。
**depth**: 収束するまで追跡（安全上限10hop）。各hop最大100件。
**収束チェック**: 前hopと同じファイル集合なら打ち切り（新規ファイルなし=影響範囲確定）。
**フォールバック(2b)**: Grep/Globで \`grep -r "import.*<module>" src/\` を使用。

### Step 3: スコープ設定
1. 列挙したファイルで harness_set_scope を呼び出す（max 100ファイル）
2. リスクスコアの算出根拠を記録
3. スコープ外の項目を明示

## 出力
{docsDir}/scope-definition.toon に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },

  research: {
    description: 'Investigate codebase, existing patterns, dependencies',
    model: 'sonnet',
    bashCategories: ['readonly'],
    inputFiles: ['{docsDir}/scope-definition.toon'],
    outputFile: '{docsDir}/research.toon',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 50,
    subagentTemplate: `# researchフェーズ
task:{taskName} intent:{userIntent} in:{docsDir}/scope-definition.toon out:{docsDir}/research.toon

## 作業内容
1. 関連コードの読み込みと分析
2. 既存の設計パターン・技術的制約の特定
3. 暗黙の制約・Magic Number一覧（S1-16）: | 値 | 用途 | 根拠 | 形式で記録
4. 依存バージョン固有挙動（S1-17）: node --version / tsc --version / npm --version を記録
5. {docsDir}/init.sh 生成（S1-10）: ビルド・テスト・セットアップコマンド
6. raw JSON/JSONL 直接出力禁止（S1-14）: 構造化サマリーにまとめること

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },

  impact_analysis: {
    description: 'Analyze blast radius using dependency graphs',
    model: 'sonnet',
    bashCategories: ['readonly'],
    inputFiles: ['{docsDir}/scope-definition.toon', '{docsDir}/research.toon'],
    outputFile: '{docsDir}/impact-analysis.toon',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 40,
    subagentTemplate: `# impact_analysisフェーズ

## タスク情報
- タスク名: {taskName}
- ユーザー意図: {userIntent}
- 出力先: {docsDir}/

## 入力
- {docsDir}/scope-definition.toon
- {docsDir}/research.toon

## 作業内容
変更の影響範囲（ブラストレディウス）を分析してください。

### 逆依存グラフ構築（Serena利用可能時）
scope-definition.toonのentry_pointsに対してSerenaで逆依存を列挙:
\`\`\`bash
# 各エントリポイントのシンボルに対して（--limit 100で分岐制御）:
indexer/.venv/Scripts/python.exe indexer/serena-query.py --limit 100 find_referencing_symbols --name_path <name-path> --relative_path <file>
\`\`\`
**分岐係数ルール**: 各hopで最大100件。has_more: trueの場合はディレクトリで絞り込み再検索。
結果から依存グラフを構築。各hop最大100件、収束するまで追跡（安全上限15hop）。
**収束チェック**: 前hopと同じファイル集合なら打ち切り（新規ファイルなし=影響範囲確定）。
**フォールバック**: Grep/Globで \`grep -r "import.*from.*<module>" src/\` を使用。

### 分析項目
1. 逆依存グラフから間接的に影響を受けるモジュールを特定
2. リスク評価と軽減策の提案
3. 影響を受けるテストの特定（vitest --related 利用可能時）
4. harness_set_scope を addMode:true で追加ファイルを登録

## 出力
{docsDir}/impact-analysis.toon に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },

  requirements: {
    description: 'Define functional/non-functional requirements with acceptance criteria',
    model: 'sonnet',
    bashCategories: ['readonly'],
    inputFiles: ['{docsDir}/research.toon', '{docsDir}/impact-analysis.toon'],
    outputFile: '{docsDir}/requirements.toon',
    requiredSections: ['decisions', 'acceptanceCriteria', 'notInScope', 'openQuestions'],
    minLines: 50,
    subagentTemplate: `# requirementsフェーズ

## タスク情報
- タスク名: {taskName}
- ユーザー意図: {userIntent}
- 出力先: {docsDir}/

## 入力
- {docsDir}/research.toon
- {docsDir}/impact-analysis.toon

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
{docsDir}/requirements.toon に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },
};
