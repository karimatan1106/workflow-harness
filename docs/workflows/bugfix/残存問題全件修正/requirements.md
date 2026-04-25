# 要件定義書

## サマリー

本要件定義では、ワークフロープラグインにおける残存問題2件の修正要件を規定します。問題1はテストスクリプトtest-n4-enforce-workflow.test.tsがTEST_EXTENSIONS定数をenforce-workflow.jsから検索しているが、実体はphase-definitions.jsに存在するという参照先不一致です。テストの読み込み対象ファイルをphase-definitions.jsに修正します。問題2は補助フック5ファイルに残存するprocess.exit(1)を全てexit(2)に統一し、Fail-Closed原則を遵守します。修正対象は合計6ファイルで、変更箇所はテスト修正8箇所、exit(1)変更12箇所の計20箇所です。修正により全テストケースが合格し、フック動作がFail-Closed原則に完全準拠します。

---

## 概要

### 修正目的

ワークフロープラグインの品質向上と完全性確保のため、残存する2つの問題を解決します。問題1ではテストスクリプトとソースコードの参照先不一致を解消し、テストの正確性を回復します。問題2では登録済みフック5ファイルのexit(1)をexit(2)に統一し、Fail-Closed原則を完全適用します。これにより全てのフックが予期しないエラー発生時に安全側に倒れる動作を保証します。

### 修正範囲

修正対象は6ファイルに限定されます。テスト修正としてtest-n4-enforce-workflow.test.tsの8箇所を変更します。フック修正としてcheck-test-first.js、check-spec.js、check-spec-sync.js、spec-first-guard.js、spec-guard-reset.jsの5ファイル合計12箇所のexit(1)をexit(2)に変更します。いずれもhooks配下のファイルであり、影響範囲は明確に限定されています。

---

## 問題1: test-n4テスト修正

### 問題の詳細

テストスクリプトtest-n4-enforce-workflow.test.tsは、TEST_EXTENSIONS定数とN-4コメントの存在をenforce-workflow.js内で検証しています。しかしTEST_EXTENSIONSの実体はphase-definitions.jsの267行目に定義されており、各テストフェーズへの展開も同ファイルの280-293行目で完了しています。テストスクリプトがenforce-workflow.jsのみを読み込むため、TEST_EXTENSIONSを発見できずに8件のテストケースが失敗します。

### 要件内容

テストスクリプトの読み込み対象をphase-definitions.jsに変更します。具体的には以下の8箇所を修正します。N4-01からN4-06のテストケースでは、enforce-workflow.jsの読み込みに加えてphase-definitions.jsも読み込み、TEST_EXTENSIONSの検索対象をphase-definitions.jsに変更します。N4-07のテストケースでは既存のtest.ts拡張子維持を検証するため、phase-definitions.jsのPHASE_EXTENSIONS定義を参照します。N4-08のテストケースではN-4コメントの存在確認を行います。

### 修正箇所

テストファイルsrc/backend/tests/unit/hooks/test-n4-enforce-workflow.test.tsを修正します。各テストケースの冒頭でconst phaseDefContent = fs.readFileSyncを追加し、phase-definitions.jsを読み込みます。expect文の検索対象をphaseDefContentに変更します。N4-01ではTEST_EXTENSIONS定数の定義を検索します。N4-02では.test.ts拡張子がTEST_EXTENSIONSに含まれることを検証します。N4-03では.spec.ts拡張子がTEST_EXTENSIONSに含まれることを検証します。N4-04ではtest_impl, testing, regression_testフェーズにtest/specが含まれることを検証します。N4-05ではmanual_test, e2e_testフェーズにtest/specが含まれることを検証します。N4-06では実装フェーズにtestファイルが含まれないことを検証します。N4-07では既存.test.ts拡張子が維持されていることを検証します。N4-08ではenforce-workflow.js内にN-4コメントが存在することを検証します。

---

## 問題2: 補助フックexit(1)残存

### 問題の詳細

settings.jsonに登録された補助フック5ファイルのグローバルエラーハンドラに、process.exit(1)が合計10箇所残存しています。制御フローでのexit(1)も2箇所あり、合計12箇所です。主要3フック（loop-detector、enforce-workflow、phase-edit-guard）は既にexit(2)に統一済みですが、補助フックのみ未修正でした。exit(1)はユーザー操作エラーを示すため、システムエラー発生時に使用するとFail-Closed原則に違反します。予期しないエラー時にツール実行を継続してしまい、データ破壊のリスクがあります。

### 要件内容

補助フック5ファイルの全exit(1)をexit(2)に変更します。グローバルエラーハンドラの10箇所と制御フローの2箇所、合計12箇所を修正します。exit(2)はシステムエラーを示し、予期しないエラー発生時にツール実行を中断することで安全側に倒れる動作を保証します。修正により全てのフックがFail-Closed原則に準拠します。

### 修正箇所

check-test-first.jsの32行目と37行目のグローバルエラーハンドラをexit(2)に変更します。check-spec.jsの32行目と37行目のグローバルエラーハンドラをexit(2)に変更します。check-spec-sync.jsの30行目と35行目のグローバルエラーハンドラをexit(2)に変更します。spec-first-guard.jsの30行目と35行目のグローバルエラーハンドラをexit(2)に変更します。spec-first-guard.jsの68行目と107行目の制御フローをexit(2)に変更します。spec-guard-reset.jsの26行目と31行目のグローバルエラーハンドラをexit(2)に変更します。全ての変更により、予期しないエラー発生時にツール実行を確実に中断します。

---

## 機能要件

### FR-1: テスト読み込み対象変更

test-n4-enforce-workflow.test.tsの各テストケースでphase-definitions.jsを読み込み、TEST_EXTENSIONS定数の検索対象をphase-definitions.jsに変更すること。N4-01からN4-06の6ケースでTEST_EXTENSIONS関連の検証を実施すること。N4-07で既存test.ts拡張子の維持を検証すること。N4-08でenforce-workflow.js内のN-4コメント存在を検証すること。

### FR-2: check-test-first.js修正

check-test-first.jsの32行目と37行目のprocess.exit(1)をprocess.exit(2)に変更すること。変更後もPreToolUse Writeフックとして正常に動作すること。予期しないエラー発生時にツール実行を中断すること。

### FR-3: check-spec.js修正

check-spec.jsの32行目と37行目のprocess.exit(1)をprocess.exit(2)に変更すること。変更後もPreToolUse Writeフックとして正常に動作すること。予期しないエラー発生時にツール実行を中断すること。

### FR-4: check-spec-sync.js修正

check-spec-sync.jsの30行目と35行目のprocess.exit(1)をprocess.exit(2)に変更すること。変更後もPostToolUse Write/Editフックとして正常に動作すること。予期しないエラー発生時にツール実行を中断すること。

### FR-5: spec-first-guard.js修正

spec-first-guard.jsの30行目、35行目、68行目、107行目のprocess.exit(1)をprocess.exit(2)に変更すること。変更後もPreToolUse Edit/Writeフックとして正常に動作すること。予期しないエラー発来時にツール実行を中断すること。グローバルエラーハンドラと制御フロー両方のexit値を統一すること。

### FR-6: spec-guard-reset.js修正

spec-guard-reset.jsの26行目と31行目のprocess.exit(1)をprocess.exit(2)に変更すること。変更後もPostToolUse Bashフックとして正常に動作すること。予期しないエラー発生時にツール実行を中断すること。

---

## 受け入れ基準

### AC-1: テスト合格

test-n4-enforce-workflow.test.tsの全8ケースが合格すること。N4-01ではTEST_EXTENSIONS定数定義がphase-definitions.jsに存在することを確認します。N4-02ではtest.ts拡張子がTEST_EXTENSIONSに含まれることを確認します。N4-03ではspec.ts拡張子がTEST_EXTENSIONSに含まれることを確認します。N4-04ではtest_impl、testing、regression_testフェーズにtest/spec拡張子が含まれることを確認します。N4-05ではmanual_test、e2e_testフェーズにtest/spec拡張子が含まれることを確認します。N4-06では実装フェーズにtestファイルが含まれないことを確認します。N4-07では既存test.ts拡張子が維持されていることを確認します。N4-08ではenforce-workflow.js内にN-4コメントが存在することを確認します。

### AC-2: exit値統一

補助フック5ファイルの全exit(1)がexit(2)に変更されていること。check-test-first.jsの2箇所、check-spec.jsの2箇所、check-spec-sync.jsの2箇所、spec-first-guard.jsの4箇所、spec-guard-reset.jsの2箇所の合計12箇所が全てexit(2)に変更されていることを確認します。グローバルエラーハンドラと制御フローの両方が対象です。

### AC-3: フック動作維持

修正後も各フックが正常に動作すること。check-test-first.jsとcheck-spec.jsはPreToolUse Writeフックとして仕様書存在確認を実行します。check-spec-sync.jsはPostToolUse Write/Editフックとして仕様書同期を実行します。spec-first-guard.jsはPreToolUse Edit/Writeフックとして仕様ファースト原則を強制します。spec-guard-reset.jsはPostToolUse Bashフックとしてリセット時の仕様書削除を防止します。予期しないエラー発生時には全フックがツール実行を中断します。

### AC-4: Fail-Closed準拠

全フックが予期しないエラー発生時にexit(2)で終了すること。ツール実行が継続されず、データ破壊のリスクが排除されていることを確認します。主要3フックと補助5フックの全てがFail-Closed原則に準拠していることを検証します。

---

## 影響範囲

### テストスクリプト

test-n4-enforce-workflow.test.tsの8箇所を修正します。テストケースの構造は変更せず、読み込み対象ファイルと検索対象コンテンツのみを変更します。他のテストスクリプトへの影響はありません。

### フックファイル

補助フック5ファイルの12箇所を修正します。check-test-first.js、check-spec.js、check-spec-sync.js、spec-first-guard.js、spec-guard-reset.jsのみが対象です。主要3フック（loop-detector、enforce-workflow、phase-edit-guard）は既に修正済みのため対象外です。fix-all.js、fix-all-n.js、lib/task-cache.jsはsettings.jsonに登録されていないため対象外です。

### ソースコード

enforce-workflow.jsとphase-definitions.jsのソースコードは変更不要です。TEST_EXTENSIONS定数は既にphase-definitions.jsに定義済みであり、各テストフェーズへの展開も完了しています。テストスクリプトの読み込み対象変更のみで問題が解決します。

### 動作影響

修正によるフック動作の変更は、予期しないエラー発生時の終了コードがexit(1)からexit(2)に変わる点のみです。正常動作時の挙動は変わりません。ブロック時のメッセージ出力も変更不要です。ユーザー操作エラー時のexit(1)はそのまま維持されます。

---

## テスト計画の概要

### ユニットテスト

test-n4-enforce-workflow.test.tsの全8ケースを実行し、全てが合格することを確認します。TEST_EXTENSIONS定数の定義確認、test/spec拡張子の包含確認、各フェーズへの拡張子展開確認、既存test.ts維持確認、N-4コメント存在確認を実施します。テストスクリプトの修正により全ケースが合格する見込みです。

### フック動作テスト

修正後のフック5ファイルについて、正常動作とエラー動作の両方をテストします。正常動作では仕様書存在時のツール実行継続、仕様書不在時の適切なブロックを確認します。エラー動作では予期しないエラー発生時のexit(2)終了を確認します。全フックがFail-Closed原則に準拠していることを検証します。

### 統合テスト

settings.jsonに登録された全10フック（主要3、補助5、その他2）が連携して正常動作することを確認します。PreToolUseフック7個とPostToolUseフック3個が適切なタイミングで実行されることを検証します。複数フックが同時にエラーを検出した場合の動作も確認します。

### リグレッションテスト

既存の全テストスイートを実行し、修正による副作用がないことを確認します。test-n1からtest-n5までのフックテスト全件を実行します。phase-definitions.jsを参照する他のモジュールへの影響がないことを検証します。exit(2)への変更がフック連携に悪影響を与えないことを確認します。
