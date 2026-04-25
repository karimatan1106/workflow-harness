# Requirements: cleanup-delegate-remnants

taskId: 7005fe0b-7a44-4496-9bd1-4bd7218944c2

## Summary

harness_delegate_coordinator削除後の残骸クリーンアップを行う。
harness_delegate_coordinator MCP tool は廃止・削除済みだが、3箇所に残骸参照が残存している。
allowlistからharness_delegate_coordinator削除、tsのJSDocコメント修正、
dist/の古いファイル再ビルドで除去し、コードベースの整合性を回復する。

## decisions

- tool-gate.js HARNESS_LIFECYCLE Set から harness_delegate_coordinator エントリを削除する。存在しないツールを allowlist に残すことはセキュリティ上の攻撃面となる
- stream-progress-tracker.ts 行2の JSDoc を "coordinator subprocess" から "subagent" に修正する。クラスの実際の用途と記述を一致させる
- dist/tools/handlers/ 配下の delegate-coordinator 関連4ファイル(.js, .js.map, .d.ts, .d.ts.map)を削除する。ソース(.ts)は既に削除済みで再生成されない
- dist/tools/handlers/ 配下の delegate-work 関連4ファイルを同様に削除する
- dist/tools/handlers/ 配下の coordinator-spawn 関連4ファイルを同様に削除する
- 全変更を単一コミットで実施する。変更間に依存関係がなく同一目的(dead reference 除去)であるため
- dist/ 削除後に npm run build で再ビルドし削除ファイルが再生成されないことを確認する

## acceptanceCriteria

- AC-1: tool-gate.js の HARNESS_LIFECYCLE allowlist から harness_delegate_coordinator が削除されていること
- AC-2: stream-progress-tracker.ts の JSDoc から "coordinator subprocess" 参照が修正されていること
- AC-3: dist/ から delegate-coordinator.js, delegate-work.js, coordinator-spawn.js および関連 .js.map, .d.ts, .d.ts.map が除去されていること
- AC-4: 既存テストが全てパスすること
- AC-5: harness_delegate_coordinator への参照がソースコード内に残存しないこと

## RTM (Requirements Traceability Matrix)

| RTM ID | AC | Description |
|--------|-----|-------------|
| F-001 | AC-1 | tool-gate.js allowlist cleanup |
| F-002 | AC-2 | JSDoc comment fix |
| F-003 | AC-3 | dist stale file removal |
| F-004 | AC-4 | regression test pass |
| F-005 | AC-5 | no residual harness_delegate_coordinator references |

## notInScope

- tool-gate.js detectLayer() ロジック変更: 正常動作確認済みであり変更不要
- pre-tool-guard.sh 修正: delegate 検出ロジックが存在せず変更不要
- MCP tool 定義ファイル修正: src/tools/definitions/ 配下は既に削除済み
- dist/state/manager.js 内の "delegate" コメント: 内部メソッド委譲パターンの説明であり削除対象ツールとは無関係
- 新規テスト追加: dead reference 除去のみであり既存テスト pass で回帰確認は十分

## openQuestions

なし

## Change Inventory

| # | File | Change Type | Lines Affected |
|---|------|-------------|---------------|
| 1 | workflow-harness/hooks/tool-gate.js | allowlist entry removal | L11 |
| 2 | workflow-harness/mcp-server/src/tools/handlers/stream-progress-tracker.ts | JSDoc fix | L2 |
| 3 | workflow-harness/mcp-server/dist/tools/handlers/delegate-coordinator.* | file deletion | 4 files |
| 4 | workflow-harness/mcp-server/dist/tools/handlers/delegate-work.* | file deletion | 4 files |
| 5 | workflow-harness/mcp-server/dist/tools/handlers/coordinator-spawn.* | file deletion | 4 files |

## Risk Assessment

- Size: XS (2ファイル編集 + 12ファイル削除)
- Risk: Low (dead reference 除去のみ、ロジック変更なし)
- Blast radius: hook allowlist 1エントリ + JSDoc 1行 + stale dist 12ファイル
- Rollback: git revert 単一コミットで完全復元可能

## Test Strategy

- npm run build 実行: ビルド成功と削除ファイル非再生成を確認
- tool-gate.js 既存テスト: allowlist 変更による回帰がないことを確認
- stream-progress-tracker.ts 型チェック: TypeScript コンパイル通過を確認
- grep 検証: harness_delegate_coordinator がコードベースに残存しないことを確認
