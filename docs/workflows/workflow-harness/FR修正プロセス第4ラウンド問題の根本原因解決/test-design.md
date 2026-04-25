# test_designフェーズ成果物

## サマリー

- 目的: FR-R4Aとして`definitions.ts`コアモジュールの`performance_test.subagentTemplate`に必須セクション向けガイダンスを追加し、FR-R4Bとして`bash-whitelist.js`フックファイルの`verificationPhases`配列に`parallel_verification`を追加する2つの機能要件を根本原因解決するための、検証観点と手順を策定する
- 主要な決定事項: FR-R4Bのホワイトリストコマンドブロック解消は、フックファイルの特性上MCPサーバー再起動不要で即座に適用される。FR-R4Aのコアモジュール修正はnpm run buildとMCPサーバープロセス再起動が必須であり、ビルド確認テストを独立したステップとして設計した
- 変更対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`（914行目のperformance_test.subagentTemplateプロパティ）と`workflow-plugin/hooks/bash-whitelist.js`（221行目のverificationPhases配列定義行）
- 詳細実装計画との対応: spec.mdの実装計画（第1〜第3ステップ）に記載された修正方針に基づき、テストケースをステップ完了後のタイミングで実施するように設計した
- 本実装は同一コミットで両修正を同時に実施することで効率化を実現し、デプロイコストを最小化する方針を採用している
- 次フェーズで必要な情報: FR-R4Aのテスト実行前にnpm run buildとMCPサーバープロセスの再起動が必須。FR-R4Bはフックファイルのためサーバー再起動不要。既存のテストスイートが`workflow-plugin/mcp-server/src/__tests__/`に存在し、リグレッション確認として活用する
- 概要: 9ステップのテストケース（A-1〜A-3、B-1〜B-4、C-1〜C-4）を通じて、仕様書に記載された両修正の正確な実装を確認する

---

## 背景

### 問題の根本原因と解決の経緯

ラウンド3のworkflow実行でparallel_verificationフェーズにおいて、2つの独立した根本原因に由来する構造的な欠陥が問題として顕在化した。これらを解消するための詳述が本テスト設計の前提となる。

問題1の根本原因は、`definitions.ts`というコアモジュールに定義された`performance_test.subagentTemplate`が、artifact-validatorのバリデーションルールが要求する必須セクション向けガイダンスを欠いていたことである。artifact-validatorは`##`見出しで区切られた各セクション内に最低5行の実質行を要求するが、実際には4行しかなく5行に未達であった実質行数不足が確認された。ガイダンスが一切存在しない状態では「## ボトルネック分析」セクションの実質行数が4行にとどまりバリデーション失敗を引き起こした。`manual_test`や`security_scan`には既に重複行回避ガイダンスが含まれており、`performance_test`だけがこれらを欠いていたことが構造的な欠陥として特定された。

問題2の根本原因は、`bash-whitelist.js`フックファイルの`getWhitelistForPhase`関数において`verificationPhases`配列がサブフェーズ名のみを列挙しており、親フェーズ名`parallel_verification`が含まれていなかったことである。phase-edit-guardフックがtestingカテゴリBashコマンドブロックを引き起こした背後にある仕組として、`workflow-state.json`の`phase`フィールドには親フェーズ名が格納されるため、`parallel_verification`という文字列がいずれのブランチにも一致せず`else`ブランチが実行されてreadonlyのみが返された。

ラウンド3ではtestingカテゴリBashコマンドブロックによりテスト実行自体が妨げられ、リトライ発生率の低下が達成できなかった。CLAUDE.mdの「フェーズ別Bashコマンド許可カテゴリ」表でparallel_verificationの許可カテゴリとして`readonly`と`testing`が明示されており、この配列欠落はプロジェクト規約との不整合であった。

これらの問題は独立した根本原因を持つため、独立したテストケースで根本解決を確認する設計とした。

---

## テスト対象と変更種別

### FR-R4Aの変更対象と状態

FR-R4Aの変更対象箇所はソースコードファイルである`workflow-plugin/mcp-server/src/phases/definitions.ts`の変更行914行目に記述された`performance_test`サブフェーズの`subagentTemplate`プロパティの文字列値である。変更種別は文字列追加（テンプレートの拡張）であり、既存要素への変更は一切行わない設計となっている。現状として、`requiredSections`・`minLines`・`outputFile`・`allowedBashCategories`・`editableFileTypes`・`model`の各プロパティには変更を加えないことが確定している。

このコアモジュールはTypeScriptで記述されているため、修正後にnpm run buildを実行してdist/*.jsにトランスパイルし、次いでMCPサーバープロセスを再起動してからでなければ変更内容がシステムに反映されない。再起動要否の判断として、TypeScriptのコアモジュールはビルドとMCPサーバー再起動が必須であり、これを省略すると古いモジュールキャッシュが動作し続けてテンプレート変更がsubagentのプロンプト生成に反映されないリスクがある。ビルド後にdist/phases/definitions.jsの更新日時を確認して修正内容がディスクに保存されたことを検証することが必要な手順として位置づける。

### FR-R4Bの変更対象と状態

変更対象は`workflow-plugin/hooks/bash-whitelist.js`の221行目に記述された`verificationPhases`フェーズグループ配列の定義行である。変更種別は文字列要素追加（既存要素の拡張）であり、既存の4要素（`security_scan`・`performance_test`・`e2e_test`・`ci_verification`）は変更しない。変更後の配列は5要素となる。

このフックファイルはJavaScriptであり、各Bashコマンド実行リクエスト時に新たなNode.jsプロセスが起動して都度読み込まれるアーキテクチャになっている。そのためディスク上のファイルを保存した直後から、次回Bash実行時に新しい設定が即座に適用される。MCPサーバープロセスの再起動要否について言えば、フックファイルという性質上モジュールキャッシュの影響を一切受けないため再起動は不要である。

---

## テスト方針

### 検証アプローチとフェーズ別実施順序

実装優先順位に合わせてFR-R4Bを先行実施する形でテストを先行検証する。理由は、FR-R4Bが修正されない限りparallel_verificationフェーズ全体でtestingカテゴリコマンドが使用できず、テスト系サブフェーズの実行が妨げられるためである。FR-R4Bを先行実施することで、以降の実装作業中にtestingカテゴリが使用可能になり、品質確認の障壁が除去される。

テストケースを以下の3つのカテゴリに分類し、指示された実施順序に従って品質確認を進める。

- カテゴリA: FR-R4Bのホワイトリストチェック検証（フックファイルの静的確認）
- カテゴリB: FR-R4Aのテンプレート文字列内容検証（コアモジュールの静的確認とビルド確認）
- カテゴリC: 後方互換性とリグレッション確認（既存動作への影響がないことの確認）

フローチャートに記載された第1ステップ・第2ステップ・第3ステップの実装完了後に対応するテストを実施することで、最小化された変更行で最大の品質保証を達成する流れで設計している。

---

## テストケース一覧

### カテゴリA: FR-R4B ホワイトリストチェック検証

#### テストケース A-1: verificationPhases配列に`parallel_verification`が追加されていることの確認

- 変更対象: `bash-whitelist.js`の221行目の`verificationPhases`配列定義行
- リスク: 配列への追加操作で既存4要素が削除・変更されるリスクがある。また文字列のスペルミスにより`getWhitelistForPhase('parallel_verification')`のマッチが失敗するリスクがある
- 前提条件: `bash-whitelist.js`の変更がディスクに保存済みであること（フックファイルのためこれだけで即座に次回Bash実行から有効化される）
- 検証手順: Read toolで`bash-whitelist.js`の221行目付近を読み込み、`verificationPhases`配列が`['security_scan', 'performance_test', 'e2e_test', 'ci_verification', 'parallel_verification']`の5要素を含むことを確認する
- 期待結果: 配列に5番目の要素として`'parallel_verification'`が存在し、既存4要素の順序と内容が変化していない
- 注意事項: このファイルはCommonJS形式のJavaScriptであり、フックとして動作する性質上MCPサーバープロセスとは独立して即座に変更が適用される

#### テストケース A-2: `getWhitelistForPhase('parallel_verification')`のコードパス確認

- 変更対象: `bash-whitelist.js`の`getWhitelistForPhase`関数の分岐ロジック（213行目から254行目）
- リスク: `verificationPhases.includes(phase)`のチェックで`true`を返すブランチに到達しない場合、`else`ブランチが実行されて`BASH_WHITELIST.readonly`のみが返されるリスクが継続する
- 前提条件: テストケースA-1が合格済みであること
- 検証手順: Read toolで`getWhitelistForPhase`関数の実装を読み込み、231行目の`verificationPhases.includes(phase)`チェックが`true`を返した際に`[...BASH_WHITELIST.readonly, ...BASH_WHITELIST.testing, 'gh']`が返されるコードパスが存在することを確認する
- 期待結果: `parallel_verification`がverificationPhasesグループのブランチに到達し、readonlyカテゴリ・testingカテゴリ・`gh`コマンドが返り値に含まれる。これによりテスト実行自体のブロックが解消される
- 注意事項: `npm test`・`npm run test`・`npx vitest`・`npx jest`・`npx playwright test`がtestingカテゴリコマンドとして`parallel_verification`フェーズで使用可能になることを確認する

#### テストケース A-3: `else`ブランチが保持されていることの確認

- 変更対象: `bash-whitelist.js`の253行目の`else`ブランチ
- リスク: 配列への要素追加の実装中に`else`ブランチを誤って削除または変更するリスクがある
- 前提条件: テストケースA-1が合格済みであること
- 検証手順: Read toolで`getWhitelistForPhase`関数の末尾付近を読み込み、`else`ブランチが存在してreadonlyのみを返す実装が維持されていることを確認する
- 期待結果: 未知のフェーズ名が渡された場合の安全な対応が引き続き機能し、`BASH_WHITELIST.readonly`のみが返される
- 注意事項: `else`ブランチは修正前と一切変化しないことが要件であり、このブランチが削除されると未知フェーズでエラーが発生するシステム上の問題が生じる

---

### カテゴリB: FR-R4A テンプレート文字列内容検証

#### テストケース B-1: パフォーマンス計測結果セクション向けガイダンスの追加確認

- 変更対象: `definitions.ts`の`performance_test.subagentTemplate`文字列中の「## パフォーマンス計測結果」セクション向けガイダンスブロック
- リスク: ガイダンスが追加されない場合、subagentがparallel_verificationフェーズで生成するperformance-test.mdの「## パフォーマンス計測結果」セクションが5行未満の実質行数になるリスクが再発する
- 前提条件: `definitions.ts`の修正が保存済みであること（ビルド前のソースコードファイル確認でよい）
- 検証手順: Read toolで`definitions.ts`の`performance_test`サブフェーズ定義ブロックを読み込み、計測対象・計測手法・計測値（前回比較の数値を含む）・閾値達成状況・総合合否の5項目が`subagentTemplate`の文字列に含まれることを確認する
- 期待結果: 5項目の必須記載事項が`performance_test.subagentTemplate`に含まれており、OK例も付記されている
- 注意事項: ガイダンスは`## 出力`セクションの直前に挿入されていることを確認する。spec.mdの詳細仕様に記載された挿入位置（既存テンプレート文字列中の`\n\n## 出力\n${docsDir}/performance-test.md`の直前）に配置されているかを検証する

#### テストケース B-2: ボトルネック分析セクション向けガイダンスの追加確認

- 変更対象: `definitions.ts`の`performance_test.subagentTemplate`文字列中の「## ボトルネック分析」セクション向けガイダンスブロック
- リスク: このガイダンスが存在しない場合、subagentが「## ボトルネック分析」セクションを4行しか生成せずartifact-validatorの5行要件で再びバリデーション失敗が発生するリスクがある
- 前提条件: `definitions.ts`の修正が保存済みであること
- 検証手順: Read toolで`performance_test.subagentTemplate`のガイダンスブロックを読み込み、特定されたボトルネックの名称・原因分析・影響範囲・改善提案・優先度の5項目が含まれていることを確認する。加えてボトルネックが検出されない場合の記述方法も付記されていることを確認する
- 期待結果: 5項目の必須記載事項とボトルネット未検出時の記述方法ガイダンスが含まれており、subagentが参照することで実質行数5行以上を確実に生成できる内容になっている
- 注意事項: ラウンド3でボトルネット未検出時の記述量が不足した実績への対応として、この付記ガイダンスは根本解決の重要な構成要素である

#### テストケース B-3: `performance_test`サブフェーズの既存プロパティが変更されていないことの確認

- 変更対象: `definitions.ts`の`performance_test`サブフェーズ定義の`subagentTemplate`以外の全プロパティ
- リスク: コアモジュールである`definitions.ts`を編集する際に、`requiredSections`・`minLines`・`outputFile`・`allowedBashCategories`・`editableFileTypes`・`model`を意図せず変更するリスクがある
- 前提条件: `definitions.ts`の修正が保存済みであること
- 検証手順: Read toolで`definitions.ts`の`performance_test`定義ブロックを読み込み、`subagentTemplate`以外の全プロパティを確認する
- 期待結果: `requiredSections`は`['## パフォーマンス計測結果', '## ボトルネック分析']`のまま、`minLines`・`outputFile`・`model`・`allowedBashCategories`も変更なしで維持されている
- 注意事項: 追加するガイダンステキストは約1000文字程度であり、Claude Sonnetのコンテキストウィンドウに対して無視できる量であるため、コアモジュールのサイズ増加は処理能力に影響しない

#### テストケース B-4: npm run buildの成功とdist/*.jsへの反映確認

- 変更対象: `workflow-plugin/mcp-server`ディレクトリでのTypeScriptトランスパイルプロセス
- リスク: TypeScriptのコアモジュールをトランスパイルしないと、実行中のMCPサーバープロセスが古いモジュールキャッシュを使用し続け、テンプレート変更がsubagentのプロンプト生成に反映されないリスクがある
- 前提条件: `definitions.ts`の修正が保存済みかつ`npm run build`が実行済みであること
- 検証手順: Bash toolで`npm run build`の終了コードが0（成功）であることを確認する。続いてdist/phases/definitions.jsの更新日時がソースコードファイルの修正後の日時であることを確認する
- 期待結果: ビルドが成功し、dist/phases/definitions.jsの更新日時が`definitions.ts`の修正後に更新されたことが確認できる
- 注意事項: ビルドが失敗した場合はコンパイラエラーメッセージを確認し、追加したテンプレート文字列内の構文エラー（バックスラッシュのエスケープ漏れやテンプレートリテラルの閉じ忘れ等）を特定して修正してから再ビルドする。ビルド成功後もMCPサーバープロセスを再起動しなければ変更前のモジュールキャッシュが格納されたままになる点に注意が必要である

---

### カテゴリC: 後方互換性とリグレッション確認

#### テストケース C-1: `bash-whitelist.js`の他フェーズグループへの非影響確認

- 変更対象: `bash-whitelist.js`の`readonlyPhases`・`docsUpdatePhases`・`testingPhases`・`implementationPhases`・`deployPhases`・`gitPhases`の各フェーズグループ配列
- リスク: `verificationPhases`への要素追加が隣接する他グループの定義に意図せず影響するリスクがある
- 前提条件: `bash-whitelist.js`の修正が保存済みであること
- 検証手順: Read toolで`getWhitelistForPhase`関数全体を読み込み、上記6つの他グループ配列に`'parallel_verification'`が追加されていないことを確認する
- 期待結果: `readonlyPhases`・`docsUpdatePhases`・`testingPhases`・`implementationPhases`・`deployPhases`・`gitPhases`の全グループが修正前と同一の内容を維持している
- 注意事項: CLAUDE.mdの「フェーズ別Bashコマンド許可カテゴリ」表に定義された各フェーズの許可カテゴリが変化しないことが後方互換性の判断基準となる

#### テストケース C-2: `manual_test`と`security_scan`のテンプレートが変更されていないことの確認

- 変更対象: `definitions.ts`の`manual_test`と`security_scan`サブフェーズの`subagentTemplate`プロパティ
- リスク: コアモジュールである`definitions.ts`の編集中に、`performance_test`と隣接する`manual_test`や`security_scan`のサブフェーズ定義を誤って変更するリスクがある
- 前提条件: `definitions.ts`の修正が保存済みであること
- 検証手順: Read toolで`definitions.ts`の`manual_test`と`security_scan`の`subagentTemplate`ブロックを読み込み、既存の重複行回避ガイダンスが削除・変更されていないことを確認する
- 期待結果: `manual_test.subagentTemplate`と`security_scan.subagentTemplate`の内容が修正前と同一のまま維持されている
- 注意事項: `performance_test`のみに変更を加え他のサブフェーズ定義には一切変更を加えないことが設計上の制約であり、この確認はその制約が守られたことの検証である

#### テストケース C-3: MCPサーバープロセス再起動後のworkflow_status正常動作確認

- 変更対象: MCPサーバープロセス（Claude Desktopのサーバー再起動ボタンによる再起動）
- リスク: ビルドエラーや構文エラーが残存している場合、MCPサーバープロセスが正常に起動しなくなるリスクがある。また再起動しないまま次フェーズへ進むとモジュールキャッシュの影響で変更前のコードが動作し続けるリスクがある
- 前提条件: テストケースB-4が合格済みかつMCPサーバープロセスの再起動が完了済みであること
- 検証手順: MCPサーバー再起動後に`workflow_status`を実行し、現在のタスク名とフェーズ情報が正常に読み取れることを確認する
- 期待結果: `workflow_status`がタスク名・現在フェーズ・サブフェーズ情報をエラーなく返し、MCPサーバープロセスへの接続が確立されている
- 注意事項: workflow_status実行時にMCPサーバープロセスへの接続が確立されていることを確認してから次フェーズへ進むことがCLAUDE.mdの規約上の要件として定められている。この確認を省略すると次フェーズで接続エラーが発生する可能性がある

#### テストケース C-4: 既存テストスイートのリグレッション確認

- 変更対象: `workflow-plugin/mcp-server/src/__tests__/`配下の既存テストスイート全体
- リスク: コアモジュールである`definitions.ts`への変更が既存テストケースの期待値と一致しなくなるリスクがある
- 前提条件: テストケースC-3が合格済みかつMCPサーバープロセスが正常起動済みであること
- 検証手順: `npm test`または`npx jest`で既存テストスイートを実行し、全テストケースがパスすることを確認する。なお`bash-whitelist.test.js`への追加テストケース作成は今回スコープ外事項として確定しているが、既存テストが通ることは確認必須とする
- 期待結果: 既存テストスイートの全テストケースがパスし、FR-R4AおよびFR-R4Bの変更によるリグレッションが発生していない
- 注意事項: testingカテゴリコマンドの実行はtesting・parallel_verificationフェーズで許可されており、testingフェーズでこのテストケースを実施することが規約上の正当性を持つ

---

## フロー設計に基づくテスト実行順序

state-machine.mmdに記載されたステート遷移とflowchart.mmdの処理フローに基づき、テスト実行は以下の順序で行う。

### 第1ステップ完了後の検証（FR-R4B静的確認）

bash-whitelist.jsの修正完了後（第1ステップ完了後）にA-1・A-2・A-3を実施する。フックファイルはディスク上のファイルを都度読み込む動作原理を活用した即時適用が可能であり、ファイル保存後に即座に次のBash実行から適用される特性を活用して検証する。この段階ではReadツールのみを使用し、testingカテゴリのBashコマンドは不要である。phase-edit-guardフックの背後にある仕組としてgetWhitelistForPhaseが動作しており、この関数の動作原理により即時適用が実現される設計の確認を行う。

### 第2ステップ完了後の検証（FR-R4A静的確認とビルド確認）

definitions.tsの修正完了後（ビルド前）にB-1・B-2・B-3・C-2を実施する。TypeScriptソースコードをReadツールで静的確認するステップとして実施できるため、MCPサーバープロセス再起動前でも実行可能な検証である。

npm run buildの実行後にB-4を実施し、dist/*.jsファイルへのトランスパイル結果を確認する。ビルドが成功し変更内容がディスクに保存されたことを検証可能な形で確認してから第3ステップに進む。

### 第3ステップ完了後の検証（再起動後確認とリグレッション確認）

MCPサーバープロセスの再起動後にC-3を実施する。`workflow_status`の正常動作確認はサーバー再起動直後に最初に行い、その後にC-1・C-4の後方互換性確認とリグレッション確認を行う。全11件のテストケースが合格した段階で、FR-R4AおよびFR-R4Bの根本解決が完了したと判断する。

---

## スコープ外事項と今後の対応

本タスクで明示的に除外した調査・研究の対象について、認識されている潜在的な類似問題と今後の対応方針を整理する。

`e2e_test`の`subagentTemplate`にもガイダンスが薄いことが調査フェーズで確認されているが、現時点ではバリデーション失敗が発生していないため、e2e_testの類似問題の有無調査は今回スコープ外として保留とする。問題が実際に発生した場合には別途対応する方針を採用している。

`bash-whitelist.test.js`への追加テストケース作成については、今回対象の変更が1行の文字列追加であり既存テストケース構造で検証可能な範囲に留まるため、テストファイルの拡張は今回スコープ外事項として決定した。同等の検証品質を既存テストで担保できると判断した。

`manual_test`・`security_scan`などの他サブフェーズのテンプレートについて、今回対象の`performance_test`と同等のガイダンス品質を持つかの詳細調査は今回スコープ外とした。現状でバリデーション失敗が発生していない各サブフェーズは問題なしと判断し、別タスクの調査対象として保留する。

`artifact-validator.ts`が要求するセクション密度の計算ルール自体の適合性確認はスコープ外として明示的に除外した。既存のバリデーションルールは変更せず、テンプレート側でガイダンスを追加することで適合させる方針を採用している。

`testingPhases`・`implementationPhases`などのその他フェーズグループ配列の網羅性確認および他フェーズでの類似Bashブロック問題の有無調査は、今回のスコープ外事項として明示的に除外した。本タスクは`parallel_verification`フェーズのブロック問題のみを対象としており、他フェーズの問題調査は別タスクで対応する方針を確定している。

デプロイコストを最小化する観点から、両修正を同一コミットで実施するため、追加のスコープ拡張は行わないことを確認済みとする。

---

## 合否判定基準の総括

全テストケースの合否判定をまとめると以下の通りである。全テストケースを通過した場合に両方の修正が同時に有効化されたと判断する。

A-1の合格条件は`verificationPhases`配列が5要素を持ち`'parallel_verification'`が最後の要素として存在することである。
A-2の合格条件は`getWhitelistForPhase('parallel_verification')`がreadonlyカテゴリ・testingカテゴリ・`gh`の3種を返すコードパスに到達することである。
A-3の合格条件は`else`ブランチが変更なく存在し未知フェーズへの安全な対応が維持されていることである。
B-1の合格条件はパフォーマンス計測結果セクション向けの5項目ガイダンスが`performance_test.subagentTemplate`に含まれていることである。
B-2の合格条件はボトルネック分析セクション向けの5項目ガイダンスとボトルネット未検出時の付記ガイダンスが含まれていることである。
B-3の合格条件は`requiredSections`・`minLines`・`outputFile`・`allowedBashCategories`・`model`の各プロパティが修正前と同一であることである。
B-4の合格条件は`npm run build`の終了コードが0であり、dist/phases/definitions.jsの更新日時が現在時刻付近であることである。
C-1の合格条件は他の6フェーズグループ配列に`'parallel_verification'`が追加されていないことである。
C-2の合格条件は`manual_test`と`security_scan`の`subagentTemplate`が修正前と同一のまま維持されていることである。
C-3の合格条件はMCPサーバープロセスの再起動後に`workflow_status`がエラーなく現在フェーズ情報を返すことである。
C-4の合格条件は既存テストスイートの全テストケースがパスしリグレッションが発生していないことである。

全11件が合格した場合にFR-R4AおよびFR-R4Bの実装が正しく完了したと判断し、次フェーズへの遷移を許可する。デプロイコストを最小化するため同一コミットで実施する方針を採用しており、両修正が同時に有効化されることで実現される効率化の効果を確認できる。
