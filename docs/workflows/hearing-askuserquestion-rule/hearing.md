# Hearing: hearing-askuserquestion-rule

userResponse: "hearingフェーズではhearing-workerエージェントタイプを使用し、AskUserQuestionツールで構造化された選択肢をユーザーに提示するルールを明記する"

## overview

hearingフェーズにおけるエージェント型(hearing-worker)とツール(AskUserQuestion)の使用を明確にルール化する。workflow-phases.mdにhearingフェーズセクションを追加し、他フェーズとの一貫性を確保する。

## intent-analysis

- surfaceRequest: hearingフェーズでhearing-workerエージェントとAskUserQuestionツールの使用を強制するルールを文書化する
- deepNeed: hearingフェーズの実行手順が他フェーズと異なりworkflow-phases.mdに記載がないため、フェーズ定義の一貫性が欠けている。hearing固有のエージェント型とツール制約を明示することで、実行の再現性を保証する

## unclearPoints

- workflow-delegation.mdの既存Phase Parameter Tableにhearing-workerマッピングが存在するか確認が必要

## assumptions

- workflow-delegation.mdの既存マッピングでエージェント型の指定は十分であり、新規ルールの追加は不要
- 質問テンプレートの標準化はスコープ外(ツールとエージェント型の強制のみ)
- workflow-phases.mdへのhearingセクション追加が主たる成果物

## questions-and-answers

### Q1: Where should this rule be documented?

choices:
- A: workflow-phases.md + workflow-delegation.md の両方
- B: workflow-phases.md のみ（Phase Descriptionsに追加）
- C: workflow-delegation.md のみ（既存Phase Parameter Tableで十分、追加不要）

selected: C
rationale: workflow-delegation.mdの既存マッピングでエージェント型の指定は十分。ただし別途Q3でworkflow-phases.mdへのセクション追加を決定。

### Q2: Should the rule also cover the question structure?

choices:
- A: ツール(AskUserQuestion)とエージェント型(hearing-worker)の強制のみ
- B: 質問の構造(選択肢形式、自由記述形式)も標準化する

selected: A
rationale: 質問構造の標準化は過度な制約となる。ツールとエージェント型の強制で十分。

### Q3: Should workflow-phases.md get a hearing phase section?

choices:
- A: workflow-phases.md に hearing セクション追加する（他フェーズと一貫性）
- B: 追加しない（hearingは特殊フェーズのため分離管理）

selected: A
rationale: 他フェーズと同じ形式でworkflow-phases.mdに記載することで、フェーズ定義の一貫性を確保する。

## decisions

- D-HR-1: workflow-delegation.mdの既存マッピングで十分。新規ルール追加不要
- D-HR-2: workflow-phases.mdにhearingフェーズセクションを追加(AskUserQuestion使用を明記)
- D-HR-3: 質問テンプレートの標準化はしない(ツールとエージェント型の強制のみ)
- D-HR-4: hearing-worker.mdのAskUserQuestionガイドラインは現状維持する (既存定義で十分なため)
- D-HR-5: hookによる強制は本タスクのスコープ外とする (ルール明記のみで運用カバー可能なため)

## implementation-plan

1段階で実施:
- (P1) workflow-phases.mdにStage 0セクションとしてhearingフェーズの記述を追加。AskUserQuestionツール使用とhearing-workerエージェント型の制約を明記する。

estimatedScope: small。変更ファイル1件(workflow-phases.md)。数行の追加のみ。

## risks

- workflow-phases.mdの既存構造と整合しない記述をすると、DoDゲートチェックに影響する可能性がある。既存フェーズの記述形式に合わせることで回避する

## artifacts

- docs/workflows/hearing-askuserquestion-rule/hearing.md: 本ヒアリング結果

## next

readFiles: ".claude/skills/workflow-harness/workflow-phases.md, .claude/skills/workflow-harness/workflow-delegation.md"
warnings: "workflow-phases.mdの既存Stage 0セクション(scope_definition)の前にhearingを配置すること"
