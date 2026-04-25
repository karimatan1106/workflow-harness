# 調査結果

## 調査結果

loop-detector.jsのグローバルエラーハンドラ終了コード不一貫問題の調査結果を報告します。
本タスクの対象はworkflow-plugin/hooks/loop-detector.jsの42行目と47行目の2箇所です。
これらの箇所でprocess.exit(1)が使用されており、他フックのprocess.exit(2)と不一貫があります。
enforce-workflow.jsとphase-edit-guard.jsのグローバルエラーハンドラでは全てexit(2)が使用されています。
loop-detector.js内でもループ検出時（345行目）とタイムアウト時（395行目）ではexit(2)を使用しており、グローバルエラーハンドラのみが異なる状態です。

## 既存実装の分析

enforce-workflow.jsではグローバルエラーハンドラ（37行目、42行目）を含む全障害系処理でexit(2)を使用しています。
phase-edit-guard.jsではEXIT_CODES定数（SUCCESS=0、WARNING=1、BLOCK=2）を定義し、全障害系でBLOCK(2)を使用しています。
loop-detector.jsでは終了コード定数が未定義で、ハードコード値を直接使用しています。
グローバルエラーハンドラの2箇所のみexit(1)であり、これはFail-Closed原則（REQ-3）との整合性に問題があります。
Claude Codeのフック仕様ではexit code 2がブロック（処理中止）を意味するため、exit(1)では意図した安全動作にならない可能性があります。

## サマリー

loop-detector.jsのグローバルエラーハンドラ（42行目・47行目）でprocess.exit(1)が使用されており、他フックのprocess.exit(2)と不一貫がある問題を調査しました。
enforce-workflow.jsとphase-edit-guard.jsではグローバルエラーハンドラを含む全障害系処理でexit(2)を統一使用しています。
loop-detector.js内でもループ検出時（345行目）とタイムアウト時（395行目）ではexit(2)を使用しており、グローバルエラーハンドラのみが異なります。
Fail-Closed原則（REQ-3）とFR-2のタイムアウトfail-closed化により、全障害系でexit(2)統一が要求されています。
修正対象はloop-detector.jsの42行目と47行目の2箇所のみで、exit(1)をexit(2)に変更するだけの軽微な修正です。

---

## process.exit()使用箇所の全体像

loop-detector.jsではprocess.exit()が合計10箇所で使用されています。
グローバルエラーハンドラのuncaughtException（42行目）とunhandledRejection（47行目）のみexit(1)です。
ループ検出時（345行目）とタイムアウト時（395行目）ではexit(2)が使用されています。
正常系の許可・スキップ処理（359行目、367行目、374行目、384行目）ではexit(0)が使用されています。
stdinエラー（404行目）と入力なし（413行目）でもexit(0)が使用されています。

---

## 他フックとの比較

enforce-workflow.jsではグローバルエラーハンドラ（37行目、42行目）を含む全障害系でexit(2)を統一使用しています。
phase-edit-guard.jsではEXIT_CODES定数（SUCCESS=0、WARNING=1、BLOCK=2）を定義し、グローバルエラーハンドラ（39行目、44行目）でexit(2)を使用しています。
loop-detector.jsのみグローバルエラーハンドラでexit(1)を使用しており、3フック間で唯一の不一貫です。
この不一貫はFail-Closed原則（REQ-3）に対する準拠レベルの差異を意味します。
exit(1)は警告レベルの終了コードであり、Claude Codeのフック仕様ではブロック扱いにならない可能性があります。

---

## 修正方針

loop-detector.jsの42行目と47行目のprocess.exit(1)をprocess.exit(2)に変更します。
変更は2行のみであり、ファイル内の他のexit()呼び出しに影響はありません。
既存テスト（fail-closed.test.ts）でグローバルエラーハンドラのexit(2)動作を検証するテストケースを追加します。
この修正により3フック全てでFail-Closed原則が完全に統一されます。
テストカバレッジの観点から、exit code一貫性テストの追加も検討します。
