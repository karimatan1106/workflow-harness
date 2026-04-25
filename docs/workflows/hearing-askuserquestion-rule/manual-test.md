# Manual Test: hearing-askuserquestion-rule

taskId: d113c137-c400-401c-9e3e-bb968f5e84e9
phase: manual_test
date: 2026-03-28

## テストシナリオ

### Scenario 1: hearing セクションの存在確認

目的: workflow-phases.md 内に hearing フェーズが正しく配置されていることを目視確認する
手順: workflow-phases.md を開き、Phase Work Descriptions 内に hearing セクションが Stage 0: scope_definition より前に存在するか確認
期待結果: "### Pre-phase: hearing" 見出しが line 11 に存在する
対応AC: AC-1

### Scenario 2: hearing-worker エージェント型の記載確認

目的: hearing セクション内に hearing-worker エージェント型への参照が含まれていることを確認する
手順: hearing セクション本文に "hearing-worker" 文字列が含まれるか確認
期待結果: "hearing-worker" が coordinator 委譲禁止の文脈で記載されている
対応AC: AC-2

### Scenario 3: AskUserQuestion ツール使用の記載確認

目的: hearing セクション内に AskUserQuestion ツール使用ルールが含まれていることを確認する
手順: hearing セクション本文に "AskUserQuestion" 文字列が含まれるか確認
期待結果: "AskUserQuestionツールで構造化された選択肢をユーザーに提示" と明記されている
対応AC: AC-3

### Scenario 4: ファイル行数制限の維持

目的: workflow-phases.md が 200 行以下を維持していることを確認する
手順: wc -l で行数を測定する
期待結果: 81 行 (200 行制限に対して十分なマージン)
対応AC: AC-4

### Scenario 5: 既存フェーズとの形式一貫性

目的: hearing セクションの記述形式が他フェーズセクションと一致していることを確認する
手順: 他フェーズ (scope_definition, research 等) のセクション構造と比較する
期待結果: 見出し + 作業概要 + Output + DoD パターンに従っている
対応AC: AC-5

### Scenario 6: hearing セクションの内容整合性

目的: hearing セクションの内容が hearing-worker.md の定義と矛盾しないことを確認する
手順: hearing-worker.md の Role/AskUserQuestion Guidelines と workflow-phases.md の hearing セクションを比較する
期待結果: 両ファイルに矛盾がないこと (構造化された選択肢の提示、意図明確化が共通)

## テスト結果

### Result 1: hearing セクション存在 -- PASS

確認内容: workflow-phases.md line 11 に "### Pre-phase: hearing" が存在する
実行コマンド: `cat .claude/skills/workflow-harness/workflow-phases.md | head -15`
出力 (line 11-12):
```
### Pre-phase: hearing
エージェント: hearing-worker（coordinator委譲禁止）。AskUserQuestionツールで構造化された選択肢をユーザーに提示し意図を明確化する。推奨選択肢はA（先頭）に配置。出力: hearing.md。DoD: L1 exists, L2 userResponse present, L4 decisions >= 5.
```
判定: 見出しと本文が存在し、scope_definition (line 14) より前に配置されている

### Result 2: hearing-worker 記載 -- PASS

確認内容: line 12 に "hearing-worker" 文字列が含まれる
実行コマンド: `grep -n "hearing-worker" .claude/skills/workflow-harness/workflow-phases.md`
出力: `12:エージェント: hearing-worker（coordinator委譲禁止）。`
判定: hearing-worker エージェント型が coordinator 委譲禁止の文脈で正しく記載

### Result 3: AskUserQuestion 記載 -- PASS

確認内容: line 12 に "AskUserQuestion" 文字列が含まれる
実行コマンド: `grep -n "AskUserQuestion" .claude/skills/workflow-harness/workflow-phases.md`
出力: `12:...AskUserQuestionツールで構造化された選択肢をユーザーに提示し意図を明確化する。`
判定: AskUserQuestion ツール使用が構造化された選択肢の文脈で正しく記載

### Result 4: 行数制限 -- PASS

確認内容: workflow-phases.md の総行数
実行コマンド: `wc -l .claude/skills/workflow-harness/workflow-phases.md`
出力: 81 行
判定: 200 行制限に対して 119 行のマージンあり

### Result 5: 形式一貫性 -- PASS

確認内容: hearing セクションと他フェーズの構造比較
比較対象: scope_definition (line 14-15), research (line 17-18)
共通パターン: 見出し(###) + 作業概要 + Output指定 + DoD条件
hearing の構造: `### Pre-phase: hearing` + 作業概要 + `出力: hearing.md` + `DoD: L1 exists, L2 userResponse present, L4 decisions >= 5`
判定: 他フェーズと同一パターンで記述されている

### Result 6: hearing-worker.md との整合性 -- PASS

確認内容: workflow-phases.md の hearing セクションと hearing-worker.md の矛盾有無
hearing-worker.md の Role: "Use AskUserQuestion to interview the user with structured choices"
workflow-phases.md: "AskUserQuestionツールで構造化された選択肢をユーザーに提示し意図を明確化する"
判定: 両ファイルで AskUserQuestion による構造化選択肢の提示という目的が一致しており矛盾なし

## decisions

- D-001: 全6シナリオで手動検証を実施し、自動テストではカバーできない形式一貫性と内容整合性を確認した
- D-002: hearing セクションの配置が Pre-phase として Stage 0 より前にあることを実行順序の観点から妥当と判断した
- D-003: hearing-worker.md との整合性を追加検証し、ファイル間の定義矛盾がないことを確認した
- D-004: 行数マージン (119行) が十分であり、将来のフェーズ追加に対する余裕があることを確認した
- D-005: DoD 条件 (L1 exists, L2 userResponse present, L4 decisions >= 5) が hearing-worker.md の出力要件と整合していることを確認した

## artifacts

- manual-test.md: 手動テスト結果レポート (本ファイル)
- 検証対象: .claude/skills/workflow-harness/workflow-phases.md (hearing セクション, line 11-12)
- 参照: .claude/agents/hearing-worker.md (整合性比較用)

## next

- manual_test 完了。次フェーズ (security_scan, performance_test, e2e_test) へ進行可能
- hearing フェーズの実運用検証は次回のコード変更タスク実行時に自然に行われる
