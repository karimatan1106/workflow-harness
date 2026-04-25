# Docs Update: hearing-askuserquestion-rule

taskId: d113c137-c400-401c-9e3e-bb968f5e84e9

## summary

workflow-phases.md に hearing フェーズセクションを追加した変更に対するドキュメント更新評価。変更対象はスキルファイル1件のみ(workflow-phases.md)であり、永続ドキュメント(docs/architecture/, docs/spec/, CHANGELOG.md, README.md)への波及はない。ADR新規作成は不要(既存スキルファイルへの追記のみで設計判断の変更を伴わない)。

## dciAnalysis

DCI未構築のため dci_query_docs はスキップ。手動で関連ドキュメントを確認した。

関連ドキュメント一覧:
- .claude/skills/workflow-harness/workflow-phases.md: 変更済み(hearing セクション追加、Why行削除)
- .claude/skills/workflow-harness/workflow-execution.md: 変更不要(hearing の実行手順は hearing-worker.md が担う)
- .claude/agents/hearing-worker.md: 変更不要(既存定義で十分、requirements.md D-006)
- .claude/skills/workflow-harness/workflow-docs.md: 変更不要(hearing 出力の hearing.md は既にハーネスが管理)
- docs/adr/: 新規ADR不要(理由は decisions D-003 に記載)

## docCategoryCheck

### スキルファイル(.claude/skills/)
- workflow-phases.md: 更新済み。Pre-phase: hearing セクション(2行)を追加。8行のWhy行を削除(ADR-004準拠)。最終行数81行(200行制限内)。

### エージェント定義(.claude/agents/)
- hearing-worker.md: 変更不要。既に hearing フェーズのエージェント定義を含んでいる。

### ルールファイル(.claude/rules/)
- 変更不要。hearing フェーズの追加はルール変更を伴わない。

### 永続ドキュメント(docs/architecture/, docs/spec/)
- 変更不要。hearing フェーズはワークフロー内部の運用定義であり、アーキテクチャ文書への記載対象ではない。

### CHANGELOG.md
- 変更不要。ユーザー向けの機能変更ではなくワークフロー内部のドキュメント整備であるため。

### README.md
- 変更不要。hearing フェーズの存在は README のスコープ外。

### ADR
- 新規作成不要。既存スキルファイルへのセクション追記であり、設計判断の新規追加や変更を含まない。Why行の削除はADR-004(既存)に基づく。

## decisions

- D-001: 永続ドキュメント(docs/architecture/, docs/spec/)への変更は不要と判断した。hearing フェーズはワークフロー運用の内部定義であり、アーキテクチャ設計の変更ではないため。
- D-002: CHANGELOG.md への記載は不要と判断した。エンドユーザー向けの機能追加ではなくLLM向けのスキルファイル補完であるため。
- D-003: 新規ADRは不要と判断した。workflow-phases.md への hearing セクション追加は既存パターンの踏襲であり新たな設計判断を含まない。Why行削除の根拠はADR-004に既に記録されている。
- D-004: hearing-worker.md の変更は不要と判断した。requirements.md D-006 の決定(現状維持、既存定義で十分)に従う。
- D-005: workflow-execution.md の変更は不要と判断した。hearing フェーズの実行手順は hearing-worker エージェント定義が担っており、workflow-execution.md はフェーズ横断の実行ルールを定義するファイルであるため。

## artifacts

- .claude/skills/workflow-harness/workflow-phases.md: 変更済み(+2行 hearing セクション, -8行 Why行削除, 最終81行)
- docs/workflows/hearing-askuserquestion-rule/docs-update.md: 本ファイル

## next

phase: commit
action: workflow-phases.md の変更を conventional commits 形式でコミットする。メッセージ例: "docs: add hearing phase section to workflow-phases.md"
