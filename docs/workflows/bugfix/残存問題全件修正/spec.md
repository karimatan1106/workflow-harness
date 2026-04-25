# 仕様書

## 概要

本タスクはtest-n4-enforce-workflowテストの参照先修正と、補助フック5ファイルのprocess.exit(1)をprocess.exit(2)に統一する仕様書です。
修正対象は6ファイル、変更箇所は20箇所以下に限定されています。
テストスクリプトの修正ではsrc/backend/tests/unit/hooks/test-n4-enforce-workflow.test.tsの読み込み対象ファイルをphase-definitions.jsに変更します。
exit(1)の修正ではworkflow-plugin/hooks/配下の5ファイル12箇所のexit(1)をexit(2)に変更します。
本修正によりFail-Closed原則への全フック完全準拠とテストスイートの全件通過を実現します。

## サマリー

修正は2つの問題に対応します。
問題1はtest-n4テストスクリプトがenforce-workflow.jsを参照しているが、TEST_EXTENSIONSがphase-definitions.jsに定義されている参照先不一致です。
問題2は補助フック5ファイルのグローバルエラーハンドラにexit(1)が残存しているFail-Closed原則違反です。
修正対象は6ファイルで、テストスクリプト1ファイルとフック5ファイルです。
全修正は値変更と参照先変更のみであり、ロジック変更は伴いません。

---

## 実装計画

問題1の修正はsrc/backend/tests/unit/hooks/test-n4-enforce-workflow.test.tsの1ファイルに限定されます。
テストスクリプト内のTARGET_FILEまたは読み込み対象パスをenforce-workflow.jsからworkflow-plugin/hooks/lib/phase-definitions.jsに変更します。
N4-08のN-4コメント検証もphase-definitions.jsを対象とするよう修正します。
問題2の修正はworkflow-plugin/hooks/配下の5ファイルに限定されます。
各ファイルのprocess.exit(1)をprocess.exit(2)に変更し、他のexit呼び出しには変更を加えません。

---

## 変更対象ファイル

src/backend/tests/unit/hooks/test-n4-enforce-workflow.test.tsはテストの参照先をphase-definitions.jsに変更します。
workflow-plugin/hooks/check-test-first.jsの32行目と37行目のexit(1)をexit(2)に変更します。
workflow-plugin/hooks/check-spec.jsの32行目と37行目のexit(1)をexit(2)に変更します。
workflow-plugin/hooks/check-spec-sync.jsの30行目と35行目のexit(1)をexit(2)に変更します。
workflow-plugin/hooks/spec-first-guard.jsの30行目、35行目、68行目、107行目のexit(1)をexit(2)に変更します。
workflow-plugin/hooks/spec-guard-reset.jsの26行目と31行目のexit(1)をexit(2)に変更します。

---

## テスト計画

修正後にtest-n4-enforce-workflow.test.tsの8テスト全てが通過することを確認します。
他のテストスイート（test-n1からtest-n5、verify-fixes）も継続して通過することを確認します。
各フックファイルにprocess.exit(1)が残存していないことをgrep検索で確認します。
修正後のgit diffで変更が意図した箇所に限定されていることを検証します。
node -cによる構文チェックで全修正ファイルにエラーがないことを確認します。

---

## 受け入れ基準

test-n4-enforce-workflow.test.tsの8テスト全てがパスすることを確認します。
登録済みフック全ファイルのグローバルエラーハンドラがexit(2)を使用していることをgrep検索で確認します。
他のテストスイート（test-n1、test-n2、test-n3、test-n5、verify-fixes）に回帰が発生しないことを確認します。
git diffで変更が6ファイルに限定されていることを確認します。
全修正ファイルの構文チェック（node -c）がエラー0件で完了することを確認します。

---

## 影響範囲

修正対象はsrc/backend/tests/unit/hooks/test-n4-enforce-workflow.test.tsとworkflow-plugin/hooks/配下の5ファイルです。
テストスクリプトの修正はテストコードのみであり、本番環境のフック動作に影響を与えません。
exit(1)からexit(2)への変更はグローバルエラーハンドラの終了コード値のみの変更であり、処理ロジックに変更はありません。
enforce-workflow.jsとphase-edit-guard.jsとloop-detector.jsは既にexit(2)統一済みであり、本修正の対象外です。
後方互換性は完全に保証されます。

---

## 設計根拠

Claude Codeのフック仕様ではexit(0)が許可、exit(2)がブロックを意味し、exit(1)は未定義の終了コードです。
主要3フック（loop-detector、enforce-workflow、phase-edit-guard）は既にexit(2)に統一済みですが、補助フック5ファイルにexit(1)が残存していました。
test-n4テストスクリプトはenforce-workflow.jsを直接読み込みますが、リファクタリングによりTEST_EXTENSIONSがphase-definitions.jsに移動したため参照先が不一致になっていました。
本修正により全登録フックのFail-Closed原則準拠と全テストスイートの完全通過を同時に達成します。
修正は値変更と参照先変更のみであり、新たなロジック追加や機能変更は伴いません。
