## サマリー

- 目的: FR-15タスク実行中に発生した3問題（e2e_testバリデーション失敗・testingフェーズのworkflow_next失敗・sessionTokenなし失敗）に対して、根本原因に基づく修正要件を定義する
- 評価スコープ: workflow-plugin/mcp-server/src/phases/definitions.ts（e2e_testおよびtestingのsubagentTemplate文字列）とworkflow-plugin/mcp-server/src/tools/（next.ts・complete-sub.ts・helpers.ts・status.ts）が対象
- 主要な決定事項: FR-16はe2e_testテンプレートのサマリーガイダンスに5項目分のOK例を追加する、FR-17はtestingテンプレートにworkflow_record_test_result省略時のworkflow_next失敗警告を冒頭に追加する、FR-18はworkflow_statusレスポンスにsessionTokenを含める形でMCPサーバーを修正する
- 検証状況: research.mdによる根本原因特定が完了しており、3問題それぞれについて修正対象ファイルと修正箇所が特定済みである
- 次フェーズで必要な情報: planning（threat_modeling含む）では各修正がセキュリティ的に問題ないか（特にFR-18のsessionToken露出リスク）を検討することが必要であり、実装フェーズではdefinitions.tsのテンプレート文字列の正確な挿入位置を確認する必要がある

## 背景と問題の概要

FR-15実装タスクの実行中に以下の3つの問題が連続して発生し、ワークフローの進行を阻害した。
これらの問題は互いに独立した原因を持っているが、いずれもサブエージェントのテンプレート設計またはMCPサーバーのAPI設計に起因する。
本要件定義ではresearch.mdで特定した根本原因に基づき、各問題の修正要件を明確化する。

## 機能要件

### FR-16: e2e_testテンプレートのサマリーガイダンス改善

#### 修正対象

definitions.tsのe2e_testフェーズのsubagentTemplate文字列内、「## サマリーセクションの行数ガイダンス」セクション。

#### 現状の問題

サマリーガイダンスに5項目の箇条書きリストが存在するが、各項目が「- テスト対象ユーザーシナリオの総数（シナリオ名と件数）」という形式で記載されている。
サブエージェントがこれを「- テスト対象ユーザーシナリオの総数:」というコロン後にコンテンツがないラベル行として転記した場合、artifact-validatorのFIX-1プレーンラベルパターンが実質行ゼロと判定する。
manual_testのテンプレートには「OK: 「- 目的: 手動テストにより機能の動作を検証した」（実質行1行にカウントされる）」という明示的なOK例があるが、e2e_testには相当するOK例が不足している。

#### 修正要件

e2e_testのsubagentTemplateのサマリーガイダンスに、5項目それぞれに対応する具体的なOK例の行を追加すること。
各OK例は「コロンの後に実際のコンテンツ（文字列）が続く形式」であり、50文字以内のコロン終端行にならないよう十分な後続テキストを含めること。
追加するOK例の内容は以下の5項目に対応させること。
- 1つ目は「シナリオ総数」に対応し、「シナリオ総数: 12件（ログイン・商品一覧・決済・ログアウトの4フロー）」という形式のOK例を提示すること
- 2つ目は「実行環境」に対応し、「実行環境: Chromium 121.0（Ubuntu 22.04 / playwright 1.41）」という形式のOK例を提示すること
- 3つ目は「成功・失敗件数」に対応し、「成功・失敗件数: 成功10件・失敗2件（失敗の詳細は「## テスト実行結果」を参照）」という形式のOK例を提示すること
- 4つ目は「発見事項」に対応し、「発見事項: 決済完了後のリダイレクトで500msの遅延が確認された（軽微）」という形式のOK例を提示すること
- 5つ目は「総合合否」に対応し、「総合合否: 合格（重要シナリオは全て成功、失敗2件は軽微）」という形式のOK例を提示すること

また、各OK例の前後に「NG例: 「- シナリオ総数:」（コロン後に何もない、実質行ゼロ）」という対比NGの記述を追加すること。

### FR-17: testingテンプレートへのworkflow_record_test_result必須警告の追加

#### 修正対象

definitions.tsのtestingフェーズのsubagentTemplate文字列内、作業手順セクションの冒頭または「workflow_record_test_result 呼び出し時の注意」セクションの前。

#### 現状の問題

testingテンプレートではworkflow_capture_baselineの呼び出しには「⚠️ 警告: ベースライン記録を省略した場合...」という明示的な警告文がある。
しかしworkflow_record_test_resultについては「推奨」「注意事項」という表現にとどまっており、「省略した場合にworkflow_nextが失敗する」という結果が明記されていない。
サブエージェントがworkflow_capture_baselineのみ呼び出してworkflow_record_test_resultを省略した場合、Orchestratorのworkflow_next呼び出し時に「テスト結果が記録されていません」エラーが返され、フェーズ遷移がブロックされる。

#### 修正要件

testingテンプレートの作業手順の冒頭、またはworkflow_record_test_result呼び出し手順の直前に、以下の内容を含む明示的な警告ブロックを追加すること。
警告の核心は「workflow_record_test_resultを呼ばずに処理を終了した場合、OrchestratorがWorkflow_nextを呼び出した際に「テスト結果が記録されていません」エラーが返され、テストフェーズからリグレッションテストフェーズへの遷移が失敗する」という事実の明示である。
警告の強調度はworkflow_capture_baselineと同等またはそれ以上とし、「⚠️ 警告」記号を使用すること。
警告文の位置はサブエージェントが読み飛ばしにくい箇所（作業手順の最重要ステップ直前、または最初の警告ブロック）に配置すること。
warning文の後に「つまり、workflow_record_test_resultの呼び出しはこのサブエージェントの完了条件であり、省略した場合はOrchestratorの次フェーズ遷移がブロックされる」という帰結文を追加すること。

### FR-18: workflow_statusレスポンスへのsessionToken追加

#### 修正対象

workflow-plugin/mcp-server/src/tools/status.ts（workflow_statusハンドラー）と、必要に応じてdefinitions.tsのOrchestratorガイダンスセクション。

#### 現状の問題

sessionTokenはworkflow_start時にのみレスポンスとして返されるが、Claude Desktopの会話セッションをまたいだ場合にOrchestratorのコンテキストからsessionTokenが消失する。
workflow_statusはタスクの現在状態を返すが、sessionTokenは含まれていない。
sessionTokenを失ったOrchestratorがworkflow_complete_subまたはworkflow_nextを呼び出した場合、「sessionTokenが必要です。このAPIはOrchestratorのみ実行可能です。」エラーが返される。
helpers.tsにSESSION_TOKEN_REQUIRED=falseによるバイパス機構は存在するが、通常運用では有効化されていない。

#### 修正要件

status.tsのworkflow_statusレスポンスにsessionTokenを追加すること。
sessionTokenの値はtaskState.sessionTokenに保存されている値を返すこと。
sessionTokenがworkflow_statusレスポンスに含まれることで、セッションをまたいだOrchestratorがworkflow_statusを呼び出すことでsessionTokenを回復できるようになる。
セキュリティリスクに関しては、sessionTokenはMCPサーバーのローカルプロセス間通信（Claude Desktop経由）でのみ流通するため、ネットワーク越しのトークン漏洩リスクは低い。ただし脅威モデリングフェーズで確認すること。
後続のplanning・threat_modelingフェーズで、sessionTokenをworkflow_statusレスポンスに含める場合の具体的なレスポンス構造の設計を行うこと。

## 非機能要件

### 変更規模と影響範囲

FR-16とFR-17はdefinitions.tsのテンプレート文字列への追記のみであり、ビジネスロジックへの影響はない。
FR-18はstatus.tsへの変更とdefinitions.tsへのガイダンス追記を含み、レスポンス構造の変更を伴う。
いずれの変更もMCPサーバーのコアロジック（HMAC計算・フェーズ遷移バリデーション）には影響しない。

### テスト容易性

FR-16の修正はe2e_testサブエージェントが出力するe2e-test.mdのサマリーセクションにOK形式の行が含まれることで検証する。
FR-17の修正はtestingサブエージェントがworkflow_record_test_resultを呼び出した後に処理を終了することで検証する。
FR-18の修正はworkflow_statusのレスポンスにsessionTokenフィールドが含まれることをユニットテストで検証する。

### 後方互換性

FR-16・FR-17はテンプレート文字列への追記のみであり、既存の成果物フォーマットへの変更はない。
FR-18はworkflow_statusのレスポンスに新フィールドを追加するが、既存のクライアントコードはフィールドを無視するため後方互換性が保たれる。
FR-18の変更後にMCPサーバーを再起動してからworkflow_statusを呼び出すと新フィールドが含まれることを確認すること。

### 実装優先度

FR-16とFR-17はdefinitions.tsのテンプレート文字列変更のみのため、実装コストが低く優先度が高い。
FR-18はstatus.tsへのコード変更を伴い、影響範囲の分析（ユニットテスト・統合テスト）が必要なため、FR-16・FR-17の完了後に着手すること。

### パフォーマンス要件

workflow_statusはsessionTokenをtaskStateから読み取るだけであり、追加のI/Oや計算コストは発生しない。
definitions.tsのテンプレート文字列の長さが増加するが、MCPサーバーの起動コストへの影響は無視できる範囲である。

## 受け入れ条件

FR-16: e2e_testサブエージェントが出力したe2e-test.mdのサマリーセクションが、artifact-validatorのバリデーションを通過する（実質行数が5行以上になる）こと。
FR-17: testingサブエージェントがworkflow_record_test_resultを呼び出した後に処理を終了し、OrchestratorのWorkflow_nextが「テスト結果が記録されていません」エラーを返さないこと。
FR-18: セッションをまたいだOrchestratorがworkflow_statusを呼び出すことでsessionTokenを回復し、workflow_complete_subおよびworkflow_nextを正常に呼び出せること。
