# 仕様書

## 概要

loop-detector.jsのグローバルエラーハンドラの終了コード不一貫を修正する仕様書です。
修正対象はworkflow-plugin/hooks/loop-detector.jsの42行目と47行目の2箇所のみです。
process.exit(1)をprocess.exit(2)に変更し、Fail-Closed原則への完全準拠を実現します。
テスト対象はsrc/backend/tests/unit/hooks/配下の既存テストおよびsrc/hooks/__tests__/fail-closed.test.tsです。
本修正は他フック（enforce-workflow.js、phase-edit-guard.js）との終了コード統一を目的としています。

## サマリー

loop-detector.jsのグローバルエラーハンドラ（42行目・47行目）の終了コードをexit(1)からexit(2)に変更する仕様です。
修正対象は2行のみであり、ファイル内の他のprocess.exit()呼び出しには変更を加えません。
この修正によりenforce-workflow.js、phase-edit-guard.jsとの終了コード体系が統一されます。
Claude Codeのフック仕様ではexit code 2がブロック（強制中止）を意味するため、グローバルエラーハンドラもexit(2)に統一する必要があります。
既存テストスイート732件が修正後も全てパスすることで、回帰リスクがないことを確認します。

---

## 実装計画

修正はworkflow-plugin/hooks/loop-detector.jsの2行のみに限定されます。
42行目のuncaughtExceptionハンドラ内のprocess.exit(1)をprocess.exit(2)に変更します。
47行目のunhandledRejectionハンドラ内のprocess.exit(1)をprocess.exit(2)に変更します。
ハンドラの処理ロジック（logError呼び出し、エラーメッセージ）には一切変更を加えません。
修正後、git diffで2行の引数変更のみが表示されることを確認します。

---

## 変更対象ファイル

修正対象はworkflow-plugin/hooks/loop-detector.jsの1ファイルのみです。
42行目はprocess.on('uncaughtException')ハンドラ内のprocess.exit()呼び出しで、引数を1から2に変更します。
47行目はprocess.on('unhandledRejection')ハンドラ内のprocess.exit()呼び出しで、引数を1から2に変更します。
他のprocess.exit()呼び出し（345行目、359行目、367行目、374行目、384行目、395行目、404行目、413行目）は変更しません。
enforce-workflow.jsとphase-edit-guard.jsは既にexit(2)を使用しているため変更対象外です。

---

## テスト計画

既存テストスイート全体（732テスト）が修正後も継続してパスすることを確認します。
fail-closed.test.tsにグローバルエラーハンドラのexit(2)動作テストが存在するか確認し、存在すれば修正との整合性を検証します。
修正がexit()引数の値変更のみであるため、テストの成功パターンに変更は生じません。
コード差分をgit diffで確認し、修正範囲が2行に限定されていることを視覚的に検証します。
テスト実行環境は既存のvitest環境をそのまま使用し、追加の準備は不要です。

---

## 受け入れ基準

修正後のloop-detector.jsの42行目と47行目でprocess.exit(2)が使用されていることをgrepで確認します。
ファイル内の他のprocess.exit()呼び出し8箇所が変更されていないことを確認します。
3フック全て（loop-detector、enforce-workflow、phase-edit-guard）のグローバルエラーハンドラがexit(2)を使用していることを確認します。
既存テストスイート732件が全てパスすることを確認します。
TypeScriptビルド（tsc --noEmit）がエラー0件で完了することを確認します。

---

## 影響範囲

修正対象はworkflow-plugin/hooks/loop-detector.jsの1ファイル・2行のみです。
src/hooks/__tests__/fail-closed.test.tsのテストケースがexit(2)を期待値として検証します。
src/backend/tests/unit/hooks/配下の既存テスト5ファイルも影響確認の対象です。
enforce-workflow.jsとphase-edit-guard.jsは既にexit(2)を使用しているため変更対象外です。
後方互換性は完全に保証されます（グローバルエラーハンドラは例外的処理パスのため正常系に影響なし）。

---

## 設計根拠

Claude Codeのフック仕様ではexit code 0が許可、exit code 2がブロック（強制中止）を意味します。
enforce-workflow.jsの37行目・42行目ではグローバルエラーハンドラでexit(2)を使用しています。
phase-edit-guard.jsではEXIT_CODES定数を定義し、BLOCK=2としてグローバルエラーハンドラで使用しています。
loop-detector.jsのみexit(1)が残存しており、これはFail-Closed原則（REQ-3）に対する不完全な準拠です。
本修正により3フック全てのグローバルエラーハンドラがexit(2)で統一され、一貫したセキュリティ姿勢が確立されます。
