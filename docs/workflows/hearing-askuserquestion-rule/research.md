# Research: hearing-askuserquestion-rule

taskId: d113c137-c400-401c-9e3e-bb968f5e84e9

## summary

workflow-phases.md (78 lines) にhearingフェーズの記載が欠落している。他の全フェーズはPhase Work Descriptionsセクションに記載されているが、hearingのみ未記載。本リサーチでは挿入位置、記述形式、行数制約を調査した。

## user-intent-analysis

- surfaceRequest: hearingフェーズの記述をworkflow-phases.mdに追加する
- deepNeed: フェーズ定義の一貫性確保。hearingが未記載のためLLMがフェーズ作業内容を参照できない
- unclearPoints: なし(hearing.mdで全質問解決済み)
- assumptions: hearing.mdのD-HR-1〜D-HR-5が有効。workflow-delegation.mdの変更は不要

## findings

### 1. workflow-phases.md の現行構造

- 行数: 78行 (上限200行まで122行の余裕あり)
- 構造: YAMLフロントマター(4行) + 説明(3行) + Phase sets定義(1行) + Phase Work Descriptions(70行)
- フェーズ記載形式: `### Stage N: phase_name` + 1段落の説明 + `Output:` + `DoD:` を含む
- Stage 0 は scope_definition (L12) から開始。hearingは存在しない

### 2. 挿入位置の特定

- hearingはscope_definitionより前に実行される(ワークフロー実行順序)
- workflow-delegation.mdのPhase Parameter Table (L97) にhearingは既に登録済み
- hearing.md の next セクションで「Stage 0セクション(scope_definition)の前にhearingを配置」と明記
- 挿入位置: L11 (Stage 0: scope_definitionの直前) に新規Stage 0: hearingセクションを追加
- scope_definitionはStage 0のまま変更不要(hearingもStage 0として並列配置)

### 3. 記述内容の設計

既存フェーズの記述パターンを分析した結果:
- 1行目: `### Stage N: phase_name`
- 2行目以降: 作業内容の説明文(1-3文)
- 要素: ツール使用、出力ファイル名、DoD条件
- 例(research, L14-15): 作業概要 + Output + DoD の3要素を含む

hearingセクションに含めるべき内容:
- hearing-workerエージェント型の使用(workflow-delegation.md L97と整合)
- AskUserQuestionツールによる構造化質問(hearing-worker.md L18-21のガイドライン参照)
- 出力ファイル: hearing.md
- DoD条件: L1 exists, L4 userResponse + decisions

### 4. hearing-worker.md の現状

- 27行、AskUserQuestionのガイドラインを定義済み(L17-21)
- 最大4質問/回、2-4選択肢/質問、推奨オプションに(Recommended)付与
- Role定義(L9-15): intent分析、構造化選択肢による質問、readonly調査、hearing.md生成
- 変更不要(hearing.md D-HR-4で決定済み)

### 5. workflow-delegation.md の現状

- Phase Parameter Table L97にhearing行が存在
- Template: hearing-worker, Role: intent analyst
- Required Sections: user intent analysis, artifacts, next, userResponse
- Common Failures: sections missing, userResponse missing
- 変更不要(hearing.md D-HR-1で決定済み)

### 6. 追加後の行数見積もり

- 現行: 78行
- 追加見込み: 3行(見出し1行 + 説明2行)
- 追加後: 約81行 (上限200行以内)

## decisions

- D-001: hearingセクションはL11(scope_definitionの直前)に挿入する -- hearingはscope_definitionより先に実行されるフェーズであり、実行順序と記載順序を一致させる
- D-002: Stage番号はStage 0とする -- scope_definitionと同じStage 0に属し、既存の番号体系を変更しない
- D-003: 記述形式は既存フェーズと同一パターン(作業概要 + Output + DoD)に従う -- フェーズ定義の一貫性確保が本タスクの目的
- D-004: AskUserQuestionツール使用を明記し、hearing-workerエージェント型への参照を含める -- workflow-delegation.mdのPhase Parameter Tableと整合させる
- D-005: DoD条件はL1 exists + L4 userResponse + decisionsとする -- workflow-delegation.mdのRequired Sectionsから導出
- D-006: workflow-phases.mdのみ変更し、workflow-delegation.mdとhearing-worker.mdは変更しない -- hearing.md D-HR-1, D-HR-4の決定に従う

## artifacts

- C:/ツール/Workflow/docs/workflows/hearing-askuserquestion-rule/research.md (本ファイル)

## next

- requirementsフェーズでAC定義(workflow-phases.mdへのhearingセクション追加に関するAC-1〜AC-N)
- 変更対象: .claude/skills/workflow-harness/workflow-phases.md (L11付近に3行追加)
