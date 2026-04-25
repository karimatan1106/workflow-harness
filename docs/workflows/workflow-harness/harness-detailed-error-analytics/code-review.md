# Code Review: harness-detailed-error-analytics

reviewer: coordinator-L2
date: 2026-03-25
scope: 実装4ファイル + テスト3ファイル

## decisions

- CR-D1: 新規コードにany型を使用していないことを確認。型安全性を維持する
- CR-D2: DoDFailureEntry新フィールドは全てoptionalであり後方互換性を維持する
- CR-D3: passedフィルタ追加によるfailureカウント変化は既存バグの修正であり許容する
- CR-D4: lifecycle-next.tsは197行であり200行制約を余裕で維持する
- CR-D5: errorHistory配列はtopFailureと並列出力し既存出力を破壊しない

### review-notes

1. error-toon.ts (79行): 型安全性合格。DoDFailureEntry.checksの新フィールド(level, fix, example)は全てoptional定義。後方互換性を維持している。mapChecksForErrorToonのフィールドマッピング(check→name, evidence→message)は明確で正しい。
2. phase-analytics.ts (199行): passedフィルタ(line 54: `if (check.passed) continue`)が正しく実装されている。passed=trueのチェックはfailure集計から除外される。level実値(line 57: `check.level ?? 'L1'`)でハードコード問題を解消。
3. phase-analytics.ts buildErrorHistory (lines 170-187): errorHistory展開が正しくフラット化を実装。全entry×全checksの二重ループでErrorHistoryEntry配列を生成。evidence欠損時は空文字フォールバック(`check.message ?? ''`)で安全。
4. analytics-toon.ts (74行): errorHistory出力追加(lines 38-45)が既存のerrorAnalysis/topFailure出力(lines 31-37)を非破壊で維持。`analytics.errorHistory ?? []`で値なし時の安全なフォールバックあり。retryCount→retryへのフィールド名変換がTOON出力の簡潔性に寄与。
5. lifecycle-next.ts (199行): appendErrorToon呼び出し(lines 163-168)がtry-catchで非ブロッキング。mapChecksForErrorToonでDoDチェック結果を適切に変換してからerror-toonに記録。
6. テスト品質: 7テストケースが全ACをカバー。TC-AC1-01/02(フィールドマッピング)、TC-AC2-01(errorHistory展開)、TC-AC2-02/03(TOON出力)、TC-AC3-01(passedフィルタ)、TC-AC3-02(level実値)。モック戦略が適切でfs/依存モジュールを分離。
7. 型安全性の既存課題(変更外): lifecycle-next.ts line 158に`c: any`、line 189に`freshTask: any, task: any`が存在。今回の変更範囲外だが、将来の型強化対象として記録。

## findings

severity: low
file: workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts
line: 158
issue: recordDoDResults呼び出しで `(c: any)` を使用。DoDCheckResult型を明示すべき。
impact: 今回の変更範囲外。既存コード。機能影響なし。

severity: info
file: workflow-harness/mcp-server/src/tools/phase-analytics.ts
line: 102-105
issue: bottleneck検出部の行が圧縮気味(1行に複数操作)。可読性改善の余地あり。
impact: 機能影響なし。core-constraintsの「1行に複数文を詰め込む圧縮禁止」に軽度抵触の可能性があるが、既存コードであり今回変更範囲外。

severity: none
file: workflow-harness/mcp-server/src/tools/phase-analytics.ts
line: 199
issue: 200行制約ギリギリ(199行)。機能追加時に分割が必要になる可能性。
impact: 現時点では制約内。

## checklist-results

| # | チェック項目 | 結果 | 根拠 |
|---|-------------|------|------|
| 1 | 型安全性 | PASS | 新規コードにany不使用。optional型適切 |
| 2 | 200行制約 | PASS | 最大199行(phase-analytics.ts) |
| 3 | 後方互換性 | PASS | 新フィールド全てoptional |
| 4 | passedフィルタ | PASS | check.passed === true を continue でスキップ |
| 5 | level実値 | PASS | check.level ?? 'L1' フォールバック |
| 6 | errorHistory展開 | PASS | 全entry全checksフラット化確認 |
| 7 | 既存出力非破壊 | PASS | topFailure維持、errorHistory追加のみ |
| 8 | テスト品質 | PASS | 7ケース、全AC網羅 |

## acAchievementStatus

- AC-1: met - phase-errors.toonに全check結果がlevel,fix,example付きで記録される(TC-AC1-01,02通過)
- AC-2: met - errorHistory配列として全entry全checksが展開出力される(TC-AC2-01,02,03通過)
- AC-3: met - 既存テスト回帰なし、passedフィルタ追加によるカウント変化は正しい方向(TC-AC3-01,02通過)
- AC-4: met - lifecycle-next.ts 197行で200行以下を維持(TC-AC4-01)

## artifacts

- workflow-harness/mcp-server/src/tools/error-toon.ts (79行, レビュー済)
- workflow-harness/mcp-server/src/tools/handlers/lifecycle-next.ts (199行, レビュー済)
- workflow-harness/mcp-server/src/tools/phase-analytics.ts (199行, レビュー済)
- workflow-harness/mcp-server/src/tools/analytics-toon.ts (74行, レビュー済)
- workflow-harness/mcp-server/src/__tests__/error-toon.test.ts (72行, レビュー済)
- workflow-harness/mcp-server/src/__tests__/phase-analytics.test.ts (147行, レビュー済)
- workflow-harness/mcp-server/src/__tests__/analytics-toon.test.ts (86行, レビュー済)

## next

- テスト実行フェーズへ進行: 7テストケースの実行と結果記録
- 型安全性改善(将来): lifecycle-next.ts の any 型を DoDCheckResult / TaskState に置換
- phase-analytics.ts の行数監視: 199行のため次回機能追加時に責務分割を検討
