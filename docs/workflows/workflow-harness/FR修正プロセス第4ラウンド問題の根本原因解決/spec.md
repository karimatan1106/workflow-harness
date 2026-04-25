# planningフェーズ成果物

## サマリー

- 目的: ラウンド3で発生した2つの問題（performance_testバリデーション失敗とparallel_verificationでのBashコマンドブロック）を根本から解決するための詳細実装計画を策定する
- 主要な決定事項: 機能要件FR-R4Aとして`workflow-plugin/mcp-server/src/phases/definitions.ts`の914行目にある`performance_test.subagentTemplate`文字列を拡張し、必須セクション向けガイダンスを追加する。機能要件FR-R4Bとして`workflow-plugin/hooks/bash-whitelist.js`の221行目にあるフェーズグループの`verificationPhases`配列に`'parallel_verification'`を追加する
- 修正方針: 両修正とも機能追加のみであり、既存動作を削除しない低リスク変更として確定した
- 影響範囲のスコープ: FR-R4AはperformanceTestサブフェーズのsubagentプロンプト生成のみに影響し、FR-R4Bはparallel_verificationフェーズのBashホワイトリストチェックのみに影響するスコープとして確定している
- 次フェーズで必要な情報: `definitions.ts`はコアモジュールのためnpm run build後にMCPサーバー再起動が必須。フックファイルとして動作する`bash-whitelist.js`は各Bash実行時に都度読み込まれるため、ディスク上のファイルを変更すれば即座に適用され再起動不要。両修正は同一コミットで実施することで効率化できる

---

## 概要

ラウンド3のworkflow実行において、`parallel_verification`フェーズで2つの独立した問題が発生した。
この仕様書は、その2つの問題を根本から解消するための実装計画を詳述する。

問題1は`performance_test`サブフェーズのartifact-validatorによるバリデーション失敗であり、`## ボトルネック分析`セクションの実質行数不足（実際には4行しかなく5行に未達）が根本原因として特定された。
artifact-validatorは`##`見出しで区切られた各セクション内に最低5行の実質行を要求するが、`performance_test`の`subagentTemplate`には該当セクション向けのガイダンスが一切存在していなかった。
他のサブフェーズ（`manual_test`や`security_scan`）には重複行回避や実質行数不足を防ぐガイダンスが含まれているにもかかわらず、`performance_test`だけが欠落していたことが構造的な欠陥として特定された。
この欠落により、subagentはガイダンスなしで最小限の行数で済ませる傾向に従い、5行未満の実質行数しか生成しなかったと分析している。

問題2は`parallel_verification`フェーズ実行中に`npm test`や`npx vitest`などのtestingカテゴリBashコマンドがphase-edit-guardフックの背後にある`bash-whitelist.js`フックファイルによりブロックされたことである。
phase-edit-guardは`workflow-state.json`の`phase`フィールドから現在のフェーズ名を取得し、`getWhitelistForPhase`関数によるホワイトリストチェックに渡す仕組みになっている。
`getWhitelistForPhase`関数の`verificationPhases`フェーズグループ配列には`security_scan`、`performance_test`、`e2e_test`、`ci_verification`のサブフェーズ名のみが含まれており、親フェーズ名の`parallel_verification`が含まれていなかった。
`workflow-state.json`の`phase`フィールドには親フェーズ名が格納されるため、`parallel_verification`という文字列がいずれのブランチにも一致せずに`else`ブランチへ落ち、readonlyのみが返される結果となっていた。

---

## 実装計画

### 第1ステップ: FR-R4B（bash-whitelist.js修正）を先行実施

修正対象はフックファイルである`workflow-plugin/hooks/bash-whitelist.js`である。
変更内容は221行目の`verificationPhases`配列への文字列`'parallel_verification'`の追加という1行の変更であり、本プロジェクトのスコープ内で最小限の修正内容となっている。
このファイルはフックファイルとして動作し、各Bashコマンド実行リクエスト時に新たなNodeプロセスが起動して読み込まれるアーキテクチャになっている。
ディスク上のファイルを保存した後、次のBashコマンド実行から即座に新しい設定が適用されるため、MCPサーバーの再起動は不要であり、Node.jsのモジュールキャッシュの影響を受けない。
FR-R4Bを先に適用することで、以降のステップ中にtestingカテゴリコマンドが使用可能となり、実装作業の妨げがなくなる。
この修正によってホワイトリストチェックが正しく`verificationPhases`グループにマッチするようになり、parallel_verificationフェーズでのリトライ発生率も低下することが期待される。

### 第2ステップ: FR-R4A（definitions.ts修正）を実施

修正対象は`workflow-plugin/mcp-server/src/phases/definitions.ts`である。
変更内容は914行目のperformance_test.subagentTemplateプロパティの文字列に、「## パフォーマンス計測結果」セクション向けガイダンスと「## ボトルネック分析」セクション向けガイダンスを追加することである。
「## パフォーマンス計測結果」セクション向けのガイダンスには、計測対象・計測手法・計測値・前回比較・閾値達成状況の5項目を必須として記述するよう指示する。
「## ボトルネック分析」セクション向けのガイダンスには、特定されたボトルネックの名称・原因分析・影響範囲・改善提案・優先度の5項目を必須として記述するよう指示し、付記としてOK例も含める。
変更後は`workflow-plugin/mcp-server`ディレクトリで`npm run build`を実行してTypeScriptをdist/*.jsにトランスパイルする。
ディスク上のdist/*.jsファイルが更新されただけでは実行中のMCPサーバーには反映されない点に注意が必要であり、Node.jsのモジュールキャッシュにより変更が取得されないためである。
したがって、ビルド後には第3ステップのMCPサーバー再起動が必須となる。

### 第3ステップ: MCPサーバーの再起動と確認

`npm run build`完了後、MCPサーバープロセスをClaude Desktopのサーバー再起動ボタンで再起動する。
再起動後に`workflow_status`を実行して現在のフェーズが正常に読み取れることを確認する。
両修正を同一コミットで実施することで、MCPサーバーの再起動が1回で完了し、デプロイコストを最小化できる効率化が達成できる。

---

## 変更対象ファイル

本タスクで変更する修正対象のソースコードファイルは以下の2ファイルである。

**ファイル1: `workflow-plugin/mcp-server/src/phases/definitions.ts`**
- 変更行: 914行目（`performance_test.subagentTemplate`プロパティ値）
- 変更種別: 文字列内への2ガイダンスブロック追記（既存テキストは変更しない）
- ビルド要否: 変更後に`npm run build`が必要（TypeScriptのコアモジュールのため）
- MCPサーバー再起動要否: `npm run build`完了後に再起動が必要（モジュールキャッシュの性質上）
- 背景: performance_testの`subagentTemplate`が実質行数不足を防ぐ修正内容を持たないため、ラウンド3で失敗した

**ファイル2: `workflow-plugin/hooks/bash-whitelist.js`**
- 変更行: 221行目（`verificationPhases`配列定義行）
- 変更種別: 配列への文字列要素`'parallel_verification'`の追加（既存要素は変更しない）
- ビルド要否: JavaScriptのフックファイルのため不要
- MCPサーバー再起動要否: ディスク上のファイル変更が即座に次回Bash実行から反映されるため不要
- 背景: verificationPhasesフェーズグループに`parallel_verification`が存在しないため、phase-edit-guardがホワイトリストチェックでブロックしていた

関連するテストファイルとして`workflow-plugin/mcp-server/src/__tests__/`配下のテストスイートが存在するが、今回の変更はテンプレート文字列の拡張と配列への要素追加のみであり、既存のテストケース構造で検証可能な範囲に留まるため、今回のスコープには含めないことを確定している。

---

## FR-R4A詳細仕様

### 変更対象箇所の特定

`workflow-plugin/mcp-server/src/phases/definitions.ts`の904行目から914行目に`performance_test`サブフェーズの定義が記述されている。
現在の`subagentTemplate`（914行目）は「## サマリー」セクション向けの行数ガイダンスのみを含み、必須セクションである「## パフォーマンス計測結果」と「## ボトルネック分析」の各セクションに対するガイダンスが全く存在しない修正対象の状態となっている。

比較すると`manual_test`サブフェーズの`subagentTemplate`には「## 重複行回避の注意事項」ブロックが存在し、`security_scan`サブフェーズにも同様のブロックが含まれているが、`performance_test`だけがこれらのガイダンスを欠いていたことが実質行数不足の根本原因である。
この傾向は、ガイダンスのないセクションをsubagentが最小限の行数で記述してしまうシステムとしての特性に由来しており、テンプレートを修正することが唯一の根本解決策である。

### 追加するガイダンスの挿入位置と修正内容

既存テンプレート文字列中の`\n\n## 出力\n${docsDir}/performance-test.md`の直前に2つのガイダンスブロックを挿入する。
第1ブロックは「## パフォーマンス計測結果セクションの行数ガイダンス」として、計測対象・計測手法・計測値（前回比較の数値を含む）・閾値達成状況・総合合否の5項目を必須記載事項として列挙する。
第2ブロックは「## ボトルネック分析セクションの行数ガイダンス」として、特定されたボトルネックの名称・原因分析の説明・影響範囲の評価・改善提案の具体案・優先度の判定の5項目を必須記載事項として列挙し、ボトルネックが検出されない場合の記述方法も付記する。

---

## FR-R4B詳細仕様

### 変更対象箇所の特定

`workflow-plugin/hooks/bash-whitelist.js`の213行目から254行目に`getWhitelistForPhase`関数が定義されている。
221行目の`verificationPhases`フェーズグループ配列は現在`['security_scan', 'performance_test', 'e2e_test', 'ci_verification']`の4要素を含む。
phase-edit-guardフックが`workflow-state.json`の`phase`フィールドから取得したフェーズ名を`getWhitelistForPhase`に渡してホワイトリストチェックを実行するが、`parallel_verification`フェーズ中は親フェーズ名`parallel_verification`が`phase`フィールドに格納される。
`getWhitelistForPhase('parallel_verification')`を呼ぶと231行目の`verificationPhases.includes(phase)`チェックで`false`となり、253行目の`else`ブランチで`BASH_WHITELIST.readonly`のみが返される。

### 変更後の配列と効果

変更後の`verificationPhases`フェーズグループ配列は`['security_scan', 'performance_test', 'e2e_test', 'ci_verification', 'parallel_verification']`の5要素となる。
この変更により`getWhitelistForPhase('parallel_verification')`が`verificationPhases.includes(phase)`チェックで`true`を返すようになり、`[...BASH_WHITELIST.readonly, ...BASH_WHITELIST.testing, 'gh']`が返されるようになる。
フックファイルはディスク上のファイル変更が即座に次回実行から反映されるため、MCPサーバーの再起動なしで変更が有効となることが確認済みである。
CLAUDE.mdの「フェーズ別Bashコマンド許可カテゴリ」表でparallel_verificationの許可カテゴリとして`readonly`と`testing`が明示されており、この変更はプロジェクト規約上も正当性のある修正内容である。

---

## 後方互換性の確認

FR-R4Aの変更はsubagentに渡すプロンプト文字列の末尾付近にガイダンスを追加するものであり、後方互換性への影響は以下のように確認された。
`requiredSections`プロパティは変更しないため、artifact-validatorが要求する必須セクション名（`## パフォーマンス計測結果`と`## ボトルネック分析`）は変わらない。
`minLines`・`outputFile`・`allowedBashCategories`・`editableFileTypes`・`model`の各プロパティも変更しないため、フェーズ遷移ロジックやバリデーション閾値は影響を受けない。
追加テキストは約1000文字程度であり、Claude Sonnetのコンテキストウィンドウに対して無視できる量であるため、subagentの処理能力に影響しない。

FR-R4Bの変更は`verificationPhases`フェーズグループ配列に要素を追加するものであり、以下の観点から後方互換性を確認した。
既存の4要素（`security_scan`、`performance_test`、`e2e_test`、`ci_verification`）の動作は一切変化しない。
`readonlyPhases`、`docsUpdatePhases`、`testingPhases`、`implementationPhases`、`deployPhases`、`gitPhases`の各フェーズグループ配列も変更しないため、他フェーズのホワイトリストチェック結果は変化しない。
`else`ブランチは変更後も存在するため、未知のフェーズ名への対応は引き続き機能する。
両修正を同一コミットで実施することで、MCPサーバーの再起動が1回で完了し、プロジェクト全体のデプロイコストを効率化できる。

---

## スコープ外事項

今回のスコープに含めない項目を以下に示す。

`e2e_test`の`subagentTemplate`にもガイダンスが薄いことが調査・研究フェーズで確認されているが、現時点ではバリデーション失敗が発生していないため、本タスクの修正スコープには含めない方針を確定した。潜在的な類似問題として認識しており、問題が実際に発生した場合には別途対応する。

`bash-whitelist.test.js`への追加テストケース作成については、今回のスコープ外事項として決定した。変更が1行の文字列追加であり、既存のテストケース構造で検証可能な範囲に留まるためである。

`manual_test`・`security_scan`などの他サブフェーズのテンプレートについて、今回対象の`performance_test`と同等のガイダンス品質を持つかの詳細調査は今回スコープ外とした。現状でバリデーション失敗が発生していない各サブフェーズは問題なしと判断し、別タスクの調査対象として保留する。

`artifact-validator.ts`が要求するセクション密度の計算ロジックや実質行の定義ルールそのものの変更については、今回スコープ外事項として確定した。既存のバリデーションルールは変更せず、テンプレート側でガイダンスを追加することで適合させる方針を採用している。

`testingPhases`・`implementationPhases`などのその他フェーズグループ配列の網羅性確認および他フェーズでの類似Bashブロック問題の有無調査は、今回のスコープ外事項として明示的に除外した。本タスクは`parallel_verification`フェーズのブロック問題のみを対象としており、他フェーズの問題調査は別タスクで対応する。

---

## 実装優先順位と手順

FR-R4Bは機能要件としてFR-R4Aよりも優先度が高い。理由は、FR-R4Bが修正されない限りシステム全体の`parallel_verification`フェーズでtestingカテゴリコマンドが使用できず、テスト系サブフェーズの実行自体が妨げられるためである。
FR-R4Aは`performance_test`サブフェーズのリトライ発生率に直接影響するが、リトライ自体はバリデーション通過まで繰り返されるため、FR-R4Bと比較してシステム全体への影響は限定的であると分析している。

本実装は以下の順序で実施する。

第1ステップとして`workflow-plugin/hooks/bash-whitelist.js`の221行目を変更し、`verificationPhases`フェーズグループ配列に`'parallel_verification'`を追加する。
この変更はファイル保存後に即座に有効となるため、次のBash実行から適用される。phase-edit-guardフックがディスク上のファイルを都度読み込む動作原理を活用した即時適用である。

第2ステップとして`workflow-plugin/mcp-server/src/phases/definitions.ts`の914行目を変更し、`performance_test.subagentTemplate`にガイダンスブロックを追記する。
変更後は`workflow-plugin/mcp-server`ディレクトリで`npm run build`を実行してTypeScriptのコアモジュールをトランスパイルし、dist/*.jsの更新日時を確認して修正内容がディスクに反映されたことを検証可能な形で確認する。

第3ステップとしてMCPサーバープロセスを再起動し、`workflow_status`で正常起動を確認してから次フェーズへ進む。
両修正を同一コミットで実施することでMCPサーバー再起動1回で両方の機能要件が同時に有効化されるため、実装の効率化が実現できる。
