import type { PhaseDefinition } from './definitions-shared.js';

export const DEFS_STAGE0: Record<string, PhaseDefinition> = {
  hearing: {
    description: 'User intent hearing and plan proposal',
    model: 'opus',
    bashCategories: ['readonly'],
    inputFiles: [],
    outputFile: '{docsDir}/hearing.toon',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 20,
    subagentTemplate: `hearingフェーズ

タスク情報
- タスク名: {taskName}
- 出力先: {docsDir}/
- ユーザー意図: {userIntent}

作業内容
ユーザーの意図を分析し、実装計画を策定してください。

1. 意図分析
   - surfaceRequest: ユーザーが明示的に言ったこと
   - deepNeed: 背後にある本質的なニーズ
   - unclearPoints: 不明確な点（仮定を置く場合は明記）
   - assumptions: 前提として置いた仮定

2. コードベース事前調査（readonly）
   - 変更対象の特定
   - 影響範囲の概算
   - 既存パターンの確認

3. 実装プラン策定
   - approach: 採用するアプローチ
   - estimatedScope: 変更ファイル数・規模
   - risks: リスク・懸念事項
   - questions: ユーザーへの確認事項（あれば）

出力
{docsDir}/hearing.toon に保存してください。

{SUMMARY_SECTION}
{TOON_SKELETON_HEARING}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },
};
