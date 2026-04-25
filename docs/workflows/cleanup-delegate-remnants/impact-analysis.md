# Impact Analysis: cleanup-delegate-remnants

taskId: 7005fe0b-7a44-4496-9bd1-4bd7218944c2

## Summary

delegate-coordinator 関連の残存参照3箇所と dist/ 配下12ファイルの削除による影響を分析した。
全変更は dead code / dead reference の除去であり、実行時の振る舞いに変化はない。

## Change Inventory

| # | File | Change Type | Risk |
|---|------|------------|------|
| 1 | tool-gate.js L11 | allowlist entry removal | None |
| 2 | stream-progress-tracker.ts L2 | JSDoc comment fix | None |
| 3 | dist/ (12 files) | dead file deletion | None |

## Impact by Change

### 1. tool-gate.js: HARNESS_LIFECYCLE allowlist

- harness_delegate_coordinator は MCP ツールとして既に削除済み
- allowlist に残っていても gate 判定に到達する経路がない
- 削除しても runtime 動作は不変
- 依存先: hook 実行パイプライン。hook は tool 名を照合するのみで、allowlist 縮小による副作用なし

### 2. stream-progress-tracker.ts: JSDoc 参照

- 行2 の JSDoc コメントに "coordinator subprocess" の文言が残存
- ロジック変更なし。型シグネチャ変更なし。export 変更なし
- テストへの影響: ゼロ（コメントのみ）
- IDE ホバー表示が正確になる（正の効果）

### 3. dist/ 配下 12 ファイル削除

- 対象: delegate-coordinator.js, delegate-work.js, coordinator-spawn.js 等
- ソース(.ts)は既に削除済み。dist/ はビルド成果物
- `npm run build` で再生成されないことを確認済み（ソースが存在しないため）
- package.json の bin/exports フィールドに参照なし
- 実行時にこれらを require/import するコードパスは存在しない

## Risk Assessment

Overall Risk: **Minimal**

- 機能回帰リスク: なし（削除対象は全て到達不能コード・参照）
- ビルド破壊リスク: なし（dist/ はビルド成果物、ソース変更は JSDoc のみ）
- 依存グラフへの影響: なし（削除対象を import するモジュールは存在しない）
- ロールバック必要性: 極めて低い

## Test Strategy

- dist/ 削除後に `npm run build` を実行し、削除ファイルが再生成されないことを確認
- tool-gate.js の既存テストが pass することを確認
- stream-progress-tracker.ts の型チェックが pass することを確認

## decisions

- tool-gate.js の allowlist 変更はランタイム影響ゼロと判定。ツール自体が存在しないため gate に到達する経路がない
- stream-progress-tracker.ts は JSDoc コメント修正のみでありテスト不要と判定
- dist/ 12 ファイルはソース削除済みのビルド残存物であり、安全に削除可能と判定
- 全変更を単一コミットで実施可能と判定。変更間に依存関係がなく、かつ全てが同一目的（dead reference 除去）であるため
- 回帰テストは build 実行 + 既存テスト pass の確認で十分と判定。新規テスト追加は不要

## artifacts

- impact-analysis.md (本ファイル): 影響範囲分析と判定結果

## next

implementation フェーズに進む。3箇所の参照修正と dist/ 12 ファイル削除を実施する。
