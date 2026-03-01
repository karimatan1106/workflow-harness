/**
 * Phase definitions: Stage 2 Analysis + Design
 * threat_modeling, planning, state_machine, flowchart, ui_design
 */
export const DEFS_STAGE2 = {
    threat_modeling: {
        description: 'STRIDE analysis and risk assessment',
        model: 'sonnet',
        bashCategories: ['readonly'],
        inputFiles: ['{docsDir}/requirements.toon'],
        outputFile: '{docsDir}/threat-model.toon',
        requiredSections: ['decisions', 'artifacts', 'next'],
        minLines: 40,
        subagentTemplate: `# threat_modelingフェーズ

## タスク情報
- タスク名: {taskName}
- 出力先: {docsDir}/

## 入力
- {docsDir}/requirements.toon

## 作業内容
STRIDE分析に基づく脅威モデリングを実施してください。
1. 各脅威カテゴリ（S/T/R/I/D/E）の分析
2. リスクレベルの評価
3. セキュリティ要件の導出
4. 対策の優先順位付け

## 出力
{docsDir}/threat-model.toon に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
    },
    planning: {
        description: 'Technical specification and implementation plan',
        model: 'sonnet',
        bashCategories: ['readonly'],
        inputFiles: ['{docsDir}/requirements.toon', '{docsDir}/threat-model.toon'],
        outputFile: '{docsDir}/spec.toon',
        requiredSections: ['decisions', 'artifacts', 'next'],
        minLines: 50,
        subagentTemplate: `# planningフェーズ

## タスク情報
- タスク名: {taskName}
- 出力先: {docsDir}/

## 入力
- {docsDir}/requirements.toon
- {docsDir}/threat-model.toon

## 作業内容
技術仕様書と実装計画を作成してください。
1. アーキテクチャ設計の決定
2. RTMエントリ（F-NNN形式）の定義
3. 実装の順序と依存関係の整理
4. 変更対象ファイルの一覧

## 出力
{docsDir}/spec.toon に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
    },
    state_machine: {
        description: 'State diagrams in Mermaid stateDiagram-v2',
        model: 'haiku',
        bashCategories: ['readonly'],
        inputFiles: ['{docsDir}/spec.toon'],
        outputFile: '{docsDir}/state-machine.mmd',
        requiredSections: ['decisions'],
        minLines: 15,
        subagentTemplate: `# state_machineフェーズ

## タスク情報
- タスク名: {taskName}
- 出力先: {docsDir}/

## 入力
- {docsDir}/spec.toon

## 作業内容
Mermaid stateDiagram-v2形式でステートマシン図を作成してください。
- 名前付き状態を使用（[*]の代わりにStart, Endを使用）
- 全ての状態遷移を網羅
- エッジケースの遷移も含める

## 出力
{docsDir}/state-machine.mmd に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
    },
    flowchart: {
        description: 'Process flow diagrams in Mermaid flowchart',
        model: 'haiku',
        bashCategories: ['readonly'],
        inputFiles: ['{docsDir}/spec.toon'],
        outputFile: '{docsDir}/flowchart.mmd',
        requiredSections: ['decisions'],
        minLines: 15,
        subagentTemplate: `# flowchartフェーズ

## タスク情報
- タスク名: {taskName}
- 出力先: {docsDir}/

## 入力
- {docsDir}/spec.toon

## 作業内容
Mermaid flowchart形式で処理フローチャートを作成してください。
- 主要な処理フローを図示
- 分岐条件を明示
- エラーハンドリングフローを含める

## 出力
{docsDir}/flowchart.mmd に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
    },
    ui_design: {
        description: 'Interface design and component specifications',
        model: 'sonnet',
        bashCategories: ['readonly'],
        inputFiles: ['{docsDir}/spec.toon'],
        outputFile: '{docsDir}/ui-design.toon',
        requiredSections: ['decisions', 'artifacts', 'next'],
        minLines: 50,
        subagentTemplate: `# ui_designフェーズ

## タスク情報
- タスク名: {taskName}
- 出力先: {docsDir}/

## 入力
- {docsDir}/spec.toon

## 作業内容
UI設計とコンポーネント仕様を作成してください。
1. コンポーネント構成と責務の定義
2. 画面レイアウトの設計
3. インタラクション・状態管理の設計
4. レスポンシブ対応の方針

## 出力
{docsDir}/ui-design.toon に保存してください。

{SUMMARY_SECTION}
{BASH_CATEGORIES}
{ARTIFACT_QUALITY}
{EXIT_CODE_RULE}`,
    },
};
//# sourceMappingURL=defs-stage2.js.map