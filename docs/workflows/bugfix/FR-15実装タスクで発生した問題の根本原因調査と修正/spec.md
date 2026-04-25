## サマリー

- 目的: FR-16/FR-17/FR-18の3件の修正の実装計画を仕様書として定義し、後続フェーズが参照できる実装仕様を確立する
- 評価スコープ: definitions.ts（e2e_testテンプレートとtestingテンプレートの2箇所修正）とstatus.ts（workflow_statusレスポンスへのフィールド追加1箇所）および対応するユニットテストファイルが対象範囲である
- 主要な決定事項: FR-16はe2e_testテンプレートのサマリーガイダンスに5項目分のOK例を追記する、FR-17はtestingテンプレート冒頭にworkflow_record_test_result省略時のフェーズ遷移ブロック警告を追加する、FR-18はstatus.tsのレスポンス構築箇所にsessionTokenフィールドを追加してセッション復元を可能にする
- 検証状況: requirements.mdを基に実装計画を策定済みであり、各FRの修正対象ファイル・挿入位置・受入条件が確定している
- 次フェーズで必要な情報: test_designフェーズではFR-16のバリデーション通過テスト・FR-17のworkflow_next失敗回避テスト・FR-18のsessionToken復元テストの3種類のテストケースを設計する必要がある

## 概要

本仕様書はFR-15実装タスク実行中に発生した3件の問題に対する修正計画を定義する。
3件の問題はいずれも独立した原因を持ち、それぞれdefinitions.tsのテンプレート文字列またはstatus.tsのレスポンス構築ロジックに起因する。
FR-16はe2e_testサブエージェントがサマリーセクションを空行ばかりで出力しバリデーションに失敗する問題への対処である。
FR-17はtestingサブエージェントがworkflow_record_test_resultを省略してフェーズ遷移がブロックされる問題への対処である。
FR-18はセッションをまたいだOrchestratorがsessionTokenを失い、workflow_complete_subおよびworkflow_nextが呼べなくなる問題への対処である。

### 修正方針

3件の修正はいずれも最小スコープで実施し、コアロジック（HMAC計算・フェーズ遷移バリデーション・状態管理）には一切手を加えない。
FR-16とFR-17はdefinitions.tsのテンプレート文字列への追記のみであり、ビジネスロジックへの影響はゼロである。
FR-18はstatus.tsへの軽微なコード変更（レスポンスオブジェクトへのフィールド追加）であり、既存の呼び出し元への後方互換性は保たれる。

### セキュリティ評価結果

FR-18のsessionToken公開については脅威モデリングフェーズで評価が行われた。
sessionTokenはMCPサーバーのローカルプロセス間通信（Claude Desktop経由）でのみ流通し、外部ネットワークには到達しない。
workflow_statusのレスポンスを受信できるのは正規のMCPクライアント（Orchestrator）のみであり、ネットワーク越しのトークン漏洩リスクは低いと判定された。
この評価に基づき、sessionTokenをworkflow_statusレスポンスに含める設計を採用する。

## 実装計画

### FR-16: e2e_testテンプレートのサマリーガイダンス改善

#### 問題の再確認

e2e_testのsubagentTemplateに含まれる「## サマリーセクションの行数ガイダンス」では5項目が箇条書きで示されているが、各項目の後続テキストが不足している。
サブエージェントがこれを「- テスト対象ユーザーシナリオの総数:」というコロン後空白のラベル行として転記した場合、artifact-validatorのプレーンラベルパターンが実質行ゼロと判定しバリデーションが失敗する。
manual_testのテンプレートには明示的なOK例が存在するが、e2e_testには相当するOK例が不足しているのが直接の原因である。

#### 実装内容

definitions.tsのe2e_testフェーズのsubagentTemplate文字列内、「## サマリーセクションの行数ガイダンス」セクションの直後または各項目の説明の後に以下の内容を追記する。
NG例として「- シナリオ総数:」（コロン後に何もない形式）を示し、artifact-validatorが実質行ゼロと判定することを明記する。
5つのOK例は以下の形式で追記する:

1番目（シナリオ総数）のOK例は「- シナリオ総数: 12件（ログイン・商品一覧・決済・ログアウトの4フロー）」という形式で示す。
2番目（実行環境）のOK例は「- 実行環境: Chromium 121.0（Ubuntu 22.04 / playwright 1.41）」という形式で示す。
3番目（成功・失敗件数）のOK例は「- 成功・失敗件数: 成功10件・失敗2件（失敗の詳細は「## テスト実行結果」を参照）」という形式で示す。
4番目（発見事項）のOK例は「- 発見事項: 決済完了後のリダイレクトで500msの遅延が確認された（軽微）」という形式で示す。
5番目（総合合否）のOK例は「- 総合合否: 合格（重要シナリオは全て成功、失敗2件は軽微）」という形式で示す。

#### 受入条件

e2e_testサブエージェントが出力したe2e-test.mdのサマリーセクションの実質行数が5行以上となり、artifact-validatorのバリデーションを通過すること。
追記内容がdefinitions.tsのコンパイルエラーを引き起こさないこと（TypeScriptのテンプレートリテラル構文を維持すること）。

### FR-17: testingテンプレートへのworkflow_record_test_result必須警告追加

#### 問題の再確認

testingテンプレートではworkflow_capture_baselineの省略に対する「⚠️ 警告」ブロックが存在する。
しかしworkflow_record_test_resultに関しては「推奨」「注意事項」という表現にとどまっており、省略した場合の具体的な影響（workflow_nextが失敗する）が明示されていない。
サブエージェントがworkflow_record_test_resultを省略してsubagent処理を完了した場合、OrchestratorのWorkflow_next呼び出し時に「テスト結果が記録されていません」エラーが返され、testingフェーズからregression_testフェーズへの遷移が失敗する。

#### 実装内容

definitions.tsのtestingフェーズのsubagentTemplate文字列内、作業手順セクションの冒頭またはworkflow_record_test_result呼び出し手順の直前に以下の内容を含む警告ブロックを追加する。
警告記号は「⚠️ 警告」を使用し、workflow_capture_baselineの警告と同等の強調度を確保する。
警告の核心は「workflow_record_test_resultを呼ばずに処理を終了すると、OrchestratorがWorkflow_nextを呼び出した際に『テスト結果が記録されていません』エラーが返され、フェーズ遷移がブロックされる」という事実の明示である。
警告文の後に「つまり、workflow_record_test_resultの呼び出しはこのサブエージェントの完了条件であり、省略した場合はOrchestratorの次フェーズ遷移がブロックされる」という帰結文を追加する。

#### 受入条件

testingサブエージェントがworkflow_record_test_resultを呼び出した後に処理を終了し、OrchestratorのWorkflow_nextが「テスト結果が記録されていません」エラーを返さないこと。
追記内容がdefinitions.tsのコンパイルエラーを引き起こさないこと。

### FR-18: workflow_statusレスポンスへのsessionToken追加

#### 問題の再確認

sessionTokenはworkflow_start時にのみレスポンスとして返されるが、Claude Desktopの会話セッションをまたいだ場合にOrchestratorのコンテキストからsessionTokenが消失する。
sessionTokenを失ったOrchestratorがworkflow_complete_subまたはworkflow_nextを呼び出した場合、「sessionTokenが必要です。このAPIはOrchestratorのみ実行可能です」エラーが返される。
helpers.tsにSESSION_TOKEN_REQUIRED=falseによるバイパス機構は存在するが、通常運用では有効化されていないため実質的な解決策にならない。

#### 実装内容

status.tsのworkflow_statusハンドラー内、レスポンスオブジェクトを構築している箇所にsessionTokenフィールドを追加する。
追加するフィールドの値はtaskState.sessionTokenに保存されている値をそのまま返す。
sessionTokenが存在しない場合（古いstateファイルとの互換性のため）はフィールドを省略するかnullを返す実装とする。

レスポンス構造の変更点は以下の通りである:
変更前のレスポンスにはphase・taskId・taskName等のフィールドが含まれる。
変更後のレスポンスには上記フィールドに加えてsessionTokenフィールドが追加される。

Orchestratorガイダンスにも補足記述を追加する。セッションをまたいだ後にOrchestratorがworkflow_statusを呼び出せばsessionTokenを回復できることを、definitions.tsのOrchestratorパターンのセクションに追記する。

#### 受入条件

workflow_statusの呼び出し結果にsessionTokenフィールドが含まれること。
セッションをまたいだOrchestratorがworkflow_statusを呼び出すことでsessionTokenを回復し、workflow_complete_subおよびworkflow_nextを正常に呼び出せること。
status.tsへの変更が既存のユニットテストを破壊しないこと。

## 変更対象ファイル

### 主要変更ファイル

1番目の変更ファイルは `workflow-plugin/mcp-server/src/phases/definitions.ts` である。
このファイルではe2e_testのsubagentTemplate文字列（FR-16対応）とtestingのsubagentTemplate文字列（FR-17対応）の2箇所を修正する。
変更はテンプレートリテラル内への文字列追記のみであり、TypeScriptのビジネスロジックへの影響はない。

2番目の変更ファイルは `workflow-plugin/mcp-server/src/tools/status.ts` である。
このファイルではworkflow_statusハンドラーのレスポンス構築箇所にsessionTokenフィールドを追加する（FR-18対応）。
変更量は数行程度であり、既存のレスポンスフィールドへの影響はない。

### 影響を受ける可能性のあるテストファイル

e2e_testテンプレートの変更（FR-16）に対応するテストが存在する場合、テンプレート文字列のスナップショットテストが影響を受ける可能性がある。
testingテンプレートの変更（FR-17）に対応するテストが存在する場合、同様にスナップショットテストが影響を受ける可能性がある。
status.tsの変更（FR-18）に対応するworkflow_statusのユニットテストが存在する場合、レスポンスのアサーションにsessionTokenフィールドの確認を追加する必要がある。

### MCPサーバーの再起動要件

definitions.tsまたはstatus.tsを変更した場合、変更をMCPサーバーに反映させるために以下の手順を実施すること。
まず `workflow-plugin/mcp-server` ディレクトリでnpm run buildを実行してTypeScriptをトランスパイルする。
次にClaude DesktopのMCPサーバー再起動機能を使用してサーバーを再起動する。
再起動後にworkflow_statusを呼び出して現在のフェーズを確認し、同フェーズから作業を再開する。

### 変更規模のまとめ

FR-16の変更規模は追記行数が20行程度であり、definitions.tsの既存行への変更はゼロである。
FR-17の変更規模は追記行数が10行程度であり、definitions.tsの既存行への変更はゼロである。
FR-18の変更規模は変更行数が5行程度であり、status.tsの既存フィールドへの変更はゼロである。
3件合計の変更規模は小規模であり、コアロジックへの影響は生じない。
