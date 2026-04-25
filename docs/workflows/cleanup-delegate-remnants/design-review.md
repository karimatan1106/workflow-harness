# Design Review: cleanup-delegate-remnants

taskId: 7005fe0b-7a44-4496-9bd1-4bd7218944c2

## Review Summary

planning.md, state-machine.mmd, flowchart.mmd, ui-design.md の4成果物をレビューした。
全成果物がタスク目的(dead reference除去)に適合しており、実装フェーズへの移行に問題はない。

## AC Coverage Analysis

| AC | Description | Planning Coverage | Verdict |
|----|-------------|-------------------|---------|
| AC-1 | tool-gate.js HARNESS_LIFECYCLE Set から harness_delegate_coordinator 除去 | Step 1 で明示。Before/After コード例あり | Covered |
| AC-2 | stream-progress-tracker.ts JSDoc から "coordinator subprocess" 除去 | Step 2 で明示。Before/After コード例あり | Covered |
| AC-3 | dist/ 内の delegate-coordinator/delegate-work/coordinator-spawn 12ファイル不在 | Step 3 で対象12ファイルを列挙。rm で一括削除 | Covered |
| AC-4 | npm run build 成功かつ削除ファイル再生成なし | Step 4 で build 実行と再出現チェックを明示 | Covered |
| AC-5 | harness_delegate_coordinator 参照がソースに残存しないこと | Step 5 で grep -r による全量検索を明示 | Covered |

全5件のACがplanning.mdの実装ステップで明確にカバーされている。

## State Machine Review

state-machine.mmd の遷移は planning.md の Step 1-6 と一致している。
EditToolGate -> EditStreamTracker -> DeleteStaleFiles -> Rebuild -> Verify -> Done の直列遷移が
planning の逐次実行方針と整合する。
Verify 内部で GrepCheck -> VitestRun のサブ遷移を持ち、Step 5-6 に対応している。

## Flowchart Review

flowchart.mmd にはエラーハンドリングが適切に含まれている。
具体的には以下の5つの分岐で失敗時のリトライループが設計されている:
- D3: tool-gate.js 修正の妥当性検証 (失敗時 -> 再編集)
- D4: stream-progress-tracker.ts 修正の妥当性検証 (失敗時 -> 再編集)
- D5: dist/ クリーンアップ完了確認 (失敗時 -> 再削除)
- D1: 残存参照チェック (検出時 -> 追加修正して再チェック)
- D2: vitest 全テストパス (失敗時 -> 分析して修正後に再テスト)

## UI Impact Assessment

ui-design.md の「UI変更なし」判断は妥当である。
理由: 変更対象は hook 内部ロジック(tool-gate.js allowlist)、ソースコメント(JSDoc)、
ビルド成果物(dist/)のみであり、CLI出力フォーマットやMCP toolスキーマに影響しない。
harness_delegate_coordinator は既にMCP tool定義から削除済みで呼び出し経路が存在しない。

## Risk Assessment

リスクは極めて低い。全変更がdead code/dead reference の除去であり、
実行時ロジックへの変更はJSDocコメント修正のみ(ランタイム影響ゼロ)。
blast radius は hook allowlist + JSDoc + stale dist artifacts に限定される。

## decisions

- AC-1からAC-5の全てがplanning.mdの実装ステップで明確にカバーされていることを確認した。追加ステップは不要である
- state-machine.mmd の直列遷移がplanning.mdの逐次実行方針と完全に一致していることを確認した。並列化は不要で正しい判断である
- flowchart.mmd に5つのエラーハンドリング分岐が含まれており、各ステップの失敗からの回復パスが設計されていることを確認した
- ui-design.md の「UI変更なし」判断は妥当である。全変更対象が内部ロジック/コメント/ビルド成果物であり、ユーザー可視の出力に影響しない
- planning.md の単一Worker逐次実行方針は適切である。変更量XSかつ変更間の依存関係(編集 -> ビルド -> 検証)があり、並列化の利点がない
- dist/ ファイルの手動削除後にビルドで再生成されないことを検証するアプローチは正しい。ソース不在のdistファイルが残存するリスクを排除できる

## artifacts

- docs/workflows/cleanup-delegate-remnants/design-review.md (本ファイル)
- docs/workflows/cleanup-delegate-remnants/planning.md (レビュー済み、変更なし)
- docs/workflows/cleanup-delegate-remnants/state-machine.mmd (レビュー済み、変更なし)
- docs/workflows/cleanup-delegate-remnants/flowchart.mmd (レビュー済み、変更なし)
- docs/workflows/cleanup-delegate-remnants/ui-design.md (レビュー済み、変更なし)

## next

implementation フェーズへ進む。Worker-1 が planning.md の Step 1-6 を逐次実行する。

## acDesignMapping

- AC-1: tool-gate.js HARNESS_LIFECYCLE配列の要素削除（planning Step 1）
- AC-2: stream-progress-tracker.ts JSDocコメント文字列置換（planning Step 2）
- AC-3: dist/古いファイル削除 + npm run build再ビルド（planning Step 3）
- AC-4: vitest runによるリグレッションテスト実行（planning Step 4）
- AC-5: grep -r による残存参照の網羅検索（planning Step 4検証）
