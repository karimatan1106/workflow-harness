# Planning: fix-failing-quality-rule-tests

taskId: 516baef8-f09e-45d9-a654-fb70c308f925

## Summary

3つのagentファイルに品質ルールセクションを追加し、2つのテストスイート(計10テストケース)を全件PASSさせる。

## Current State Analysis

### Failing Tests

first-pass-improvement.test.ts (7 tests):
- TC-AC1-01: coordinator.md に `## Phase Output Rules` セクションが存在しない
- TC-AC1-02: `decisions.*5件以上` にマッチするテキストが存在しない
- TC-AC1-03: `artifacts.*列挙` にマッチするテキストが存在しない
- TC-AC1-04: `next.*空欄禁止` にマッチするテキストが存在しない
- TC-AC2-01: worker.md に `## Edit Completeness` セクションが存在しない
- TC-AC2-02: `部分適用.*禁止` にマッチするテキストが存在しない
- TC-AC2-03: `全件適用` が存在しない

hearing-worker-rules.test.ts (3 tests):
- TC-AC1-01: 確認のみ禁止ルールが存在しない
- TC-AC2-01: 2以上の異なるアプローチ要求が存在しない
- TC-AC3-01: メリット/デメリット記載要求が存在しない

Note: TC-AC3-01/TC-AC3-02 (defs-stage4.ts) と TC-AC4-01/02/03 (200行制限) は既にPASS。
Note: TC-AC5-01 (hearing-worker.md 200行制限) も現状27行で既にPASS。

## decisions

- D-001: coordinator.md末尾に `## Phase Output Rules` セクションを追加する。既存構造を壊さず末尾追記で対応。
- D-002: worker.md末尾に `## Edit Completeness` セクションを追加する。既存の Edit Modes セクションとは独立した責務として分離。
- D-003: hearing-worker.md に `## AskUserQuestion Quality Rules` セクションを追加する。既存の AskUserQuestion Guidelines セクションは運用ガイドライン、新セクションは品質ゲートルールとして役割を分離。
- D-004: 各ファイルの200行制限を遵守する。coordinator.md(38行), worker.md(57行), hearing-worker.md(27行) いずれも追加後も100行未満で収まる。
- D-005: テストが期待する正規表現パターンに正確にマッチするテキストを使用する。自然言語の言い換えではなく、テストコードのregexに合致する文言を採用。
- D-006: 既存セクションの内容は変更しない。追記のみで対応し、既にPASSしているテスト(defs-stage4.ts, 200行制限)に影響を与えない。

## Implementation Steps

### Step 1: coordinator.md に Phase Output Rules セクション追加

File: `.claude/agents/coordinator.md`
Location: ファイル末尾（38行目以降）
Content to add:
```
## Phase Output Rules
- decisions: 5件以上を列挙すること
- artifacts: 各成果物を列挙すること
- next: 空欄禁止。次に進むフェーズを明示すること
```

Test coverage: TC-AC1-01, TC-AC1-02, TC-AC1-03, TC-AC1-04

### Step 2: worker.md に Edit Completeness セクション追加

File: `.claude/agents/worker.md`
Location: ファイル末尾（57行目以降）
Content to add:
```
## Edit Completeness
- 部分適用は禁止。指示された変更は全件適用すること。
- 一部の変更のみ適用して残りを省略してはならない。
```

Test coverage: TC-AC2-01, TC-AC2-02, TC-AC2-03

### Step 3: hearing-worker.md に AskUserQuestion Quality Rules セクション追加

File: `.claude/agents/hearing-worker.md`
Location: ファイル末尾（27行目以降）
Content to add:
```
## AskUserQuestion Quality Rules
- 確認のみの質問は禁止。「はい/いいえ」で終わる質問を避けること。
- 各質問で2つ以上の実質的に異なるアプローチを選択肢として提示すること。
- 各選択肢にメリットとデメリットを明記すること。
```

Test coverage: TC-AC1-01, TC-AC2-01, TC-AC3-01

### Step 4: テスト実行

Command: `cd workflow-harness/mcp-server && npx vitest run src/__tests__/first-pass-improvement.test.ts src/__tests__/hearing-worker-rules.test.ts`
Expected: 全10件PASS (first-pass-improvement: 7 passed, hearing-worker-rules: 3 passed)

Note: defs-stage4.ts関連テスト(TC-AC3-01, TC-AC3-02)は既にPASS済みのため変更不要。

## artifacts

| Artifact | Path | Change Type |
|----------|------|-------------|
| coordinator.md | `.claude/agents/coordinator.md` | 末尾にセクション追加 |
| worker.md | `.claude/agents/worker.md` | 末尾にセクション追加 |
| hearing-worker.md | `.claude/agents/hearing-worker.md` | 末尾にセクション追加 |

## next

implementation フェーズへ進む。Step 1-3 の編集を実行し、Step 4 でテスト全件PASSを確認する。
