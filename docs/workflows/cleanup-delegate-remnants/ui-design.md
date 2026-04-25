# UI Design: cleanup-delegate-remnants

taskId: 7005fe0b-7a44-4496-9bd1-4bd7218944c2

## Summary

このタスクは dead code / dead reference の除去のみを対象としており、
ユーザーインターフェースへの変更は一切発生しない。
以下に影響分析と設計判断を記載する。

## Impact Analysis

### 変更対象とUI関連性

| # | File | Change Type | UI Impact |
|---|------|-------------|-----------|
| 1 | tool-gate.js | allowlist entry削除 | なし。内部hookロジック。ユーザーから不可視 |
| 2 | stream-progress-tracker.ts | JSDocコメント修正 | なし。ソースコード内コメントのみ。実行時出力に影響なし |
| 3 | dist/delegate-coordinator.* | ファイル削除 | なし。ビルド成果物。既にソース削除済みで呼び出し経路なし |
| 4 | dist/delegate-work.* | ファイル削除 | なし。同上 |
| 5 | dist/coordinator-spawn.* | ファイル削除 | なし。同上 |

### CLI出力への影響

- tool-gate.js が返すエラーメッセージに変更なし。
  harness_delegate_coordinator は既に MCP tool 定義から削除済みのため、
  このツールを呼び出す経路自体が存在しない。
- stream-progress-tracker.ts のランタイム動作は変更しない。
  JSDocコメントのみの修正であり、プログレス表示やログ出力に影響なし。

### MCP Tool インターフェースへの影響

- harness_delegate_coordinator は既に tool 定義から削除済み。
  今回の変更は残骸参照の除去であり、公開APIに影響しない。
- 他の MCP tool の入出力スキーマに変更なし。

## Screen Mockups

該当なし。UI変更が存在しないため、モックアップは不要。

## Accessibility

該当なし。視覚的変更が存在しないため、アクセシビリティへの影響はない。

## decisions

- UI変更なしと判定した。全変更対象が内部hookロジック、ソースコメント、ビルド成果物であり、ユーザー可視の出力を変更しない
- CLI出力フォーマットを現状維持する。tool-gate.js のエラーメッセージテンプレートは変更不要
- MCP tool の公開スキーマを変更しない。残骸除去は内部整合性の回復であり外部契約に影響しない
- プログレス表示の動作を変更しない。stream-progress-tracker.ts はJSDocコメント修正のみで実行パスに変更なし
- モックアップ作成をスキップする。UI変更ゼロのタスクにモックアップを作成しても成果物の品質に寄与しない
- エラーハンドリングUIを変更しない。既存のエラー表示経路は正常動作しており修正対象外

## artifacts

- docs/workflows/cleanup-delegate-remnants/ui-design.md (本ファイル)

## next

implementation フェーズへ進む。
UI変更なしのため、実装は scope-definition.md で定義された
ファイル変更(allowlist修正、JSDoc修正、dist/ファイル削除)を直接実行する。
