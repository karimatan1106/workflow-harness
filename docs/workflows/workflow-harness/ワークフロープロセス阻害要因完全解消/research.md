# 調査結果: ワークフロープロセス阻害要因完全解消

## サマリー

本調査では、前回タスク「ワークフロープロセス阻害要因解消」の実行中に新たに発見された5件のプロセス阻害要因を分析した。
最も深刻なのはN-1のscope-validatorにおけるgit octalエスケープ問題であり、日本語タスク名を使う全ワークフローでcommitフェーズへの遷移が失敗する。
N-2はphase-edit-guardのstderr未出力問題で、Fail Closedパスとbashホワイトリスト違反出力に影響がある。
N-3はテスト真正性バリデーションの200文字最低要件とフレームワーク構造必須要件が厳しすぎるという問題である。
N-4とN-5はそれぞれ.test.js未許可とset-scopeフェーズ制限で、軽微ではあるが改善すべき事項である。
修正対象は5ファイルで、ソース修正後はtscコンパイルとMCPサーバー再起動が必要になる。

## 調査結果

### N-1: scope-validator.tsの日本語パスoctalエスケープ問題（深刻度: 重大）

scope-validator.tsの行453でgit diffコマンドを実行する際、gitデフォルト設定のcore.quotePath=trueにより非ASCIIパスがoctalエスケープされる。
具体的には`docs/workflows/ワ-クフロ-/spec.md`が`\343\203\257-\343\202\257\343\203\225\343\203\255-`のように変換される。
行463-484でこの出力をスコープディレクトリのUnicode文字列とstartsWith比較するため、パスが一致せずスコープ外と判定される。
前回タスクではgit config core.quotePath falseを手動設定して回避したが、新規クローン環境では再発する。
修正方針としてはgit diffコマンドに`-c core.quotePath=false`オプションを追加する方法が最も安全である。

### N-2: phase-edit-guard.jsのstderr未出力問題（深刻度: 中程度）

D-7修正でdisplayBlockMessage系関数をconsole.errorに変更したが、それ以外のブロック箇所が未修正のまま残っている。
Bashホワイトリスト違反ブロック（行1595-1612）ではconsole.logでstdoutに出力しており、Claude Codeがstderrを参照する際にメッセージが見えない。
Fail Closedのcatchブロック（行1859-1862）ではstderrメッセージなしにprocess.exit(2)を呼ぶため、ユーザーにブロック原因が伝わらない。
stdinエラーハンドラ（行1880-1884）とJSONパースエラー（行1891-1894）も同様にメッセージ未出力でブロックする。
4箇所すべてでconsole.errorによるメッセージ出力を追加することで、ブロック原因の可視性を改善する。

### N-3: テスト出力真正性バリデーションの厳格要件（深刻度: 低〜中程度）

test-authenticity.tsのvalidateTestAuthenticity関数が、テスト出力に対して200文字以上の最小文字数制限を課している（行30-36）。
さらにTEST_OUTPUT_INDICATORSの4パターンにマッチしない出力はテスト出力として認識されない（行40-49）。
TEST_FRAMEWORK_PATTERNSの6パターンでテスト数の抽出も必須であり、カスタムテストランナーは対応が困難である。
Node.jsのassertモジュールを使用した独自テストランナーの出力形式はこれらの条件を満たしにくい。
修正方針はMIN_OUTPUT_LENGTHの100文字への削減とTEST_OUTPUT_INDICATORSへのカスタムランナー向けパターンの追加である。

### N-4: enforce-workflow.jsの.test.js未許可（深刻度: 低）

enforce-workflow.jsのPHASE_EXTENSIONS定義（行60-73）で、testing関連フェーズの許可拡張子リストに.test.jsと.spec.jsが含まれていない。
そのためNode.jsで直接実行可能なプレーンJavaScriptテストファイルの作成がブロックされる。
前回タスクでは.test.ts拡張子でTypeScript構文を含まないJSコードを記述して回避した。
この回避策は動作するが、ファイル拡張子と実際のコード内容が不一致となるため好ましくない。
5つのフェーズ（test_design、test_impl、testing、regression_test、e2e_test）に.test.jsと.spec.jsを追加すべきである。

### N-5: workflow_set_scopeのフェーズ制限（深刻度: 低）

set-scope.tsの行25-32でALLOWED_PHASESがresearch, requirements, planning, implementation, refactoring, testingの6フェーズに限定されている。
docs_updateフェーズでスコープ不足に気づいた場合、workflow_backでtestingまで戻る必要がありフロー効率が悪い。
regression_testフェーズでもリグレッションテストのために追加ファイルをスコープに含める必要が生じうる。
ALLOWED_PHASESにdocs_updateとregression_testの2フェーズを追加することで問題を解消できる。
既存のバリデーション（スコープサイズ制限、パストラバーサル対策等）は維持するため、セキュリティへの影響は最小限である。

## 既存実装の分析

### scope-validator.tsの構造（N-1関連）

scope-validator.tsはvalidateScopeChanges関数をエクスポートし、git diffの出力とスコープ設定を比較してスコープ外変更を検出する。
行444-447で.gitディレクトリの存在チェック、行449-450でサブモジュールパス取得、行453でgit diff実行という流れで処理する。
行463で改行分割してchangedFilesを生成し、行465-488のループで各ファイルのスコープ所属を判定する。
パス比較ではpath.resolveで絶対パスに変換した上でバックスラッシュをスラッシュに正規化している（行483）。
octalエスケープされたパスはpath.resolveに渡される時点で既にエスケープ文字列のままであり、正規化では解決できない。

### phase-edit-guard.jsのブロック出力構造（N-2関連）

phase-edit-guard.jsはmain関数内で複数のチェックポイントを持ち、ブロック時はEXIT_CODES.BLOCK(=2)で終了する。
displayBlockMessage、displayScopeViolationMessage等の表示関数はD-7修正でconsole.errorに変更済みである。
しかしBashホワイトリスト違反の出力（行1595-1605）は独立したconsole.logブロックであり、D-7の範囲外だった。
Fail Closedパス（行1859, 1884, 1894）はdebugLog関数を使用するが、これはDEBUG環境変数が未設定だと出力しない。
結果としてこれらのパスでブロックされた場合、ユーザーは「No stderr output」というClaude Code側のエラーメッセージのみを見ることになる。

### test-authenticity.tsのバリデーションフロー（N-3関連）

validateTestAuthenticity関数は4段階のチェックを実行する構造になっている。
第1段階で出力の最小文字数（200文字）を検証し、第2段階でTEST_OUTPUT_INDICATORSによるテスト出力らしさを判定する。
第3段階でTEST_FRAMEWORK_PATTERNSによるフレームワーク構造検出とテスト数抽出を行い、第4段階でタイムスタンプ整合性を確認する。
record-test-result.tsからの呼び出し（行274付近）でこの関数が使われ、valid=falseの場合はテスト結果の記録が拒否される。
record-test-result.ts自体にも独自のTEST_FRAMEWORK_PATTERNSがあるが、こちらは警告のみで記録はブロックしない。

### enforce-workflow.jsのPHASE_EXTENSIONS設計（N-4関連）

PHASE_EXTENSIONS定数はフェーズ名をキーとし、許可される拡張子の配列を値とするオブジェクトである。
行206-208のisAllowedExtension関数でfileName.endsWith(ext)を使い、複合拡張子（.test.ts等）に対応している。
現在の定義ではTypeScript系テストファイル（.test.ts, .test.tsx, .spec.ts, .spec.tsx）のみが許可されている。
JavaScript系テストファイル（.test.js, .spec.js等）は考慮されておらず、vitest以外のテストランナーとの互換性が不足している。
implementationフェーズは['*']で全拡張子を許可しており、テストフェーズとの非対称性が存在する。

### set-scope.tsのフェーズ制限設計（N-5関連）

ALLOWED_PHASES定数はFR-6仕様に基づき、スコープ設定が安全に実行可能な6フェーズに限定されている。
validatePhasePermission関数が現在フェーズとALLOWED_PHASESを比較し、不一致の場合はエラーメッセージを返す。
docs_updateフェーズが含まれていない理由は、ドキュメント更新時にスコープを広げる必要性が想定されなかったためと考えられる。
しかし実際にはdocs/spec/features/配下の新規仕様書作成など、事前にスコープ設定されていないファイルへの書き込みが発生しうる。
regression_testフェーズではリグレッションテスト用の新規テストファイル作成が必要になるケースがあり、同様の制限に直面する。
