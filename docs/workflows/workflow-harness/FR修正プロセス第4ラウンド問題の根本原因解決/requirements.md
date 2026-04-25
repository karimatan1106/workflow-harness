# requirementsフェーズ成果物

## サマリー

- 目的: ラウンド3で発生した2つの問題（performance_testバリデーション失敗とparallel_verificationでのBashブロック）の根本原因を要件として定義し、修正方針を確定する
- 主要な決定事項: FR-R4Aとして`definitions.ts`の`performance_test.subagentTemplate`に必須セクション向けガイダンスを追加し、FR-R4Bとして`bash-whitelist.js`の`verificationPhases`配列に`parallel_verification`を追加する
- 次フェーズで必要な情報: 修正対象は`workflow-plugin/mcp-server/src/phases/definitions.ts`と`workflow-plugin/hooks/bash-whitelist.js`の2ファイル。`definitions.ts`はコアモジュールのためMCPサーバー再起動が必要。フックファイルの変更はサーバー再起動不要。

---

## 背景と問題の概要

### ラウンド3で発生した問題

ラウンド3のworkflow実行において、`parallel_verification`フェーズで2つの独立した問題が発生した。

問題1は`performance_test`サブフェーズのartifact-validatorによるバリデーション失敗であり、`## ボトルネック分析`セクションの実質行数が5行未満だったことに起因する。
問題2は`parallel_verification`フェーズ実行中に`npm test`や`npx vitest`などのtestingカテゴリBashコマンドが`bash-whitelist.js`フックによりブロックされたことである。

この2つの問題は独立した根本原因を持ち、それぞれ独立した修正で解決できる。

---

## 機能要件

### FR-R4A: performance_testテンプレートへの必須セクション別ガイダンス追加

#### 対象ファイルと現状

対象ファイルは`C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`の904行目付近に定義された`performance_test`サブフェーズである。

現状の`subagentTemplate`には「## サマリー」セクション向けの5行以上ガイダンスとOK/NG例が存在するが、必須セクションとして要求される「## パフォーマンス計測結果」と「## ボトルネック分析」の両セクションに対するガイダンスが一切存在しない。

artifact-validatorは`##`見出しで区切られた各セクション内に最低5行の実質行を要求するが、subagentはガイダンスがないセクションを最小限の行数で済ませる傾向がある。この構造的問題がラウンド3の`ボトルネック分析`セクション実質行数不足（4行）を引き起こした。

#### 修正内容

`performance_test.subagentTemplate`の文字列に「## パフォーマンス計測結果」セクション向けのガイダンスを追加する。ガイダンスには計測対象・計測手法・計測値・前回比較・閾値達成状況の5項目を必須として記述するよう指示し、OK例を付記する。

「## ボトルネック分析」セクション向けのガイダンスも同様に追加する。ガイダンスには特定されたボトルネック・原因分析・影響範囲・改善提案・優先度の5項目を必須として記述するよう指示し、OK例を付記する。

各セクションのガイダンスにはNG例（コロン後にコンテンツがない行）とOK例（コロン後にコンテンツが続く行）を含めることで、実質行のカウントルールをsubagentに明示する。

#### 受け入れ基準

テンプレートに従いsubagentが生成した`performance-test.md`において、「## パフォーマンス計測結果」セクションが5行以上の実質行を含むこと。同様に「## ボトルネック分析」セクションも5行以上の実質行を含み、artifact-validatorのバリデーションを通過すること。

---

### FR-R4B: bash-whitelist.jsへのparallel_verificationフェーズ追加

#### 対象ファイルと現状

対象ファイルは`C:\ツール\Workflow\workflow-plugin\hooks\bash-whitelist.js`の213行目から定義された`getWhitelistForPhase`関数である。

現状の`verificationPhases`配列は`['security_scan', 'performance_test', 'e2e_test', 'ci_verification']`というサブフェーズ名のみを含み、親フェーズ名`parallel_verification`が含まれていない。

`phase-edit-guard.js`は`workflow-state.json`の`phase`フィールドから取得したフェーズ名を用いてBashコマンドのホワイトリストチェックを行う。`parallel_verification`フェーズ中は`phase`フィールドに親フェーズ名`parallel_verification`が格納されるため、`getWhitelistForPhase('parallel_verification')`が呼ばれる。この値は6つのフェーズグループのいずれにも一致せず、`else`ブランチが実行されて`BASH_WHITELIST.readonly`のみが返される結果、testingカテゴリコマンドがブロックされる。

#### 修正内容

`bash-whitelist.js`の`getWhitelistForPhase`関数内の`verificationPhases`配列に文字列`'parallel_verification'`を追加する。この1行の追加により、`getWhitelistForPhase('parallel_verification')`が`verificationPhases`グループに一致するようになり、既存の`[...BASH_WHITELIST.readonly, ...BASH_WHITELIST.testing, 'gh']`を返すロジックを共有できる。

修正後の`verificationPhases`配列は`['security_scan', 'performance_test', 'e2e_test', 'ci_verification', 'parallel_verification']`となる。

#### 受け入れ基準

`parallel_verification`フェーズ実行中に`npm test`、`npm run test`、`npx vitest`、`npx jest`、`npx playwright test`などのtestingカテゴリコマンドがブロックされずに実行可能となること。`gh`コマンドも同フェーズで使用可能となること。

---

## 非機能要件

### MCP サーバー再起動に関する要件

`definitions.ts`はコアモジュールと分類されており、CLAUDE.mdおよびプロジェクト規約上、変更後にMCPサーバーの再起動が必須とされている。Node.jsのモジュールキャッシュにより、ディスク上のdist/*.jsファイルを変更しても実行中のMCPサーバーには反映されないためである。

実装フェーズでは`workflow-plugin/mcp-server`ディレクトリにて`npm run build`を実行してTypeScriptをトランスパイルし、その後MCPサーバープロセスを再起動すること。再起動後に`workflow_status`を実行してフェーズが正常に継続できることを確認してから次フェーズへ進むこと。

### フック変更に関する要件

`bash-whitelist.js`はフックとして動作しており、各Bashコマンド実行リクエスト時にNodeプロセスが新たに起動して読み込まれる。そのためディスク上のファイルを変更すれば即座に次回のBashコマンド実行から新しい内容が適用される。MCPサーバーの再起動は不要である。

### 変更の影響範囲に関する要件

FR-R4Aの変更は`performance_test`サブフェーズのsubagentプロンプト生成にのみ影響する。他のサブフェーズや他のフェーズのプロンプトには影響しない。

FR-R4Bの変更は`parallel_verification`フェーズにおけるBashコマンドのホワイトリスト判定にのみ影響する。他のフェーズのホワイトリスト判定には影響しない。

### 後方互換性に関する要件

両修正は機能追加（ガイダンスの追加、フェーズ名の追加）であり、既存の動作を削除または変更しない。そのため他のフェーズやサブフェーズで使用されているテンプレートや既存のBashコマンド判定には影響しない。

---

## スコープ外事項

研究フェーズで特定された潜在的な類似問題については、今回の修正スコープには含めない。

`e2e_test`の`subagentTemplate`にもガイダンスが薄いことが確認されているが、現時点ではバリデーション失敗が報告されていないため、今回のスコープに含めない。問題が発生した場合には別途対応する。

`bash-whitelist.test.js`への追加テストケース作成については、今回のスコープに含めないことを決定した。変更が1行の文字列追加であり、既存のテストケース構造で検証可能な範囲に留まるためである。

---

## 実装優先順位

FR-R4BはFR-R4Aよりも優先度が高い。理由は、FR-R4Bが修正されない限り`parallel_verification`フェーズ全体でtestingカテゴリコマンドが使用できず、テスト系サブフェーズの実行が妨げられるためである。

FR-R4Aは`performance_test`サブフェーズのリトライ発生率に直接影響するが、リトライ自体はバリデーション通過まで繰り返されるため、FR-R4Bと比較してシステム全体への影響は限定的である。

ただし実装フェーズでは両修正を同一コミットで実施し、MCPサーバーの再起動は1回で完了できるよう効率化する。
