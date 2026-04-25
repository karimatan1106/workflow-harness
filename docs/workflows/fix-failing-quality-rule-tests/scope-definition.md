# Scope Definition: fix-failing-quality-rule-tests

taskId: 516baef8-f09e-45d9-a654-fb70c308f925

## Problem Statement

テスト16件中10件が失敗している。原因は .claude/agents/ 配下の3ファイル（coordinator.md, worker.md, hearing-worker.md）にテストが期待するルールセクションが存在しないため。

## Failing Tests

### first-pass-improvement.test.ts (7 failures)
- TC-AC1-01: coordinator.md に `## Phase Output Rules` セクションが存在しない
- TC-AC1-02: coordinator.md に `decisions.*5件以上` ルールが存在しない
- TC-AC1-03: coordinator.md に `artifacts.*列挙` ルールが存在しない
- TC-AC1-04: coordinator.md に `next.*空欄禁止` ルールが存在しない
- TC-AC2-01: worker.md に `## Edit Completeness` セクションが存在しない
- TC-AC2-02: worker.md に `部分適用.*禁止` ルールが存在しない
- TC-AC2-03: worker.md に `全件適用` ルールが存在しない

### hearing-worker-rules.test.ts (3 failures)
- TC-AC1-01: hearing-worker.md に確認のみ質問の禁止ルールが存在しない
- TC-AC2-01: hearing-worker.md に2つ以上の異なるアプローチ必須ルールが存在しない
- TC-AC3-01: hearing-worker.md にメリット/デメリット記載必須ルールが存在しない

## In-Scope

| ID | Target File | Change |
|----|-------------|--------|
| S-1 | .claude/agents/coordinator.md | `## Phase Output Rules` セクション追加 (4テスト対応) |
| S-2 | .claude/agents/worker.md | `## Edit Completeness` セクション追加 (3テスト対応) |
| S-3 | .claude/agents/hearing-worker.md | `## AskUserQuestion Quality Rules` セクション追加 (3テスト対応) |

## Out-of-Scope

- defs-stage4.ts の変更（TC-AC3-01, TC-AC3-02 は既にPASS）
- 200行制限テスト（TC-AC4-01〜03 は既にPASS）
- テストコード自体の変更

## Acceptance Criteria

- AC-1: coordinator.md に Phase Output Rules セクションを追加し、TC-AC1-01〜04 の4テストが全てPASS
- AC-2: worker.md に Edit Completeness セクションを追加し、TC-AC2-01〜03 の3テストが全てPASS
- AC-3: hearing-worker.md に AskUserQuestion Quality Rules セクションを追加し、TC-AC1-01, TC-AC2-01, TC-AC3-01 の3テストが全てPASS

## Decisions

- D-001: coordinator.mdにPhase Output Rulesセクション追加（既存フォーマットに合わせたセクション追記）
- D-002: worker.mdにEdit Completenessセクション追加（Edit Modesセクションの後に配置し、部分適用禁止と全件適用ルールを明記）
- D-003: hearing-worker.mdにAskUserQuestion Quality Rulesセクション追加（AskUserQuestion Guidelinesの後に配置）
- D-004: テスト正規表現パターンに合致するテキストを使用（テスト駆動で文言を決定）
- D-005: 各ファイル200行制限を維持（追加内容は必要最小限のルール記述に留める）
- D-006: 既存セクションの内容は変更しない（追記のみ）

## Artifacts

- `docs/workflows/fix-failing-quality-rule-tests/scope-definition.md` (本ファイル)
- `.claude/agents/coordinator.md` (Phase Output Rules セクション追加後)
- `.claude/agents/worker.md` (Edit Completeness セクション追加後)
- `.claude/agents/hearing-worker.md` (AskUserQuestion Quality Rules セクション追加後)

## Next

design フェーズ: 各ファイルへの追加内容の詳細設計（テスト正規表現とのマッチング確認を含む）

## Worker Tasks (parallel execution)

修正は3ファイルが独立しているため、並列実行可能:

- Worker-1: coordinator.md に Phase Output Rules セクション追加
- Worker-2: worker.md に Edit Completeness セクション追加
- Worker-3: hearing-worker.md に AskUserQuestion Quality Rules セクション追加
