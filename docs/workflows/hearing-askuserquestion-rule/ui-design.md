# UI Design: hearing-askuserquestion-rule

taskId: d113c137-c400-401c-9e3e-bb968f5e84e9

## summary

workflow-phases.md へ hearing セクションを追加する変更の UI 設計。本タスクはブラウザ UI やコマンドラインインタフェースの変更を含まないため、対象はスキルファイル内のセクション構造のみとなる。

## change-type

CLI/API (スキルファイルの構造変更)。Storybook 対象外。

## before-state

workflow-phases.md の Phase Work Descriptions セクションは以下の構造で始まる:

  ## Phase Work Descriptions

  ### Stage 0: scope_definition
  Identify entry points and affected files ...

  ### Stage 1: research
  Investigate existing code via Glob/Grep/Read ...

hearingフェーズの記述は存在しない。LLM が hearing フェーズの作業内容を参照しようとすると、workflow-phases.md に該当セクションがなく、実行手順が不明確になる。

## after-state

workflow-phases.md の Phase Work Descriptions セクションは以下の構造で始まる:

  ## Phase Work Descriptions

  ### Stage 0: hearing
  Clarify user intent before scope_definition via hearing-worker agent. Present structured choices using AskUserQuestion tool. Recommended option always placed first (choice A). Output: hearing.md. DoD: L1 exists, L4 userResponse + decisions present.

  ### Stage 0: scope_definition
  Identify entry points and affected files ...

  ### Stage 1: research
  Investigate existing code via Glob/Grep/Read ...

hearing セクションが scope_definition の直前に配置され、Stage 0 の先頭フェーズとして定義される。

## section-structure-diff

before (L9-L12 of workflow-phases.md):
  L09: (blank)
  L10: ## Phase Work Descriptions
  L11: (blank)
  L12: ### Stage 0: scope_definition

after (L9-L15 of workflow-phases.md):
  L09: (blank)
  L10: ## Phase Work Descriptions
  L11: (blank)
  L12: ### Stage 0: hearing
  L13: Clarify user intent before scope_definition via hearing-worker agent. Present structured choices using AskUserQuestion tool. Recommended option always placed first (choice A). Output: hearing.md. DoD: L1 exists, L4 userResponse + decisions present.
  L14: (blank)
  L15: ### Stage 0: scope_definition

## content-specification

挿入される hearing セクションの内容要素:

  heading: ### Stage 0: hearing
  agent-type: hearing-worker
  tool: AskUserQuestion
  choice-rule: Recommended option always placed first (choice A)
  output: hearing.md
  dod: L1 exists, L4 userResponse + decisions present

## format-consistency

既存フェーズとの形式一貫性チェック項目:
  - 見出し形式: `### Stage N: phase_name` (一致)
  - 作業概要: 1段落の説明文 (一致)
  - Output: `Output: filename.ext` (一致)
  - DoD: `DoD: L-level condition` (一致)
  - 行数: 見出し1行 + 説明1行 + 空行1行 = 3行 (scope_definition と同等)

## impact-on-existing-sections

hearing セクション追加による既存セクションへの影響:
  - scope_definition: 行番号が3行シフト (L12 から L15 へ)
  - Stage 番号: 変更なし (hearing も Stage 0)
  - Phase sets 定義行: 変更なし (L7 のまま)
  - 総行数: 78行 から 81行 へ (200行上限以内)

## decisions

- D-001: 本タスクはスキルファイルのテキスト変更のみであり、ブラウザ UI やコマンドラインの変更は発生しないため、Storybook stories は作成対象外とする。
- D-002: before/after の差分を行番号付きで明示することで、実装フェーズでの挿入位置の判断ミスを防止する。
- D-003: content-specification セクションで挿入内容の構成要素を分離して記載することで、planning.md の Step 2 記述との照合を容易にする。
- D-004: format-consistency セクションで既存フェーズとの形式比較を5項目で実施し、AC-5 の検証基準を具体化する。
- D-005: impact-on-existing-sections セクションで既存セクションへの副作用を4項目で列挙し、意図しない変更が発生しないことを事前に定義する。
- D-006: after-state のインデント表記は2スペースを使用し、workflow-phases.md の実際のフォーマット(インデントなし)との混同を避けるため引用表記として区別する。
- D-007: Phase sets 定義行(L7)への影響がないことを明示的に記載する。hearing 追加が small/medium/large のフェーズセット定義に影響しないことを保証するため。

## artifacts

- C:/ツール/Workflow/docs/workflows/hearing-askuserquestion-rule/ui-design.md (本ファイル)

## next

phase: design_review
action: state-machine.mmd, flowchart.mmd, ui-design.md の3成果物が AC-1 から AC-5 の全要件をカバーしていることを検証する
