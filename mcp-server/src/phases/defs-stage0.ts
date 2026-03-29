import type { PhaseDefinition } from './definitions-shared.js';

export const DEFS_STAGE0: Record<string, PhaseDefinition> = {
  hearing: {
    description: 'User intent hearing and plan proposal',
    model: 'opus',
    bashCategories: ['readonly'],
    inputFiles: [],
    outputFile: '{docsDir}/hearing.md',
    requiredSections: ['decisions', 'artifacts', 'next'],
    minLines: 20,
    subagentTemplate: `hearingフェーズ（Worker planモード）

タスク情報
- タスク名: {taskName}
- 出力先: {docsDir}/
- ユーザー意図: {userIntent}

実行手順

1. ユーザー意図を分析し、不明確な点を特定する

2. AskUserQuestion で確認事項をヒアリング（1回のAskで最大4問）
   - AskUserQuestion呼び出しは必須。選択肢は2個以上、各選択肢にメリット・デメリットを明記すること。
   - 確認だけの質問（はい/いいえ）は禁止。必ず異なるアプローチを提示する。
   - 悪い例: 「テストを追加しますか？ [はい / いいえ]」
   - 良い例: 「テスト戦略: A) ユニットテスト中心（速い・カバレッジ浅い） B) 統合テスト中心（遅い・信頼性高い）」
   - 各質問に2-4個の選択肢を用意
   - 技術的判断が必要な場合は推奨を(Recommended)で明示
   - 不明確な点が多い場合は複数回に分けて質問

3. コードベース事前調査（readonly）
   - 変更対象の特定
   - 影響範囲の概算
   - 既存パターンの確認

4. 回答と調査結果を元にhearing.mdを作成
   - intent-analysis: surfaceRequest, deepNeed, unclearPoints, assumptions
   - implementation-plan: approach, estimatedScope, risks
   - decisions: 確認で決まった事項

{TOON_SKELETON_HEARING}
{SUMMARY_SECTION}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
  },
};
