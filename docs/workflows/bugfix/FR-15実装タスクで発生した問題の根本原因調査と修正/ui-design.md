## サマリー

- 目的: FR-16・FR-17・FR-18の3件の機能要件に対するMCPサーバーのインターフェース設計を定義し、実装フェーズで参照できるUI仕様を確立する
- 主要な決定事項: FR-16はe2e_testサブエージェントテンプレートへのOK/NG例追記で対応し、FR-17はtestingテンプレートへの警告ブロック追加で対応し、FR-18はworkflow_statusのJSONレスポンスにsessionTokenフィールドを追加して対応する
- 対象インターフェース: このプロジェクトはMCPサーバーであるため「UI」とはCLIインターフェース（MCP JSON-RPC呼び出し）・テンプレート文字列フォーマット・エラーメッセージ・JSONレスポンスを指す
- 次フェーズで必要な情報: test_designフェーズではFR-16のOK例形式バリデーション通過テスト・FR-17の警告文存在確認テスト・FR-18のsessionTokenフィールド返却テストの3種類を設計する必要がある
- 検証状況: 各FRの変更後は既存ユニットテスト945件の継続合格を確認し、FR-18についてはsessionTokenありとなしの両ケースを網羅する新規テストケースを追加して動作を検証する

## CLIインターフェース設計

### FR-17: testingテンプレートの警告ブロック形式

testingフェーズのsubagentTemplateに追加する警告ブロックは以下の形式とする。
workflow_capture_baselineに既存する警告ブロックと同等の強調度を確保するため、「⚠️ 警告」プレフィックスを使用する。
警告ブロックの挿入位置は「## workflow_capture_baseline 呼び出し（ベースライン記録）」セクションの直後かつ「## sessionTokenの取得方法と使用制限」セクションの直前が適切である。
これにより、サブエージェントがベースライン記録後の最重要ステップとしてworkflow_record_test_result呼び出しを認識できるようにする。

警告ブロックのテキスト構成として、1行目に「⚠️ 警告: workflow_record_test_resultの呼び出しは必須である」という宣言文を配置する。
2行目にはworkflow_record_test_resultを省略した場合の具体的な影響として「OrchestratorがWorkflow_nextを呼び出した際に『テスト結果が記録されていません』エラーが返される」という事実を記述する。
3行目には「このエラーによりtestingフェーズからregression_testフェーズへの遷移がブロックされる」という帰結文を配置する。
4行目には「つまり、workflow_record_test_resultの呼び出しはこのサブエージェントの完了条件であり、省略した場合はOrchestratorの次フェーズ遷移がブロックされる」という総括文を追加する。
5行目以降は現在の「## sessionTokenの取得方法と使用制限」セクションにつなげる形で構成する。

### FR-16: e2e_testテンプレートのOK/NG例の書式形式

サマリーセクションガイダンスに追記するOK/NG例は以下の形式とする。
NG例として「- テスト対象ユーザーシナリオの総数:」という形式（コロン後にコンテンツが続かないラベル行）を明示し、これが実質行ゼロと判定される原因であることを説明する。
5つのOK例はそれぞれ独立した箇条書き行として追記し、各行が一意の情報を含む形式にする。

1番目のOK例のキーとなる設計要件: シナリオ総数の行にはシナリオ件数の数値とシナリオ名（カテゴリ名）を含め、50文字以上の一意な内容にすること。
2番目のOK例のキーとなる設計要件: 実行環境の行にはブラウザ名・バージョン・OSバージョン・playwrightバージョンという4要素を含めること。
3番目のOK例のキーとなる設計要件: 成功・失敗件数の行には数値と「詳細は別セクションを参照」という参照誘導を含めること。
4番目のOK例のキーとなる設計要件: 発見事項の行には発見した具体的な症状（遅延時間の数値等）と深刻度の評価を含めること。
5番目のOK例のキーとなる設計要件: 総合合否の行には合否の判定結果と判定の根拠（重要シナリオの成功状況等）を含めること。

### FR-18: workflow_status CLIコマンドの動作仕様

workflow_statusはMCP JSON-RPCプロトコル経由でOrchestratorから呼び出されるツールである。
入力引数としてtaskId（任意の文字列型）を受け付け、taskIdを指定した場合は指定タスクの詳細レスポンスを返す。
taskIdを省略した場合は全アクティブタスクの一覧を返し、この場合はsessionTokenフィールドを含まない。
taskIdが存在しないIDを指定した場合はsuccess: falseのエラーレスポンスを返し、この場合もsessionTokenフィールドを含まない。

## エラーメッセージ設計

### FR-17: workflow_nextがブロックする際のエラーメッセージ仕様

testingフェーズでworkflow_record_test_resultが呼ばれなかった場合にOrchestratorがworkflow_nextを呼び出すと、MCPサーバーは以下の形式のエラーメッセージを返す。
現状のコードでは「テスト結果が記録されていません」というメッセージが返される設計となっており、この文言はFR-17のテンプレートで引用する正確な文字列である。
サブエージェントがこのエラーメッセージを事前に把握して対処できるよう、testingテンプレートの警告文に「『テスト結果が記録されていません』エラー」という具体的な引用形式で記述する。

エラーコードと対処方法の対応テーブルを以下に定義する。
エラーの種別: テスト結果未記録、エラーコード: TEST_RESULT_NOT_RECORDED、対処方法: workflow_record_test_resultを呼び出した後にworkflow_nextを再実行すること。
エラーの種別: sessionToken認証失敗、エラーコード: UNAUTHORIZED、対処方法: workflow_statusでsessionTokenを取得してから再実行すること（FR-18対応後）。
エラーの種別: タスク未発見、エラーコード: TASK_NOT_FOUND、対処方法: workflow_listでタスクIDを確認してから再実行すること。
エラーの種別: フェーズ承認待ち、エラーコード: APPROVAL_REQUIRED、対処方法: workflow_approveで承認を行ってからworkflow_nextを実行すること。
エラーの種別: サブフェーズ未完了、エラーコード: SUBPHASE_NOT_COMPLETED、対処方法: 全サブフェーズにworkflow_complete_subを呼び出してからworkflow_nextを実行すること。

### FR-18: sessionToken取得失敗時のエラーメッセージ仕様

sessionTokenが存在しない古いstateファイルからworkflow_statusを呼び出した場合、sessionTokenフィールドがnullまたは省略された形で返される。
このケースでsessionTokenなしでworkflow_complete_subやworkflow_nextを呼び出した場合は「sessionTokenが必要です」という既存のエラーメッセージが返される。
Orchestratorはworkflow_statusのレスポンスにsessionTokenが含まれない場合、旧バージョンのstateファイルとの互換性問題として扱い、ユーザーへの通知を推奨する。

## APIレスポンス設計

### FR-18: workflow_statusレスポンスのJSONスキーマ（taskId指定あり）

workflow_statusにtaskIdを指定した場合の成功レスポンスの構造を以下に定義する。
変更前のレスポンスにはsuccess・status・taskId・taskName・phase・workflowDir・docsDir・activeTasks・allTasks・message・taskSize・userIntent・activePhases・phaseGuideの各フィールドが含まれていた。
変更後のレスポンスには上記全フィールドに加えてsessionTokenフィールドが追加される。

sessionTokenフィールドの型は文字列型（string）であり、値はtaskState.sessionTokenに保存されている値をそのまま返す。
sessionTokenが存在しない（古いstateファイル）の場合はnullを返すか、フィールドを省略する実装を選択する。
spec.mdの実装内容に基づき、sessionTokenが存在しない場合はフィールドを省略する（undefined扱い）実装を推奨する。
理由は後方互換性のため、古いクライアントがsessionTokenフィールドの有無で挙動を変えないようにするためである。

JSONスキーマの追加フィールド定義:
- フィールド名: sessionToken
- 型: string | null
- 必須: いいえ（オプショナル）
- 説明: OrchestratorがワークフローAPIを呼び出す際の認証トークン。セッション切断後にworkflow_statusを呼び出すことで回復可能。
- 値が存在しない場合: フィールドそのものをレスポンスオブジェクトから省略する

### FR-18: workflow_statusレスポンスのJSONスキーマ（全タスク一覧）

taskIdを省略した場合の全タスク一覧レスポンスにはsessionTokenフィールドを追加しない設計とする。
一覧レスポンスのtasksフィールドには各タスクのtaskId・taskName・phase・docsDirのみを含め、sessionTokenは含めない。
理由はsessionTokenが特定のタスクに紐づく値であり、複数タスクの一覧レスポンスで混在させるとセキュリティリスクになるためである。
Orchestratorが特定タスクのsessionTokenを取得したい場合は、taskIdを明示的に指定してworkflow_statusを呼び出すこととする。

エラーレスポンスのスキーマは変更しない。success: falseのレスポンスにはsessionTokenフィールドを追加しない。

## 設定ファイル設計

### 実装対象ファイルと変更箇所の設定仕様

FR-16・FR-17・FR-18の実装に際して変更対象となるファイルと変更箇所を以下に定義する。

1番目の対象ファイルはworkflow-plugin/mcp-server/src/phases/definitions.tsである。
FR-16のe2e_testサブフェーズ定義（subagentTemplateフィールド）において、サマリーセクション行数ガイダンスの直後に5つのOK例を追記する。
追記対象の文字列は現在の「- テスト対象ユーザーシナリオの総数（対象としたシナリオ件数と各シナリオ名を記述する）\n」の箇条書き5項目の後ろにOK/NG例を挿入する形式とする。
FR-17のtestingフェーズ定義（subagentTemplateフィールド）において、「## workflow_capture_baseline 呼び出し（ベースライン記録）」セクションの内容の末尾に警告ブロックを追記する。

2番目の対象ファイルはworkflow-plugin/mcp-server/src/tools/status.tsである。
FR-18の変更対象は66行目から84行目のresultオブジェクト構築箇所であり、84行目の末尾（activePhases: ...activePhases の次の行）にsessionTokenフィールドを追加する。
追加するコードはtaskState.sessionTokenが存在する場合のみフィールドをセットする条件付き追加とする。

### MCPサーバービルド設定

変更後のTypeScriptファイルをMCPサーバーに反映するために以下のビルド手順を遵守すること。
ビルドコマンドの実行ディレクトリはworkflow-plugin/mcp-serverであり、npm run buildを実行することでTypeScriptをdist/配下にトランスパイルする。
ビルド完了後にClaude DesktopのMCPサーバー再起動機能でサーバーを再起動し、その後にworkflow_statusを呼び出して現在のフェーズを確認してから作業を再開すること。
コアモジュール（definitions.ts・status.ts）を変更した場合はMCPサーバー再起動が必須であり、再起動しないと変更が反映されない。

### バリデーター設定との整合性

定義したOK例フォーマットはartifact-validatorの実質行カウント仕様に準拠していることを確認済みである。
コロン後にコンテンツが続く形式（例: 「- シナリオ総数: 12件（...）」）は実質行としてカウントされる。
各OK例の行長は50文字を大幅に超える設計にしており、重複行検出ルール8（50文字以内のラベル行除外）の対象外となる。
5つのOK例はそれぞれ内容が異なるため、重複行エラーは発生しない。
NG例の記述でコードフェンス外に禁止語を含めないよう、禁止語リストと照合した上でOK/NG例の文言を決定している。
