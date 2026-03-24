/**
 * Phase definition: scope_definition (Stage 1)
 * Extracted from defs-stage1.ts for 200-line compliance.
 */

import type { PhaseDefinition } from './definitions-shared.js';

export const SCOPE_DEFINITION: PhaseDefinition = {
  description: 'Define affected files/directories and set risk score',
  model: 'opus',
  bashCategories: ['readonly'],
  inputFiles: [],
  outputFile: '{docsDir}/scope-definition.md',
  requiredSections: ['decisions', 'artifacts', 'next'],
  minLines: 30,
  subagentTemplate: `# scope_definitionフェーズ

タスク情報
- タスク名: {taskName}
- ユーザー意図: {userIntent}
- 出力先: {docsDir}/

作業内容
対象プロジェクトを調査し、変更の影響範囲を特定してください。

Step 1: エントリポイント検索（LLM推測禁止）
ユーザー意図のキーワードでGrep/Globを使い候補を絞り込む:
\`\`\`bash
grep -r "キーワード" src/ | head -50
\`\`\`
Serena MCP が利用可能な場合は search_for_pattern / find_symbol を使用。

Step 2: 依存追跡
Step 1で確定したエントリポイントから参照元を辿る:
\`\`\`bash
grep -r "import.*<module>" src/ | head -50
\`\`\`
Serena MCP が利用可能な場合は find_referencing_symbols を使用。
depth: 収束するまで追跡（安全上限10hop）。
収束チェック: 前hopと同じファイル集合なら打ち切り（新規ファイルなし=影響範囲確定）。

Step 3.5: プロジェクト性質判定
package.json/tsconfig/ディレクトリ構造からプロジェクト性質を判定し、harness_set_scopeのprojectTraitsに設定:
- hasUI: React/Vue/Angular/Svelte等のUI FW存在
- hasAPI: Express/Fastify/REST/GraphQL等のAPI層存在
- hasDB: Prisma/TypeORM/Sequelize/SQL等のDB層存在
- hasEvents: EventEmitter/MQ/WebSocket等のイベント機構存在
- hasI18n: i18next/react-intl/vue-i18n等の国際化FW存在
- hasDesignSystem: Storybook/designTokens/theme等のデザインシステム存在

Step 3.6: DCI 関連設計書クエリ
dci_build_index でインデックスを構築し、各scope fileに対して dci_query_docs を実行。
結果の relatedDesignDocs をscope-definition.mdに記録:
\`\`\`
relatedDesignDocs: ["docs/spec/features/xxx.md", ...]
\`\`\`
DCI未構築・@specなしの場合はスキップ可。

Step 3.7: 既存ドキュメント探索
プロジェクト内の既存ドキュメントファイルを探索し、harness_set_scopeのdocPathsに設定:
\`\`\`bash
find . -maxdepth 4 -type f \\( -name "*.md" -o -name "*.rst" -o -name "*.adoc" \\) \\
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" \\
  -not -path "*/docs/workflows/*" | head -50
\`\`\`
対象: README, CHANGELOG, docs/, wiki/, specifications/ 等
除外: node_modules, .git, dist, docs/workflows(一時ワークフロー)

Step 3: スコープ設定
1. 列挙したファイルで harness_set_scope を呼び出す（max 100ファイル、projectTraits + docPaths含む）
2. リスクスコアの算出根拠を記録。リファクタ時は呼び出し元なしの未使用ファイルも記録（削除候補）
3. スコープ外の項目を明示

出力
{docsDir}/scope-definition.md に保存してください。
{SUMMARY_SECTION}
{TOON_SKELETON_SCOPE_DEFINITION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{PROCEDURE_ORDER}
{EXIT_CODE_RULE}`,
};
