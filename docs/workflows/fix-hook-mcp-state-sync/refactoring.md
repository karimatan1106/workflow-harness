# Refactoring

## refactored
- C:/ツール/Workflow/workflow-harness/hooks/hook-utils.js

## rationale
`getActivePhaseFromWorkflowState` の .toon 分岐で、`readToonHeadFromFile(toonPath)` を呼び出してから `readToonPhase(head)` に渡す 2 段処理は、`readToonPhase(toonPath)` が内部で同一の分岐 (path 判定 → `readToonHeadFromFile` 呼び出し) を持つため冗長。
`readToonPhase` はパス文字列を受けた場合も挙動が同じ (path 判定ヒューリスティック → `readToonHeadFromFile` → phase 抽出) であり、戻り値も `string | undefined` で一致する。
よって 2 段呼び出しを `readToonPhase(toonPath)` 1 回に統合した。関数抽出・署名変更・振る舞い変更なし、ロジック重複のみ解消。

- 行数: 150 → 149 (200 行制限内、変化軽微)
- エラーハンドリング: 既に try/catch に統一されており追加変更不要
- 禁止語チェック: なし

## testResult
pass: 7 / fail: 0 / total: 7, exitCode: 0

## green
true
