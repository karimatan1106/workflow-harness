# 仕様書 - 今回のワークフロー実行で発生した問題の根本原因調査と修正

## サマリー

本仕様書はFR-6・FR-7・FR-8の3件の修正を対象とし、`definitions.ts`内の3フェーズ（testing・test_impl・docs_update）のsubagentTemplateへの追記内容を具体的に定義する。

修正対象ファイルは `workflow-plugin/mcp-server/src/phases/definitions.ts` の1ファイルのみであり、変更はすべてsubagentTemplate文字列への文字列追記に限定される。フェーズロジック・HMAC整合性・状態管理コードは変更しない。

主要な決定事項として、testingフェーズのsubagentTemplateは行878（782文字のテンプレート文字列）を修正対象とし、test_implフェーズは行782（短い1行テンプレート）を修正対象とし、docs_updateフェーズは行953（最も簡素なテンプレート）を修正対象とする。

次フェーズ（test_design）では本仕様書に基づいてテスト設計を行い、test_implフェーズで各フェーズのsubagentTemplateが正しく更新されているかを検証するテストコードを作成する。実装は`implementationフェーズ`で行い、修正後に`npm run build`と`MCPサーバー再起動`が必須手順となる。

3件の修正はいずれもサブエージェントへの指示内容の改善であり、既存のバリデーションロジック・フェーズ遷移ロジック・HMAC検証コードには一切影響を与えない。

## 概要

本タスクでは、過去のワークフロー実行中に発生した3種類の問題を根本から解決するため、`definitions.ts`のsubagentTemplateを修正する。

FR-6はtestingフェーズで`workflow_capture_baseline`が呼び出されないまま`regression_test`フェーズに進み、ベースライン未設定エラーが発生した問題を対象とする。原因はtestingフェーズのsubagentTemplateに`workflow_capture_baseline`の呼び出し指示が欠落していたことであり、修正によりサブエージェントがベースライン記録を必須手順として認識できるようにする。

FR-7はtest_implフェーズでテストファイルの出力先ディレクトリが不明確であり、サブエージェントが誤ったパスにテストファイルを配置した問題を対象とする。原因はtest_implのsubagentTemplateが「テストコードを実装してください（TDD Red）。」の1行しか持たず、出力先・登録手順のいずれも記載がなかったことであり、修正により具体的なディレクトリパスと`workflow_record_test`の呼び出し手順を提供する。

FR-8はdocs_updateフェーズでサブエージェントが`MEMORY.md`や`.claude/state/`配下のファイルを誤って編集しようとした問題を対象とする。原因はdocs_updateのsubagentTemplateに更新禁止ファイルの明示がなく、サブエージェントが編集可能ファイルの範囲を判断できなかったことであり、修正により更新許可ファイルと禁止ファイルの両リストを提供する。

3件の修正は同一ファイル（`definitions.ts`）への文字列追記のみであるため、1回のビルドとMCPサーバー再起動で全修正が反映される。

## 変更対象ファイル

修正対象ファイルは1件のみであり、`workflow-plugin/mcp-server/src/phases/definitions.ts`である。

このファイルはMCPサーバーの全フェーズ定義（フェーズ名・allowedBashCategories・editableFileTypes・subagentTemplate等）を集約したコアモジュールであり、プロジェクト内で最も変更頻度が高いファイルの1つである。変更内容はtesting・test_impl・docs_updateの3フェーズの`subagentTemplate`文字列への追記のみであり、他のプロパティ（`phaseName`・`allowedBashCategories`・`editableFileTypes`・`minLines`等）は変更しない。

ビルド成果物として`workflow-plugin/mcp-server/dist/phases/definitions.js`が更新される。このdist配下のファイルは`npm run build`実行後に生成される中間ファイルであり、直接編集してはならない。

テストファイルとして既存の`workflow-plugin/mcp-server/src/phases/__tests__/definitions.test.ts`が変更の影響を受ける可能性があるため、修正後に同テストファイルを実行して回帰確認を行う。新規テストファイルを追加する場合は`workflow-plugin/mcp-server/src/phases/__tests__/`配下に配置する。

変更後にMCPサーバーの再起動が必須であることに注意する。Node.jsのモジュールキャッシュにより、`dist/*.js`を書き換えてもプロセスを再起動しない限り変更が反映されない。

## 実装計画

実装は3ステップ（FR-6・FR-7・FR-8の順）で行い、各ステップが完了したことを確認してから次のステップに進む。

第1ステップはFR-6（testingフェーズのsubagentTemplate修正）であり、`definitions.ts`の行878付近の`testing`フェーズ定義を読み込み、`## workflow_record_test_result 呼び出し時の注意`セクションの直後に`## workflow_capture_baseline 呼び出し（ベースライン記録）`セクションを追記する。追記内容は呼び出し義務・4パラメータの説明・テスト出力からの数値抽出方法・遷移ブロック警告・記録結果の活用案内の5項目である。

第2ステップはFR-7（test_implフェーズのsubagentTemplate修正）であり、`definitions.ts`の行782付近の`test_impl`フェーズ定義を読み込み、現在の1行指示の末尾に4セクションを追記する。追記内容はテストファイルの出力先（このプロジェクト固有の`__tests__`ディレクトリ構造）・`workflow_record_test`の呼び出し手順・手動確認手順のみの場合の取り扱い・ワークフロー制御ツール禁止の4セクションである。

第3ステップはFR-8（docs_updateフェーズのsubagentTemplate修正）であり、`definitions.ts`の行953付近の`docs_update`フェーズ定義を読み込み、現在の1行指示の末尾に4セクションを追記する。追記内容は更新対象ドキュメント（許可リスト）・更新禁止ファイル（禁止リスト）・更新対象が存在しない場合の取り扱い・ワークフロー制御ツール禁止の4セクションである。

3つの修正が完了したら`workflow-plugin/mcp-server`ディレクトリで`npm run build`を実行してビルドを確認し、既存テストスイートを実行して回帰確認を行う。最後にMCPサーバーを再起動して修正を反映する。


## FR-6 実装計画

### 修正対象の特定

修正対象は`definitions.ts`の行878に定義されている`testing`フェーズの`subagentTemplate`プロパティである。現在のテンプレートは`workflow_record_test_result`の呼び出し手順・sessionTokenの使用制限・ワークフロー制御ツール禁止の3セクションで構成されており、`workflow_capture_baseline`への言及が全く存在しない。

### 追記内容の詳細

テンプレート末尾（`ワークフロー制御ツール禁止`セクションの前）に以下のセクションを追記する。追記位置は`## workflow_record_test_result 呼び出し時の注意`セクションの直後かつ`## sessionTokenの取得方法`セクションの前とする。

追記セクションの名称は`## workflow_capture_baseline 呼び出し（ベースライン記録）`とし、以下の5項目を含める。

最初の項目は「テスト実行後、まず`workflow_capture_baseline`を呼び出してベースラインを記録すること。この呼び出しはworkflow_record_test_resultより先に行うことを推奨する。」という呼び出し義務の明示である。

2番目の項目はパラメータの説明であり、taskIdはOrchestratorからプロンプト引数として渡されるタスクID文字列、totalTestsはテストコマンドの集計行から読み取った総テスト数（整数値）、passedTestsは成功したテスト数（整数値）、failedTestsは失敗したテスト名の配列（文字列配列）という4パラメータを明示する。

3番目の項目はテスト出力からの数値抽出方法の説明であり、「vitestが出力する集計行の例: `Tests: 12 passed (12)` → totalTests: 12, passedTests: 12, failedTests: 空配列」という具体例を含める。

4番目の項目は警告であり、「ベースライン記録を省略した場合、regression_testフェーズへの遷移時に`ベースラインが記録されていません`エラーが発生してフェーズ遷移がブロックされる（forceTransition: trueを指定することでスキップ可能だが省略は推奨しない）」という遷移ブロックの警告を含める。

5番目の項目はcaptureBaselineと記録結果の取り扱いであり、「成功時のレスポンスにはbaseline.totalTests・baseline.passedTests・baseline.failedTestsが含まれる。この値をテスト結果レポートに記録することを推奨する。」という記録活用の案内を含める。

### 後方互換性の確保

既存の`workflow_record_test_result`に関する指示（output引数の100文字以上要件・加工禁止・集計行の形式例）は一切変更しない。既存のsessionToken制限セクションとワークフロー制御ツール禁止セクションも変更しない。追記は既存コンテンツの後半ではなく中間（workflow_record_test_resultセクションの直後）に挿入するため、既存の指示との整合性を確認すること。


## FR-7 実装計画

### 修正対象の特定

修正対象は`definitions.ts`の行782に定義されている`test_impl`フェーズの`subagentTemplate`プロパティである。現在のテンプレートは以下の3セクションしか含まない極めて簡素な内容である。

現在の内容（行782）: `# test_implフェーズ\n\n## タスク情報\n- ユーザーの意図: ${userIntent}\n- 出力先: ${docsDir}/\n\n## 入力\n${docsDir}/test-design.md を読み込んでください。\n\n## 作業内容\nテストコードを実装してください（TDD Red）。`

このテンプレートには出力先ディレクトリの指定も`workflow_record_test`の呼び出し手順も存在しない。他のフェーズ（testing・regression_test）が詳細なテンプレートを持つのに対し、test_implのみが1行の作業指示しか持たない構造的欠陥がある。

### 追記内容の詳細

現在の`## 作業内容`セクションを以下の内容に拡充する。既存の「テストコードを実装してください（TDD Red）。」は最初の行として維持し、その後に追記する。

追記する最初のセクションは`## テストファイルの出力先`であり、このプロジェクトのテストディレクトリは`workflow-plugin/mcp-server/src/`配下の各モジュールディレクトリ（例: `workflow-plugin/mcp-server/src/phases/__tests__/`・`workflow-plugin/mcp-server/src/tools/__tests__/`・`workflow-plugin/mcp-server/src/validation/__tests__/`）であることを明示する。プロジェクト標準外の配置（ルートディレクトリ直下・`docs/workflows/`配下）は禁止であることを明記する。

追記する2番目のセクションは`## workflow_record_test の呼び出し手順`であり、テストファイルを作成した後に`workflow_record_test`を呼び出してパスを登録することを必須手順として明示する。パラメータはtaskId（プロンプト引数から取得）とtestFile（作成したテストファイルの絶対パスまたはリポジトリルートからの相対パス）の2つを説明する。登録の目的はtestingフェーズおよびregression_testフェーズでのテスト実行対象として記録するためであることを説明する。

追記する3番目のセクションは`## 手動確認手順のみの場合の取り扱い`であり、test-design.mdがコードレベルのテストケースを定義していない場合（GrepやReadツールによる確認手順のみを記述している場合）の対処方法を説明する。この場合はテストファイルを作成せず、代わりに「コードレベルのテストが存在しない根拠」を成果物（フェーズ完了の記録）として残すことを説明する。

追記する4番目のセクションは`## ★ワークフロー制御ツール禁止★`であり、testingフェーズおよびregression_testフェーズのテンプレートと同様に、workflow_next・workflow_approve等の禁止ツールリストを記載する。test_implのsubagentの責任範囲はテストファイル作成とworkflow_record_test登録のみであることを明示する。

### テストディレクトリ選択のガイダンス

このプロジェクトの実際のテストディレクトリ構造（`workflow-plugin/mcp-server/src/phases/__tests__/`・`workflow-plugin/mcp-server/src/tools/__tests__/`・`workflow-plugin/mcp-server/src/validation/__tests__/`・`workflow-plugin/mcp-server/src/__tests__/`等）を参照した具体的なガイダンスをテンプレートに含める。汎用的な「src/backend/tests/」という表記ではなく、このプロジェクト固有のディレクトリ構造（`__tests__`サブディレクトリ方式）を案内することで、サブエージェントが適切なパスにテストファイルを配置できるようにする。


## FR-8 実装計画

### 修正対象の特定

修正対象は`definitions.ts`の行953に定義されている`docs_update`フェーズの`subagentTemplate`プロパティである。現在のテンプレートは全フェーズ中で最も簡素な内容であり、作業内容の指示が「ドキュメントを更新してください。」の1行しか含まない。

現在の内容（行953）: `# docs_updateフェーズ\n\n## タスク情報\n- ユーザーの意図: ${userIntent}\n- 出力先: ${docsDir}/\n\n## 作業内容\nドキュメントを更新してください。`

この指示では「どのファイルを更新してよいか」という範囲も「どのファイルを更新してはいけないか」という禁止事項も一切定義されていない。この曖昧さがMEMORY.mdへの誤書き込みや`.claude/state/`配下の誤編集を誘発する根本原因である。

### 追記内容の詳細

`## 作業内容`セクションの既存の1行指示を維持したまま、以下の4つのセクションを追記する。

追記する最初のセクションは`## 更新対象ドキュメント（永続ファイル）`であり、更新が許可されている永続ドキュメントの範囲を明示する。許可対象は「`docs/spec/`配下（機能仕様書・画面仕様書・API仕様書・コンポーネント仕様書）」「`docs/architecture/`配下（システム概要・モジュール設計・ADR）」「`docs/operations/`配下（デプロイ手順・環境定義・監視設計）」「プロジェクトルートの`CHANGELOG.md`（変更履歴）」「プロジェクトルートの`README.md`（更新が必要な場合のみ）」の5カテゴリである。このフェーズの目的は「実装・テスト完了後に、実装内容を永続ドキュメントに反映すること」であることを明示する。

追記する2番目のセクションは`## 更新禁止ファイル`であり、以下の3カテゴリを禁止対象として明示する。最初の禁止カテゴリは`docs/workflows/{taskName}/`配下の全ファイルであり、これらは一時的な作業フォルダであり`.gitignore`対象であることを理由として説明する。2番目の禁止カテゴリは`MEMORY.md`（またはシステムが管理するメモリファイル）であり、このファイルはClaude Desktopのプロジェクトメモリ機能が管理するシステムファイルであり、docs_updateフェーズでの直接編集対象外であることを説明する。3番目の禁止カテゴリは`.claude/state/`配下の全ファイルであり、これらはHMAC整合性チェックが設定されているため直接編集するとワークフロー全体が動作不能になることを警告として含める。

追記する3番目のセクションは`## 更新対象が存在しない場合の取り扱い`であり、永続ドキュメントに反映すべき実装変更が存在しない場合（例: テンプレート文字列のみの変更でAPIや画面に変化がない場合）は「更新対象となる永続ドキュメントが存在しない」とその理由を報告してフェーズを完了することを説明する。このケースではドキュメント更新を行わずにフェーズを完了することが正しい動作であることを明示する。

追記する4番目のセクションは`## ★ワークフロー制御ツール禁止★`であり、docs_updateサブエージェントの責任範囲はdocs/spec/配下等の永続ドキュメントの更新のみであり、フェーズ遷移の制御はOrchestratorの専権事項であることを明示する。


## 実装手順

### 手順1: testingフェーズのsubagentTemplate修正（行878）

`definitions.ts`の行878に定義されている`subagentTemplate`文字列の内部に`## workflow_capture_baseline 呼び出し（ベースライン記録）`セクションを追記する。追記位置は`## workflow_record_test_result 呼び出し時の注意`セクションの末尾と`## sessionTokenの取得方法と使用制限`セクションの先頭の間（`\n\n`区切り）とする。

追記する文字列（改行は`\n`で表現）の内容は上記「FR-6追記内容の詳細」に記載の5項目を含む1ブロックであり、末尾に`\n\n`を付けて既存の次セクションと区切る。

### 手順2: test_implフェーズのsubagentTemplate修正（行782）

`definitions.ts`の行782に定義されている`subagentTemplate`文字列の末尾（現在は「テストコードを実装してください（TDD Red）。」で終わる）に、FR-7で定義した4セクションを追記する。既存のテンプレート末尾の引用符の前に`\n\n`区切りで追記する。

追記する文字列は`## テストファイルの出力先`・`## workflow_record_test の呼び出し手順`・`## 手動確認手順のみの場合の取り扱い`・`## ★ワークフロー制御ツール禁止★`の4セクションを含む。

### 手順3: docs_updateフェーズのsubagentTemplate修正（行953）

`definitions.ts`の行953に定義されている`subagentTemplate`文字列の末尾（現在は「ドキュメントを更新してください。」で終わる）に、FR-8で定義した4セクションを追記する。

追記する文字列は`## 更新対象ドキュメント（永続ファイル）`・`## 更新禁止ファイル`・`## 更新対象が存在しない場合の取り扱い`・`## ★ワークフロー制御ツール禁止★`の4セクションを含む。

### 手順4: ビルドとMCPサーバー再起動

3つの修正が完了したら以下の4ステップを順番に実施する。第1ステップはカレントディレクトリを`workflow-plugin/mcp-server`に移動して`npm run build`を実行し、TypeScriptをJavaScriptにトランスパイルする。第2ステップは`dist/phases/definitions.js`の更新日時を確認し、ビルドが成功したことを検証する。第3ステップはClaude DesktopのMCPサーバー再起動ボタンまたはプロセス終了コマンドでMCPサーバーを再起動する。第4ステップは再起動後に`workflow_status`を実行して現在のフェーズを確認し、同フェーズから作業を再開する。この再起動を省略すると変更前のキャッシュ版が動作し続けるため、修正効果がゼロになる点に注意する。


## 検証方法

### 静的検証（変更ファイルの内容確認）

実装後にReadツールで`definitions.ts`の行782・行878・行953を読み込み、以下の3点を確認する。

行782（test_impl）の検証では`## テストファイルの出力先`と`## workflow_record_test の呼び出し手順`と`## 手動確認手順のみの場合の取り扱い`の3セクションが追記されていることを確認する。

行878（testing）の検証では`## workflow_capture_baseline 呼び出し（ベースライン記録）`セクションが追記されていることと、そのセクション内にtaskId・totalTests・passedTests・failedTestsの4パラメータの説明が含まれていることを確認する。

行953（docs_update）の検証では`## 更新対象ドキュメント（永続ファイル）`と`## 更新禁止ファイル`と`## 更新対象が存在しない場合の取り扱い`の3セクションが追記されていることを確認する。

### テストスイートによる回帰確認

実装後に`workflow-plugin/mcp-server`ディレクトリで既存のテストスイートを実行し、全テストがパスすることを確認する。特に以下のテストファイルへの影響を確認する。

`workflow-plugin/mcp-server/src/phases/__tests__/definitions.test.ts`（フェーズ定義の構造テスト）への影響確認では、testing・test_impl・docs_updateフェーズの`phaseName`・`allowedBashCategories`・`editableFileTypes`等のプロパティが変更されていないことを検証する。

`workflow-plugin/mcp-server/src/tools/__tests__/next-artifact-check.test.ts`（フェーズ遷移テスト）への影響確認では、testingフェーズからregression_testフェーズへの遷移時のベースライン確認ロジックが変更されていないことを検証する。

### 動作確認（実際のサブエージェント起動による検証）

MCPサーバー再起動後に`workflow_status`でsubagentTemplateが返されることを確認し、testingフェーズのテンプレートに`workflow_capture_baseline`の呼び出し手順が含まれていることを目視確認する。同様にtest_implフェーズのテンプレートにworkflow_record_testの呼び出し手順が、docs_updateフェーズのテンプレートに更新禁止ファイルリストが含まれていることを確認する。この目視確認をもって3件の修正が正常に適用されたと判断できる。
