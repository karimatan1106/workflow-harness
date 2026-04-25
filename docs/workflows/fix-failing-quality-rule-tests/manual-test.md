# Manual Test: fix-failing-quality-rule-tests

taskId: 516baef8-f09e-45d9-a654-fb70c308f925

## Verification Summary

3つのagentファイル(coordinator.md, worker.md, hearing-worker.md)に品質ルールセクションが正しく追加されたことを手動検証した。全10テストケースのパターンマッチを確認済み。

## Test Results: first-pass-improvement.test.ts (7 tests)

### AC-1: coordinator.md Phase Output Rules

- TC-AC1-01 PASS: `## Phase Output Rules` セクションが39行目に存在する
- TC-AC1-02 PASS: `decisions.*5件以上` パターンが40行目 "decisions: 5件以上を列挙すること" にマッチする
- TC-AC1-03 PASS: `artifacts.*列挙` パターンが41行目 "artifacts: 各成果物を列挙すること" にマッチする
- TC-AC1-04 PASS: `next.*空欄禁止` パターンが42行目 "next: 空欄禁止。次に進むフェーズを明示すること" にマッチする

### AC-2: worker.md Edit Completeness

- TC-AC2-01 PASS: `## Edit Completeness` セクションが58行目に存在する
- TC-AC2-02 PASS: `部分適用.*禁止` パターンが59行目 "部分適用は禁止。指示された変更はすべて適用すること。" にマッチする
- TC-AC2-03 PASS: `全件適用` パターンが60行目 "全件適用を原則とし、一部のみの適用で完了としない。" に含まれる

## Test Results: hearing-worker-rules.test.ts (3 tests)

### AC-3: hearing-worker.md AskUserQuestion Quality Rules

- TC-AC1-01 PASS: `確認.*禁止` パターンが29行目 "確認のみの質問（はい/いいえ）は禁止。選択肢を提示すること。" にマッチする
- TC-AC2-01 PASS: `2.*以上` と `異なる` パターンが30行目 "2つ以上の実質的に異なるアプローチを提示すること。" にマッチする
- TC-AC3-01 PASS: `メリット` と `デメリット` パターンが31行目 "各選択肢にメリットとデメリットを明記すること。" にマッチする

## Side Effect Check: Existing Tests (already PASS)

- TC-AC3-01/02 (defs-stage4.ts baseline/RTM): 変更対象外。影響なし
- TC-AC4-01 (coordinator.md 200行制限): 43行。制限内
- TC-AC4-02 (worker.md 200行制限): 61行。制限内
- TC-AC4-03 (defs-stage4.ts 200行制限): 変更対象外。影響なし
- TC-AC5-01 (hearing-worker.md 200行制限): 32行。制限内

## decisions

- D-001: coordinator.md の Phase Output Rules セクション(39-42行)がテスト4件の全正規表現パターンに合致することを確認した
- D-002: worker.md の Edit Completeness セクション(58-60行)がテスト3件の全正規表現パターンに合致することを確認した
- D-003: hearing-worker.md の AskUserQuestion Quality Rules セクション(28-31行)がテスト3件の全正規表現パターンに合致することを確認した
- D-004: 3ファイルとも200行制限を大幅に下回っており(最大61行)、既存PASSテストへの副作用がないことを確認した
- D-005: 既存セクションの内容は変更されておらず、追記のみで対応されていることをファイル全文比較で確認した

## artifacts

- C:/ツール/Workflow/.claude/agents/coordinator.md: Phase Output Rules セクション追加済み(39-42行)
- C:/ツール/Workflow/.claude/agents/worker.md: Edit Completeness セクション追加済み(58-60行)
- C:/ツール/Workflow/.claude/agents/hearing-worker.md: AskUserQuestion Quality Rules セクション追加済み(28-31行)

## next

deployment フェーズへ進む。テスト実行(npx vitest run)で全10件PASSを自動確認し、コミット・プッシュを行う。
