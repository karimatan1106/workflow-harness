# testing - fix-hook-mcp-state-sync

## summary

- phase: testing
- workflow: fix-hook-mcp-state-sync
- date: 2026-04-18
- result: GREEN
- pass: 7
- fail: 0
- total: 7
- exitCode: 0
- duration_ms: 72.8387

## execution command

```
node --test workflow-harness/hooks/__tests__/hook-utils.test.js
```

実行は project root (`C:/ツール/Workflow`) を cwd として行った。Node.js 標準 test runner (`node --test`) を使用し、TAP version 13 形式の出力を取得した。

## execution log

- raw log path: `C:/ツール/Workflow/.agent/testing-run.log`
- 出力形式: TAP 13
- 終了コード: 0 (Green)

## test case results

| # | TC ID | Description | Result | duration_ms |
|---|-------|-------------|--------|-------------|
| 1 | TC-AC2-01 | readToonPhase extracts phase value from minimal TOON | ok | 0.6938 |
| 2 | TC-AC2-02 | readToonPhase returns undefined when no phase line | ok | 0.1576 |
| 3 | TC-AC2-03 | readToonPhase swallows malformed binary input | ok | 0.2748 |
| 4 | TC-AC2-04 | readToonPhase reads head only for oversized input (perf contract) | ok | 0.1775 |
| 5 | TC-AC4-01 | getActivePhaseFromWorkflowState still works for .json only | ok | 3.6945 |
| 6 | TC-AC4-02 | .json takes precedence over .toon when both exist | ok | 2.9787 |
| 7 | TC-AC1-02 | getActivePhaseFromWorkflowState reads .toon when only .toon exists | ok | 2.7849 |

合計 7 件全て pass。fail/cancelled/skipped/todo は全て 0。

## ac coverage mapping

- AC1 (TOON 読取が機能する): TC-AC1-02 で .toon-only ケースを検証
- AC2 (readToonPhase の抽出ロジックと安全性): TC-AC2-01 / 02 / 03 / 04 で正常系・null・malformed・perf contract を網羅
- AC4 (.json との後方互換と優先順位): TC-AC4-01 / 02 で json-only と json+toon 並存時の precedence を検証

AC3 (MCP 側 sync 動作) は単体テストではなく regression フェーズの統合検証で扱う方針 (next 参照)。

## decisions

1. **テスト実行ランナー選定**: 追加依存を入れずに済む Node.js 標準 `node --test` を採用した。Jest/Vitest を新規導入すると hooks の起動遅延と CI 設定の差分が増えるため不採用。
2. **実行スコープ**: `hook-utils.test.js` のみ単独実行とし、他の workflow-harness 配下テストは本フェーズでは触らない。本修正の影響範囲は readToonPhase / getActivePhaseFromWorkflowState に限定されているため、blast radius を最小に保つ。
3. **Green 判定基準**: pass===total かつ fail===0 かつ exitCode===0 の三条件を全て満たすことを Green の定義とした。3 つを同時要求することで TAP の partial pass や node runner 側の例外を見逃さない。
4. **ログ保存**: raw TAP 出力を `.agent/testing-run.log` に保存し、後続 regression フェーズや monitoring から参照可能にする。圧縮されない素出力を保持することで失敗再現時の証跡を確保。
5. **Perf contract の扱い**: TC-AC2-04 (oversized input で head only 読み) は機能テストではなく perf 契約テスト。単発実行ではばらつきが出るため、本フェーズでは「動作 ok」のみを Green 条件にし、定量しきい値は regression 段階で再評価する方針とした。

## artifacts

- test source: `C:/ツール/Workflow/workflow-harness/hooks/__tests__/hook-utils.test.js`
- target module under test: `C:/ツール/Workflow/workflow-harness/hooks/hook-utils.js`
- raw TAP log: `C:/ツール/Workflow/.agent/testing-run.log`
- this report: `C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/testing.md`
- prior phase artifact: `C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/implementation.md`

## next

regression フェーズへの引継ぎ事項:

- 単体テストは Green 確定。次は MCP server 側 (`workflow-harness/mcp-servers/lifecycle/`) との統合動作を確認する。
- 確認対象: `harness_status` が .toon 由来の phase を正しく返すこと、hook 側の判定と MCP の応答が同一 phase を指すこと。
- 回帰観点: 既存 .json ベース workflow が壊れていないこと (TC-AC4-01 / 02 を統合シナリオで再演)。
- 計測観点: TC-AC2-04 の perf contract を実環境サイズの workflow-state ファイルで再測し、head-only read が ms オーダーに収まることを確認。
- 失敗時の roll back 経路: 本修正は `readToonPhase` 追加と `getActivePhaseFromWorkflowState` の分岐追加のみ。問題発生時は該当コミットの revert で原状復帰可能。
