# Research: fix-failing-quality-rule-tests

## Overview

2つのテストファイルが3つのagent mdファイルに特定パターンの存在を検証している。
現状、coordinator.md / worker.md / hearing-worker.md のいずれも必要なセクション・パターンが欠落しており、全テストが失敗する。

## Test File 1: first-pass-improvement.test.ts

### AC-1: coordinator.md に必要なパターン

| Test ID | expect パターン | 現状 | 判定 |
|---------|----------------|------|------|
| TC-AC1-01 | `toContain('## Phase Output Rules')` | 欠落 | FAIL |
| TC-AC1-02 | `toMatch(/decisions.*5件以上/)` | 欠落 | FAIL |
| TC-AC1-03 | `toMatch(/artifacts.*列挙/)` | 欠落 | FAIL |
| TC-AC1-04 | `toMatch(/next.*空欄禁止/)` | 欠落 | FAIL |

coordinator.md は現在37行。200行制限まで163行の余裕がある。
`## Phase Output Rules` セクションを追加し、3つのルール行を記述すれば全4テスト通過。

### AC-2: worker.md に必要なパターン

| Test ID | expect パターン | 現状 | 判定 |
|---------|----------------|------|------|
| TC-AC2-01 | `toContain('## Edit Completeness')` | 欠落 | FAIL |
| TC-AC2-02 | `toMatch(/部分適用.*禁止/)` | 欠落 | FAIL |
| TC-AC2-03 | `toContain('全件適用')` | 欠落 | FAIL |

worker.md は現在56行。200行制限まで144行の余裕がある。
`## Edit Completeness` セクションを追加し、部分適用禁止・全件適用ルールを記述すれば全3テスト通過。

### AC-3: defs-stage4.ts (対象外)

TC-AC3-01, TC-AC3-02 は defs-stage4.ts を対象としており、本タスクのスコープ外。

### AC-4: 200行制限

| Test ID | ファイル | 現在行数 | 追加後見込 | 判定 |
|---------|---------|---------|-----------|------|
| TC-AC4-01 | coordinator.md | 37 | 45程度 | PASS見込 |
| TC-AC4-02 | worker.md | 56 | 64程度 | PASS見込 |
| TC-AC4-03 | defs-stage4.ts | 対象外 | -- | -- |

## Test File 2: hearing-worker-rules.test.ts

### hearing-worker.md に必要なパターン

| Test ID | expect パターン (AND条件) | 現状 | 判定 |
|---------|--------------------------|------|------|
| TC-AC1-01 | `toMatch(/禁止\|prohibited/i)` AND `toMatch(/確認.*禁止\|confirmation.*prohibit\|Yes.*No.*禁止\|はい.*いいえ.*禁止/i)` | 欠落 | FAIL |
| TC-AC2-01 | `toMatch(/2.*以上\|2\+\|two.*or.*more/i)` AND `toMatch(/異なる\|different\|substantiv/i)` | 欠落 | FAIL |
| TC-AC3-01 | `toMatch(/メリット\|merit\|trade-off\|トレードオフ/i)` AND `toMatch(/デメリット\|demerit\|downside/i)` | 欠落 | FAIL |
| TC-AC5-01 | 200行以下 | 26行 (PASS) | PASS |

hearing-worker.md は現在26行。174行の余裕がある。
AskUserQuestion Guidelinesセクション内に品質ルールを追加すれば全テスト通過。

## Gap Summary

- coordinator.md: 4テスト失敗。Phase Output Rules セクション追加で解消。
- worker.md: 3テスト失敗。Edit Completeness セクション追加で解消。
- hearing-worker.md: 3テスト失敗。確認のみ質問禁止、2以上の選択肢、メリット/デメリット記述ルール追加で解消。
- 全ファイル200行制限: 追加後も制限内に収まる見込み。

## decisions

- D-001: coordinator.md に `## Phase Output Rules` セクションを追加し、decisions/artifacts/next の3ルールを明記する
- D-002: worker.md に `## Edit Completeness` セクションを追加し、部分適用禁止と全件適用原則を明記する
- D-003: hearing-worker.md の AskUserQuestion Guidelines に確認のみ質問の禁止ルールを追加する
- D-004: hearing-worker.md に2つ以上の異なる選択肢提示義務を明記する
- D-005: hearing-worker.md に各選択肢へのメリット・デメリット記述義務を追加する
- D-006: defs-stage4.ts のテスト(AC-3)は本タスクスコープ外とし、別タスクで対応する
- D-007: 各ファイルの追加内容は200行制限を超えないことを実装時に確認する

## artifacts

- `C:/ツール/Workflow/.claude/agents/coordinator.md` -- Phase Output Rules セクション追加
- `C:/ツール/Workflow/.claude/agents/worker.md` -- Edit Completeness セクション追加
- `C:/ツール/Workflow/.claude/agents/hearing-worker.md` -- AskUserQuestion 品質ルール追加

## next

implementation フェーズ: 上記3ファイルにテストが期待するパターンを含むセクションを追加する
