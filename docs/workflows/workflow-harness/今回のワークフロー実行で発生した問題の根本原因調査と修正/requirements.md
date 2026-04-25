# 要件定義書 - 今回のワークフロー実行で発生した問題の根本原因調査と修正

## サマリー

本要件定義は、直近のワークフロー実行（タスク「ワ-クフロ-実行時問題の根本原因修正」）で発生した3つの問題を再発防止するため、`definitions.ts`の3つのフェーズテンプレートを修正する要件を定義する。

修正対象は以下の3フェーズのsubagentTemplateである。

- testingフェーズ: `workflow_capture_baseline`の呼び出し指示が欠落している構造的問題を修正する
- test_implフェーズ: テストファイルの出力先指定と`workflow_record_test`登録手順が欠落している問題を修正する
- docs_updateフェーズ: 更新対象ドキュメントの範囲が未定義で任意ファイルが編集対象と誤解される問題を修正する

主要な決定事項として、修正はすべて`definitions.ts`内のsubagentTemplateの文字列に対する追記のみとし、フェーズロジックの変更は行わないことを確定した。この方針により変更の影響範囲が最小化され、既存テストのリグレッションリスクが低減される。

次フェーズ（planning/threat_modeling）では、本要件書に定義した3件の機能要件（FR-6、FR-7、FR-8）を基に、definitions.tsの具体的な変更仕様をspec.mdとして策定する。変更箇所は行番号レベルで特定済みであり、planningフェーズでの作業は変更内容の詳細記述と影響範囲の最終確認が中心となる。


## 機能要件

### FR-6: testingテンプレートへのworkflow_capture_baseline呼び出し手順追加

**要件の背景と目的**

testingフェーズのsubagentTemplateには現在`workflow_capture_baseline`の呼び出し指示が一切含まれていない。一方、CLAUDE.mdのルール20には「testingフェーズまでに既存テストスイートを実行し、workflow_capture_baselineで結果を記録すること」が明記されている。この乖離がsubagentによる未呼び出しの根本原因であり、regression_testフェーズへの遷移時に毎回「ベースライン未設定エラー」が発生している。

**要件の内容**

testingフェーズのsubagentTemplate（definitions.ts行878付近）に、以下の内容を含むセクションを追加する。

- テスト実行後に`workflow_capture_baseline`を呼び出すことが必須であるという明示的な指示
- `workflow_capture_baseline`ツールの呼び出しパラメータの説明（taskId、totalTests、passedTests、failedTests）
- ベースライン記録のタイミング（テスト実行コマンドの出力を取得した後、`workflow_record_test_result`の前または後に呼び出す）
- ベースライン記録が省略された場合に`regression_test`フェーズへの遷移がブロックされることの警告

**受け入れ条件**

追記後のsubagentTemplateを受け取ったtestingサブエージェントが、テスト実行後に`workflow_capture_baseline`を呼び出すこと。呼び出しパラメータとして`totalTests`、`passedTests`、`failedTests`が正しく数値で渡されること。既存の`workflow_record_test_result`に関する指示は変更しないこと。

---

### FR-7: test_implテンプレートへの出力ファイル指定と作成指示追加

**要件の背景と目的**

test_implフェーズのsubagentTemplate（definitions.ts行782）は現在「テストコードを実装してください（TDD Red）。」の1行のみであり、出力ファイルパスの指定が存在しない。他のフェーズ（research、requirements、planningなど）は全て「## 出力」セクションに出力先パスを明示しているが、test_implだけが例外的に省略されている。この欠落がサブエージェントによるテストファイル未作成の直接原因である。

**要件の内容**

test_implフェーズのsubagentTemplate（行782付近）を以下の点で拡充する。

- テストファイルの出力先ディレクトリを明示する（このプロジェクトでは`workflow-plugin/mcp-server/src/tests/`が標準テストディレクトリである）
- test-design.mdに記載されたテストケースを`.test.ts`ファイルとして実装することの明示
- 作成したテストファイルを`workflow_record_test`ツールで登録する手順の追加（testingフェーズおよびregression_testフェーズでの実行対象として記録するため）
- テストコードはこの時点では失敗状態（Red）であることが期待されることの説明（実装を先行するTDD原則に従った記述）

**テストディレクトリに関する補足要件**

test-design.mdが手動確認手順のみを記述している場合（GrepやReadツールによる確認手順）、test_implサブエージェントは「実装すべきテストコードが存在しない」と判断できる。この場合の取り扱いについて、テンプレートに以下を追記する。

- test-design.mdがコードレベルのテストケースを定義している場合は`.test.ts`ファイルを作成すること
- test-design.mdが手動確認手順のみを記述している場合は、作業内容として「手動確認手順の記録」または「確認が不要と判断した根拠の記録」を行うことで、フェーズとして完了を示すこと

**受け入れ条件**

追記後のsubagentTemplateを受け取ったtest_implサブエージェントが、test-design.mdにコードレベルのテストケースが含まれる場合に`.test.ts`ファイルを作成すること。作成したテストファイルパスを`workflow_record_test`で登録すること。手動確認手順のみの場合にもフェーズ完了の記録を行うこと。

---

### FR-8: docs_updateテンプレートへの更新対象範囲明示

**要件の背景と目的**

docs_updateフェーズのsubagentTemplate（definitions.ts行953）は現在「ドキュメントを更新してください。」の1行のみであり、全フェーズ中で最も簡素なテンプレートとなっている。この曖昧な指示がサブエージェントに「任意のドキュメントを更新してよい」という誤解を与え、MEMORY.mdへの無許可追記や、想定外のファイル変更が発生する原因となっている。

**要件の内容**

docs_updateフェーズのsubagentTemplate（行953付近）を以下の点で拡充する。

更新対象ドキュメントの範囲を明示する。具体的には以下のディレクトリ配下のファイルが更新対象となる。

- `docs/spec/`配下: 機能仕様書、画面仕様書、API仕様書、コンポーネント仕様書など
- `docs/architecture/`配下: システム概要、モジュール設計、ADR（必要な場合のみ）
- `docs/operations/`配下: デプロイ手順、環境定義、監視設計（必要な場合のみ）
- `CHANGELOG.md`: 変更履歴（プロジェクトルートに存在する場合）
- `README.md`: プロジェクト概要（更新が必要な場合のみ）

以下のファイルが更新対象外であることを明示する。

- `docs/workflows/{taskName}/`配下の成果物: これらは一時的な作業フォルダであり、gitignore対象であるため永続ドキュメントではない
- `MEMORY.md`（または`/memory/MEMORY.md`）: このファイルはシステムが管理するファイルであり、docs_updateフェーズでの編集対象外である
- `.claude/state/`配下のファイル: ワークフロー内部状態ファイルは編集禁止である

また、docs_updateフェーズの目的を明確に記述する。このフェーズの目的は「実装・テスト完了後に、実装内容を永続ドキュメントに反映すること」であり、作業フォルダの成果物を整理することではない。

**受け入れ条件**

追記後のsubagentTemplateを受け取ったdocs_updateサブエージェントが、`docs/spec/`配下や`CHANGELOG.md`などの永続ドキュメントのみを更新対象とすること。`MEMORY.md`または`docs/workflows/`配下のファイルを変更しないこと。更新対象ドキュメントが存在しない場合は「更新対象となる永続ドキュメントが存在しない」と報告してフェーズを完了すること。


## 非機能要件

### 保守性要件

**NFR-1: 変更範囲の最小化**

3件の修正（FR-6、FR-7、FR-8）はいずれも`definitions.ts`内のsubagentTemplate文字列への追記のみとする。フェーズのロジック（allowedBashCategories、editableFileTypes、model、checklist等）は変更しない。この方針により、既存のテストスイートへの影響を最小化し、リグレッションリスクを低減する。

**NFR-2: テンプレートの一貫性維持**

修正後の3フェーズのテンプレートは、他フェーズとの一貫性を維持すること。特に以下の点を維持する。

- 「## タスク情報」「## 入力」「## 作業内容」「## 出力」のセクション構造
- ワークフロー制御ツール禁止の記述（workflow_next等の禁止）
- sessionTokenに関する使用制限の記述（testingフェーズ）

**NFR-3: 後方互換性の確保**

追記内容がsubagentの既存動作を破壊しないこと。具体的には以下の点を確保する。

- testingフェーズ: `workflow_record_test_result`の既存呼び出し手順を変更しない
- test_implフェーズ: 既存のTDD Red フェーズの概念説明を維持する
- docs_updateフェーズ: 既存のフェーズ目的（ドキュメント更新）を否定しない

### 品質要件

**NFR-4: テスト実行後の確認義務**

修正後のdefinitions.tsに対して、既存のテストスイート（`workflow-plugin/mcp-server/src/tests/`）を実行し、全テストがパスすることを確認すること。特に以下のテストファイルへの影響を確認する。

- `definitions.test.ts`（フェーズ定義の構造テスト）
- `buildPrompt.test.ts`（テンプレート生成テスト）
- `artifact-validator.test.ts`（成果物バリデーションテスト）

**NFR-5: MCPサーバー再起動の必要性**

`definitions.ts`はコアモジュールに該当するため、修正後にMCPサーバーのビルドと再起動が必要となる。この手順を実施しないと変更が実行中のサーバーに反映されない（Node.jsモジュールキャッシュの制約）。planningフェーズではこの再起動手順をspec.mdの「実装後作業」セクションに明記すること。

### セキュリティ要件

**NFR-6: 更新対象外ファイルの保護**

docs_updateフェーズの修正（FR-8）において、`MEMORY.md`が更新対象外であることを明示することで、意図しない知見の書き込みや上書きによる情報の破壊を防止する。MEMORY.mdへの書き込みはprojected-memoryの仕組みを通じてシステムが管理するものであり、サブエージェントが直接編集すべきものではない。

**NFR-7: 内部状態ファイルの保護**

`.claude/state/`配下のワークフロー状態ファイルがdocs_updateフェーズで誤編集されることを防止する。これらのファイルはHMAC整合性チェックが設定されており、直接編集するとワークフローの動作が不正になる。

### 運用要件

**NFR-8: エラーメッセージの明確化**

FR-6の修正により、testingフェーズで`workflow_capture_baseline`の呼び出しが実施された場合、regression_testフェーズへの遷移時にベースライン未設定エラーが発生しなくなることを期待する。修正後の動作確認として、testingフェーズを実際に実行してregression_testへの遷移が正常に行われることをtestingフェーズの受け入れ条件に含める。
