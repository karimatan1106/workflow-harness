# 調査

## サマリー

残存問題は2件あり、いずれもworkflow-plugin/hooks/配下のファイルに限定されています。
問題1はtest-n4-enforce-workflowテスト8件の失敗で、enforce-workflow.jsにTEST_EXTENSIONS定数とN-4コメントが不足していることが原因です。
ただしTEST_EXTENSIONSの実体はphase-definitions.jsに既に定義済みであり、テストスクリプトがenforce-workflow.jsを直接読み込むため発見できていません。
問題2は登録済みフック5ファイルのグローバルエラーハンドラにprocess.exit(1)が10箇所残存しており、Fail-Closed原則に違反しています。
settings.jsonのPreToolUse/PostToolUse登録を確認した結果、5ファイル全てが実際にClaude Codeのフックとして使用されています。
fix-all.js、fix-all-n.js、lib/task-cache.jsの3ファイルはフック登録されていないため修正対象外です。

---

## 調査結果

本調査では残存する2つの問題の原因と修正方針を特定しました。
問題1はテストスクリプトとソースコードの参照先不一致が原因であり、テストの読み込み対象ファイルの修正で解決可能です。
問題2は登録済みフック5ファイルのグローバルエラーハンドラのexit(1)をexit(2)に変更することで解決可能です。
修正対象は合計6ファイル、変更箇所は合計20箇所以下の軽微な修正です。
以下に各問題の詳細な調査結果を記述します。

---

## 既存実装の分析

enforce-workflow.jsはphase-definitions.jsからPHASE_EXTENSIONS定数を読み込んでおり、拡張子定義は分離されています。
phase-definitions.jsの267行目にTEST_EXTENSIONS定数が定義済みで、280-293行目で各テストフェーズに展開されています。
settings.jsonにはPreToolUseフック7個、PostToolUseフック3個が登録されており、うち5個にexit(1)が残存しています。
主要3フック（loop-detector、enforce-workflow、phase-edit-guard）のグローバルエラーハンドラは既にexit(2)に統一済みです。
補助フック5個のグローバルエラーハンドラのみexit(1)が残存しており、Fail-Closed原則に違反しています。

---

## 問題1: test-n4-enforce-workflow テスト失敗

テストスクリプトはenforce-workflow.jsを直接読み込み、TEST_EXTENSIONS定数とN-4コメントの存在を検証しています。
TEST_EXTENSIONS定数の実体はphase-definitions.jsの267行目に定義済みで、各テストフェーズへの展開も280-293行目で完了しています。
テスト失敗の原因は、テストスクリプトがenforce-workflow.js内でTEST_EXTENSIONSを検索しているが、実際にはphase-definitions.jsにある点です。
修正方法はテストスクリプトの読み込み対象にphase-definitions.jsを追加するか、enforce-workflow.jsにN-4コメントを追加することです。
テストのN4-07（既存.test.ts維持確認）もphase-definitions.jsを参照すれば通過する見込みです。

---

## 問題2: 補助フックexit(1)残存

settings.json登録済みフック5ファイルのグローバルエラーハンドラにexit(1)が残存しています。
check-test-first.jsは32行目と37行目にexit(1)があり、PreToolUse Writeフックとして登録されています。
check-spec.jsは32行目と37行目にexit(1)があり、PreToolUse Writeフックとして登録されています。
check-spec-sync.jsは30行目と35行目にexit(1)があり、PostToolUse Write/Editフックとして登録されています。
spec-first-guard.jsは30行目と35行目にexit(1)があり、PreToolUse Edit/Writeフックとして登録されています。
spec-first-guard.jsの68行目と107行目にもexit(1)があり、これらはブロック時の制御フローです。
spec-guard-reset.jsは26行目と31行目にexit(1)があり、PostToolUse Bashフックとして登録されています。
全てのexit(1)をexit(2)に変更する必要があります（グローバルエラーハンドラ10箇所、制御フロー2箇所）。
