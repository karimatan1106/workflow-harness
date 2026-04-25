# workflow_nextレスポンスにphaseGuide追加 - 実装計画書

## サマリー

workflow_nextおよびworkflow_statusレスポンスにphaseGuide構造化情報を追加する実装計画を定義する。
現在のワークフロープラグインではOrchestrator向けのフェーズ制約情報が5箇所に分散しており、subagent promptの構築信頼性が低い。
MCP serverレスポンスから確定的な構造化情報を提供することで、subagentへの指示欠落を根本的に解決し、構築信頼性を95%以上に引き上げる。
実装対象はdefinitions.ts、types.ts、next.ts、status.ts、CLAUDE.mdの5ファイルで、後方互換性を保ちながら新規フィールドを追加する。
本計画には全フェーズ分のPHASE_GUIDESマスター定義、型定義の拡張、レスポンス構築ロジックの追加、CLAUDE.mdのOrchestrator手順強化が含まれる。

## 概要

本改修はMCP serverのworkflow_nextおよびworkflow_statusレスポンスにphaseGuideフィールドを新規追加する。
phaseGuideにはフェーズ固有の制約情報を構造化データとして含める。具体的には必須セクション名、出力先ファイルパス、Bash許可カテゴリ、入力ファイル一覧、編集可能ファイルタイプ、最小行数、推奨subagent設定の7項目である。
Orchestratorはworkflow_nextのレスポンスからphaseGuideを取得し、subagent promptの組み立てに使用する。
これによりCLAUDE.mdの記憶ベースの組み立てを排除し、確定的な情報伝達を実現する。
加えてCLAUDE.mdにLayer2事後検証手順とLayer3自動修正手順を追記し、subagent成果物の品質保証を多層化する。
改修後はsubagentが必須セクションを含まないファイルを作成するケースが大幅に減少する見込みである。

現在の問題としてOrchestratorがsubagentに渡すpromptに含めるべきフェーズ固有制約がdefinitions.ts、artifact-validator.ts、phase-definitions.js、bash-whitelist.js、CLAUDE.mdの5箇所に分散している。Orchestratorは記憶に基づいてpromptを組み立てており、非確定性により必須セクション漏れ、パス誤記述、Bash制限未周知などの問題が頻発している。

解決方針としてworkflow_nextおよびworkflow_statusのレスポンスにphaseGuideフィールドを追加し、フェーズ固有の制約情報を構造化データとして提供する。Orchestratorはこの情報をそのままsubagent promptに埋め込むことで、確定的な指示伝達を実現する。加えてCLAUDE.mdにLayer2とLayer3の手順を追記し、subagent成果物の品質保証を強化する。

## 実装計画

### Step 1: 型定義の拡張（types.ts）

PhaseGuideインターフェースを新規定義する。

```typescript
export interface PhaseGuide {
  phaseName: string;
  description: string;
  requiredSections?: string[];
  outputFile?: string;
  allowedBashCategories?: string[];
  inputFiles?: string[];
  editableFileTypes?: string[];
  minLines?: number;
  subagentType?: string;
  model?: string;
  subPhases?: Record<string, PhaseGuide>;
}
```

NextResultにphaseGuideフィールドを追加する。StatusResultにもphaseGuideフィールドを追加する。いずれもoptionalフィールドとして追加し後方互換性を保つ。

### Step 2: PHASE_GUIDESマスター定義（definitions.ts）

全フェーズのガイド情報をPHASE_GUIDES定数として定義する。各フェーズに以下を含める。

- phaseName: フェーズ識別名
- description: フェーズの目的（1行）
- requiredSections: 成果物の必須Markdownヘッダー配列
- outputFile: docsDirからの相対出力パス
- allowedBashCategories: 許可Bashカテゴリ名配列
- inputFiles: docsDirからの相対入力パス配列
- editableFileTypes: 編集可能ファイル拡張子/カテゴリ配列
- minLines: 成果物最小行数
- subagentType: 推奨subagent_type
- model: 推奨model
- subPhases: 並列フェーズの場合、サブフェーズごとのPhaseGuide

getPhaseGuide(phase)ヘルパー関数を追加する。docsDirのプレースホルダーは実行時にresolvePhaseGuide(phase, docsDir)で置換する。

### Step 3: レスポンス構築の変更（next.ts）

workflowNext関数のレスポンス構築部分で、遷移先フェーズのphaseGuideを取得し、docsDirでパスを解決してレスポンスに含める。

```typescript
import { resolvePhaseGuide } from '../phases/definitions.js';

const result: NextResult = {
  ...existingFields,
  phaseGuide: resolvePhaseGuide(nextPhase, taskState.docsDir),
};
```

### Step 4: レスポンス構築の変更（status.ts）

workflowStatus関数のレスポンス構築部分で、現在フェーズのphaseGuideを取得し、docsDirでパスを解決してレスポンスに含める。idle/completedの場合はphaseGuideを含めない。

### Step 5: CLAUDE.md更新

subagent起動テンプレートを更新し、phaseGuideの各フィールドをpromptに埋め込む手順を明記する。Layer2事後検証手順（ファイル存在確認、必須セクション確認、行数確認）を追記する。Layer3自動修正手順（不足セクション追加、行数不足時の拡充、再検証）を追記する。

### Step 6: テスト更新

next.test.tsにphaseGuide検証テストを追加する。status-context.test.tsにphaseGuide検証テストを追加する。definitions.test.tsにPHASE_GUIDES定義の網羅性テストを追加する。

## 変更対象ファイル

本改修で変更が必要なファイルはコアファイル5件、テストファイル3件、注記追加ファイル2件の合計10件である。
コアファイルのうちdefinitions.tsが最も変更量が大きく、全フェーズ分のPHASE_GUIDESマスター定義を追加する。
types.tsではPhaseGuide型の新規定義とNextResult型およびStatusResult型の拡張を行う。
next.tsとstatus.tsはそれぞれ数行のレスポンス構築変更のみで影響範囲は小さい。
CLAUDE.mdはsubagentテンプレートの更新とLayer2およびLayer3手順の追記で、Orchestratorの行動ルール変更を担う。
テストファイルは既存テストの更新と新規テストの追加で、definitions.test.tsにPHASE_GUIDES網羅性テストを新設する。

コアファイルの具体パスはworkflow-plugin/mcp-server/src/state/types.ts、workflow-plugin/mcp-server/src/phases/definitions.ts、workflow-plugin/mcp-server/src/tools/next.ts、workflow-plugin/mcp-server/src/tools/status.tsである。
テストファイルの具体パスはworkflow-plugin/mcp-server/src/tools/__tests__/next.test.ts、workflow-plugin/mcp-server/src/tools/__tests__/status-context.test.ts、workflow-plugin/mcp-server/src/phases/definitions.test.tsである。
注記追加ファイルの具体パスはworkflow-plugin/hooks/bash-whitelist.js、workflow-plugin/hooks/lib/phase-definitions.jsである。
CLAUDE.mdはプロジェクトルート直下のCLAUDE.mdを変更する。

## 実装状況（implementation phase）

現在implementationフェーズで、以下の4ファイルに変更を実施中です：
- types.ts: PhaseGuideインターフェース追加、NextResult/StatusResultへのphaseGuideフィールド追加
- definitions.ts: PHASE_GUIDESマスター定義追加、resolvePhaseGuide関数追加
- next.ts: レスポンス構築にphaseGuide追加
- status.ts: レスポンス構築にphaseGuide追加
