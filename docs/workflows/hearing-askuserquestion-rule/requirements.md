# Requirements: hearing-askuserquestion-rule

taskId: d113c137-c400-401c-9e3e-bb968f5e84e9

## summary

workflow-phases.md に hearing フェーズセクションを追加するための要件定義。hearing-worker エージェント型の指定と AskUserQuestion ツール使用ルールを既存フェーズ記述形式に合わせて明記する。

## userIntent

keywords: hearing, hearing-worker, AskUserQuestion, workflow-phases.md, 構造化された選択肢, スキルファイル
surfaceRequest: hearingフェーズの記述をworkflow-phases.mdに追加する
fullIntent: 本タスクはhearingフェーズでhearing-workerエージェントタイプを使用しAskUserQuestionツールで構造化された選択肢をユーザーに提示するルールをスキルファイルに明記する
deepNeed: フェーズ定義の一貫性確保。hearingのみ未記載でLLMが作業内容を参照できない状態を解消する

## decisions

- D-001: hearingセクションはStage 0: scope_definitionの直前(L11付近)に挿入する。hearingはscope_definitionより先に実行されるフェーズであり、実行順序と記載順序を一致させるため。
- D-002: Stage番号はStage 0とする。scope_definitionと同じ初期ステージに属し、既存の番号体系を維持するため。
- D-003: 記述形式は既存フェーズと同一パターン(見出し + 作業概要 + Output + DoD)に従う。フェーズ定義の一貫性がタスクの目的であるため。
- D-004: AskUserQuestionツール使用を明記し、hearing-workerエージェント型への参照を含める。workflow-delegation.mdのPhase Parameter Tableとの整合を取るため。
- D-005: DoD条件はL1 exists, L4 userResponse + decisionsとする。workflow-delegation.mdのRequired Sectionsから導出した条件であるため。
- D-006: workflow-phases.mdのみ変更する。workflow-delegation.mdとhearing-worker.mdは変更対象外(hearing.md D-HR-1, D-HR-4の決定に従う)。
- D-007: 追加行数は3行程度とする。現行78行に対し上限200行以内を維持するため。

## acceptanceCriteria

### AC-1: workflow-phases.md に hearing フェーズセクションが存在すること

検証レベル: L1
検証方法: workflow-phases.md 内に `### Stage 0: hearing` 見出しが存在することを確認する
根拠: hearingフェーズが他フェーズと同様にPhase Work Descriptionsに記載されている必要がある

### AC-2: hearing セクションに hearing-worker エージェント指定が明記されていること

検証レベル: L4 (hearing-worker文字列の存在確認)
検証方法: hearingセクション内に hearing-worker エージェント型への言及が含まれることを文字列検索で確認する
根拠: workflow-delegation.mdのPhase Parameter Table(hearing行: Template=hearing-worker)と整合する記述が必要

### AC-3: hearing セクションに AskUserQuestion ツール使用ルールが明記されていること

検証レベル: L4 (AskUserQuestion文字列の存在確認)
検証方法: hearingセクション内に AskUserQuestion ツールの使用に関する記述が含まれることを文字列検索で確認する
根拠: hearing-workerの主要ツールであるAskUserQuestionの使用がフェーズ定義に含まれる必要がある

### AC-4: workflow-phases.md が200行以下を維持していること

検証レベル: L1
検証方法: workflow-phases.md の総行数が200以下であることを確認する
根拠: core-constraints.md の全ソースファイル200行以下ルールに準拠する必要がある

### AC-5: hearing セクションの記述が他フェーズセクションと同一形式であること

検証レベル: L4 (セクション構造の形式比較)
検証方法: hearingセクションが既存フェーズと同じパターン(見出し + 作業概要 + Output + DoD)で記述されていることを確認する
根拠: フェーズ定義の一貫性がタスクの目的であり、形式の逸脱はLLMの参照精度を低下させる

## rtm

### F-001: hearing フェーズセクション追加

- 対象AC: AC-1, AC-2, AC-3, AC-4, AC-5
- 実装対象: .claude/skills/workflow-harness/workflow-phases.md
- 概要: Stage 0セクションとしてhearingフェーズの記述を追加。hearing-workerエージェント型とAskUserQuestionツール使用を明記する

## notInScope

- hook による強制実装 (hearing.md D-HR-5 で決定済み: ルール明記のみで運用カバー可能)
- 質問テンプレートの標準化 (hearing.md D-HR-3 で決定済み: ツールとエージェント型の強制のみ)
- workflow-delegation.md の変更 (hearing.md D-HR-1: 既存Phase Parameter Tableのマッピングで十分)
- hearing-worker.md の変更 (hearing.md D-HR-4: 現状維持、既存定義で十分)

## openQuestions

なし

## constraints

- 変更ファイル: workflow-phases.md のみ(1ファイル)
- 追加行数: 約3行(上限200行以内を維持)
- 記述形式: 既存フェーズの `### Stage N: phase_name` パターンに準拠
- 挿入位置: Stage 0: scope_definition の直前

## artifacts

- docs/workflows/hearing-askuserquestion-rule/requirements.md (本ファイル)

## next

phase: planning
action: hearing セクションの具体的な記述内容を設計し、F-001 の実装仕様を定義する
