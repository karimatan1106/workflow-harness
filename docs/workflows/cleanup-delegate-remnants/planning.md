# Planning: cleanup-delegate-remnants

taskId: 7005fe0b-7a44-4496-9bd1-4bd7218944c2

## Summary

harness_delegate_coordinator 廃止後の残骸参照3箇所を除去し、dist/ を再ビルドして整合性を回復する。
変更はすべて dead reference の除去であり、ロジック変更を含まない。

## decisions

- tool-gate.js 行10の 'harness_delegate_coordinator' を HARNESS_LIFECYCLE Set から削除する。存在しないツールを allowlist に残すことはセキュリティ上の攻撃面となるため除去する
- stream-progress-tracker.ts 行2の JSDoc を "Tracks coordinator subprocess output" から "Tracks subprocess output" に修正する。coordinator 固有の記述が実態と乖離しているため修正する
- dist/tools/handlers/ 配下の delegate-coordinator, delegate-work, coordinator-spawn 各4ファイル(計12ファイル)を手動削除する。対応するソース(.ts)は既に削除済みであり再生成されない
- 削除後に npm run build を実行し、削除ファイルが再生成されないことを確認する。ソース不在の dist ファイルが万一再生成される場合はビルド設定の調査が必要になるが、可能性は低い
- 全変更を単一コミットにまとめる。目的が同一(dead reference 除去)であり、変更間に依存関係がないため分割する利点がない
- grep -r "harness_delegate_coordinator" で残存参照ゼロを検証する。コードベース全体の整合性を保証する最終チェックとして実施する

## Implementation Steps

### Step 1: tool-gate.js allowlist 修正

- File: workflow-harness/hooks/tool-gate.js
- Line: 10
- Action: `'harness_delegate_coordinator',` を行から削除する
- Before: `  'harness_delegate_coordinator', 'harness_set_scope', 'harness_complete_sub',`
- After: `  'harness_set_scope', 'harness_complete_sub',`
- Verification: ファイル保存後、HARNESS_LIFECYCLE Set に harness_delegate_coordinator が含まれないことを確認

### Step 2: stream-progress-tracker.ts JSDoc 修正

- File: workflow-harness/mcp-server/src/tools/handlers/stream-progress-tracker.ts
- Line: 2
- Action: "coordinator subprocess" を "subprocess" に修正
- Before: `* StreamProgressTracker - Tracks coordinator subprocess output and writes progress to a Markdown file.`
- After: `* StreamProgressTracker - Tracks subprocess output and writes progress to a Markdown file.`
- Verification: TypeScript コンパイルエラーなし

### Step 3: dist/ 孤立ファイル削除

- Directory: workflow-harness/mcp-server/dist/tools/handlers/
- Files to delete (12 files):
  - delegate-coordinator.js, delegate-coordinator.js.map, delegate-coordinator.d.ts, delegate-coordinator.d.ts.map
  - delegate-work.js, delegate-work.js.map, delegate-work.d.ts, delegate-work.d.ts.map
  - coordinator-spawn.js, coordinator-spawn.js.map, coordinator-spawn.d.ts, coordinator-spawn.d.ts.map
- Action: rm コマンドで一括削除

### Step 4: 再ビルド

- Command: `cd workflow-harness/mcp-server && npm run build`
- Verification: ビルド成功、かつ Step 3 で削除した12ファイルが dist/ に再出現しないこと

### Step 5: 残存参照検証

- Command: `grep -r "harness_delegate_coordinator" workflow-harness/ --include="*.ts" --include="*.js"`
- Expected: 一致なし(exit code 1)
- Command: `grep -r "coordinator subprocess" workflow-harness/mcp-server/src/ --include="*.ts"`
- Expected: 一致なし(exit code 1)

### Step 6: テスト実行

- Command: `cd workflow-harness/mcp-server && npx vitest run`
- Expected: 全テストパス

## Worker Task Decomposition

このタスクは単一 Worker で逐次実行する。変更量が XS であり並列化の利点がない。

| Task | Worker | Steps | AC Coverage |
|------|--------|-------|-------------|
| W-1: ソース修正 + dist 削除 + ビルド + 検証 | worker-1 | Step 1-6 | AC-1, AC-2, AC-3, AC-4, AC-5 |

## artifacts

- planning.md (本ファイル): 実装計画と Worker タスク分解

## next

implementation フェーズへ進む。Worker-1 が Step 1-6 を逐次実行する。
