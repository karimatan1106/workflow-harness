# Testing — fix-hook-layer-detection

## summary

testing phase では、実装 (implementation.md)・リファクタリング (refactoring.md)・コードレビュー (code-review.md) で確定した変更に対するフック単体テスト群を再実行し、全件 Green を再固定した。対象ファイルは `hooks/__tests__/tool-gate.test.js` (新規、AC-1 から AC-5 を検証) と既存の `hooks/__tests__/hook-utils.test.js` (TOON phase 読取りの回帰) の 2 ファイル。合計 17 テストケースを `node --test` で実行した結果、pass 17 / fail 0 / exit code 0 で終了し、L1 (orchestrator) vs L3 (worker) 判定ロジックの修正および関連回帰テストは動作確認済みである。

内訳:

- tool-gate.test.js: 10 ケース (TC-AC1-01 から TC-AC5-01) — detectLayer/checkWriteEdit の AC 検証
- hook-utils.test.js: 7 ケース (TC-AC2-01 から TC-AC4-02) — readToonPhase / getActivePhaseFromWorkflowState の回帰

## commands run

ハーネス Bash ゲート制約下で `node --test` のみ許可されているため、以下を実行した:

```
node --test C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js C:/ツール/Workflow/workflow-harness/hooks/__tests__/hook-utils.test.js
```

注: `node --test <dir>/` 形式はハーネス phase=test_impl の `node --test` allowlist マッチ挙動により一度 MODULE_NOT_FOUND 相当の解決失敗を観測したため、ファイル列挙形式で確定実行した。

## output

TAP 抜粋 (重要行のみ):

```
TAP version 13
ok 1 - TC-AC2-01: readToonPhase extracts phase value from minimal TOON
ok 2 - TC-AC2-02: readToonPhase returns undefined when no phase line
ok 3 - TC-AC2-03: readToonPhase swallows malformed binary input
ok 4 - TC-AC2-04: readToonPhase reads head only for oversized input (perf contract)
ok 5 - TC-AC4-01: getActivePhaseFromWorkflowState still works for .json only
ok 6 - TC-AC4-02: .json takes precedence over .toon when both exist
ok 7 - TC-AC1-02: getActivePhaseFromWorkflowState reads .toon when only .toon exists
ok 8 - TC-AC1-01: opaque hex agent_id returns worker
ok 9 - TC-AC1-02: arbitrary 16-char hex agent_id returns worker
ok 10 - TC-AC2-01: HARNESS_LAYER=worker overrides hookInput
ok 11 - TC-AC2-02: HARNESS_LAYER=coordinator returns coordinator
ok 12 - TC-AC3-01: null hookInput returns orchestrator
ok 13 - TC-AC3-02: hookInput without agent_id returns orchestrator
ok 14 - TC-AC3-03: empty string agent_id returns orchestrator
ok 15 - TC-AC4-01: worker layer can write to docs/workflows path (no phase)
ok 16 - TC-AC4-02: orchestrator layer is blocked from docs/workflows path
ok 17 - TC-AC5-01: tool-gate.test.js exists at expected path
1..17
# tests 17
# suites 0
# pass 17
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 70.0368
```

Exit code: 0

## decisions

- D-001: 回帰 + 新規テスト合計 17 件が全て Green のため testing gate を approve する。理由: code-review で確認された AC 1 対 1 対応 (TC-AC1-01 から TC-AC5-01) と既存 hook-utils 回帰が同時に成立している
- D-002: `node --test <dir>/` 形式ではなくファイル列挙形式を採用する。理由: ハーネス test_impl phase の Bash allowlist との相性で確実に再現可能なコマンドを記録として固定するため
- D-003: 失敗している hearing-worker-rules.test.ts は testing 判定に含めない。理由: build-check D-004 および code-review D-004 で本タスクのスコープ外と確定済みで、regression_test phase で再確認する

## artifacts

テスト対象ソース:

- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js
- C:/ツール/Workflow/workflow-harness/hooks/phase-config.js
- C:/ツール/Workflow/workflow-harness/hooks/hook-utils.js

実行テストファイル:

- C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js (10 ケース)
- C:/ツール/Workflow/workflow-harness/hooks/__tests__/hook-utils.test.js (7 ケース)

記録先:

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/testing.md (本ファイル)

カバー済み TC ID: TC-AC1-01, TC-AC1-02, TC-AC2-01, TC-AC2-02, TC-AC3-01, TC-AC3-02, TC-AC3-03, TC-AC4-01, TC-AC4-02, TC-AC5-01 (tool-gate) および readToonPhase / getActivePhaseFromWorkflowState 系 7 件 (hook-utils)

## next

- approve testing gate, advance to regression_test phase
- regression_test phase で `hooks/__tests__/` 範囲外の既存テスト (hearing-worker-rules.test.ts を含むリポジトリ全体) の影響範囲確認を行い、本タスク由来の新規失敗が発生していないことを検証
- acceptance_verification phase で AC-1 から AC-5 を verified に更新
- docs_update phase で ADR-030 本文と CLAUDE.md のフック層判定ルール反映を完了させる
