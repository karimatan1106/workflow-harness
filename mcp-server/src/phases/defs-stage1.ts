/**
 * Phase definitions: Stage 1 Discovery + Requirements
 * scope_definition, research, impact_analysis, requirements
 */

import type { PhaseDefinition } from './definitions-shared.js';
import { SCOPE_DEFINITION } from './defs-stage1a.js';

export { SCOPE_DEFINITION } from './defs-stage1a.js';

export const DEFS_STAGE1: Record<string, PhaseDefinition> = {
  scope_definition: SCOPE_DEFINITION,

  research: {
    description: 'Investigate codebase, existing patterns, dependencies',
    model: 'opus',
    bashCategories: ['readonly'],
    inputFiles: ['{docsDir}/scope-definition.md'],
    outputFile: '{docsDir}/research.md',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 50,
    subagentTemplate: `# researchフェーズ
task:{taskName} intent:{userIntent} in:{docsDir}/scope-definition.md out:{docsDir}/research.md

作業内容
1. 関連コードの読み込みと分析。リファクタ時は未使用コード・重複パターン・共通化候補も特定
2. 既存の設計パターン・技術的制約の特定
3. 暗黙の制約・Magic Number一覧（S1-16）: | 値 | 用途 | 根拠 | で記録
4. 依存バージョン固有挙動（S1-17）: node --version / tsc / npm 記録。init.sh生成（S1-10）。JSON/JSONL禁止（S1-14）

{SUMMARY_SECTION}
{TOON_SKELETON_RESEARCH}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },

  impact_analysis: {
    description: 'Analyze blast radius using dependency graphs',
    model: 'opus',
    bashCategories: ['readonly'],
    inputFiles: ['{docsDir}/scope-definition.md', '{docsDir}/research.md'],
    outputFile: '{docsDir}/impact-analysis.md',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 40,
    subagentTemplate: `# impact_analysisフェーズ
task:{taskName} intent:{userIntent} in:{docsDir}/scope-definition.md,{docsDir}/research.md out:{docsDir}/impact-analysis.md

逆依存グラフ構築: entry_pointsに対して逆依存を列挙。
\`grep -r "import.*from.*<module>" src/ | head -50\`
Serena MCP が利用可能な場合は find_referencing_symbols を使用。
収束するまで追跡（安全上限15hop）。収束=前hopと同じファイル集合。

分析項目
1. 逆依存グラフから間接的に影響を受けるモジュールを特定
2. リスク評価と軽減策の提案
3. 影響を受けるテストの特定（vitest --related 利用可能時）
4. harness_set_scope を addMode:true で追加ファイルを登録
5. DCI designDocsToReview: dci_query_docs を実行し、更新が必要な設計書を designDocsToReview フィールドに記録

{SUMMARY_SECTION}
{TOON_SKELETON_IMPACT_ANALYSIS}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },

  requirements: {
    description: 'Define functional/non-functional requirements with acceptance criteria',
    model: 'opus',
    bashCategories: ['readonly'],
    inputFiles: ['{docsDir}/research.md', '{docsDir}/impact-analysis.md'],
    outputFile: '{docsDir}/requirements.md',
    requiredSections: ['decisions', 'acceptanceCriteria', 'notInScope', 'openQuestions'],
    minLines: 50,
    subagentTemplate: `# requirementsフェーズ

タスク情報
- タスク名: {taskName}
- ユーザー意図: {userIntent}
- 出力先: {docsDir}/

入力
- {docsDir}/research.md
- {docsDir}/impact-analysis.md

作業内容
機能要件・非機能要件を定義し、受入基準（AC-N）を設定してください。
1. ユーザー意図から機能要件を導出
2. パフォーマンス・セキュリティ等の非機能要件を定義
3. 受入基準をAC-1, AC-2...の形式で最低3件定義
4. スコープ外の項目を明示（NOT_IN_SCOPE）
5. 未解決の質問を列挙（OPEN_QUESTIONS）

★必須: 受入基準（AC-N）の形式 (IA-2)
- \`## 受入基準\` セクションに最低3件の受入基準を記載すること
- 形式: \`AC-1: <具体的な受入条件の説明>\` （正規表現: /^AC-\\d+:/m）
- 各ACは検証可能・測定可能な条件であること（「改善する」ではなく「レスポンスタイムが200ms以下になる」等）
- harness_add_ac を呼び出して各ACをタスク状態に登録すること
- harness_add_rtm を呼び出して各機能要件（F-NNN）をRTMに登録すること

★必須: スコープ外（NOT_IN_SCOPE）(IA-2)
- \`## NOT_IN_SCOPE\` または \`## スコープ外\` セクションを必ず含めること
- 明示的に「今回は対応しない」項目を列挙し、スコープの肥大化を防止

★必須: 未解決の質問（OPEN_QUESTIONS）(IA-1)
- \`## OPEN_QUESTIONS\` セクションを必ず含めること
- ユーザーに確認が必要な不明点を列挙（空の場合は「なし」と記載）
- Orchestratorは空でないOPEN_QUESTIONSをユーザーに確認してから承認に進む

出力
{docsDir}/requirements.md に保存してください。

{SUMMARY_SECTION}
{TOON_SKELETON_REQUIREMENTS}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },
};
