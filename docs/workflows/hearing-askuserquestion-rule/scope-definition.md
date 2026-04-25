# Scope Definition: hearing-askuserquestion-rule

taskId: d113c137-c400-401c-9e3e-bb968f5e84e9

## summary

workflow-phases.md に hearing フェーズセクションを追加する。hearing-worker エージェント型の指定と AskUserQuestion ツールの使用ルールを、既存フェーズ記述と一貫した形式で明記する。

## target-files

- .claude/skills/workflow-harness/workflow-phases.md (編集対象)

## in-scope

- workflow-phases.md の Stage 0 セクション先頭に hearing フェーズの記述を追加
- hearing-worker エージェント型の使用を明記
- AskUserQuestion ツールによる構造化選択肢提示ルールを明記
- フェーズの目的: scope_definition の前にユーザー意図を明確化する
- 既存フェーズ記述形式(Phase Work Descriptions)との一貫性を維持

## out-of-scope

- hook による強制実装 (D-HR-5 で決定済み)
- 質問テンプレートの標準化 (D-HR-3 で決定済み)
- workflow-delegation.md の変更 (D-HR-1: 既存マッピングで十分)
- hearing-worker.md の変更 (D-HR-4: 現状維持)

## acceptance-criteria

- AC-1: workflow-phases.md に hearing フェーズセクションが存在すること
- AC-2: hearing セクションに hearing-worker エージェント指定が明記されていること
- AC-3: hearing セクションに AskUserQuestion ツール使用ルールが明記されていること

## rtm

- F-001: hearing フェーズセクション追加 (AC-1, AC-2, AC-3)

## decisions

- D-001: hearing セクションは Stage 0 の scope_definition の前に配置する。hearing は scope_definition より先に実行されるフェーズであり、時系列順の記述が読者の理解を助けるため。
- D-002: 既存フェーズと同じ見出し形式 (### Stage N: phase_name) を使用する。一貫性を保つことで LLM がフェーズ一覧をパースしやすくなるため。
- D-003: hearing フェーズは Stage 0 に分類する。scope_definition と同じ初期ステージに属し、スコープ確定前の意図明確化が目的のため。
- D-004: DoD 条件として hearing.md の存在チェック(L1)と最低行数チェック(L3)を記述に含める。他フェーズの DoD 記述パターンに合わせるため。
- D-005: AskUserQuestion ツールの使用は「構造化された選択肢の提示」に限定して記述する。自由記述形式は hearing-worker.md 側のガイドラインに委ねるため。

## artifacts

- docs/workflows/hearing-askuserquestion-rule/scope-definition.md (本ファイル)

## next

phase: research
readFiles: ".claude/skills/workflow-harness/workflow-phases.md"
action: workflow-phases.md の既存フェーズ記述パターンを詳細調査し、hearing セクションの具体的な記述内容を設計する
