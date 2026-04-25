## サマリー

- 目的: FR-16（e2e_testテンプレートOK例追記）・FR-17（testingテンプレート警告追加）・FR-18（workflow_statusにsessionToken追加）の3件の修正に対するテストケースを設計し、実装フェーズで作成すべきテストコードの仕様を確定する
- 主要な決定事項: FR-16とFR-17はdefinitions.tsのテンプレート文字列を検証する静的テストで対応し、FR-18はstatus.tsの新規ユニットテストを追加することで対応する
- 既存テストとの整合性: status-context.test.tsが既存の主要テストファイルであり、FR-18はこのテストと同じモック構成パターンで新規テストファイルを追加する
- 対象フェーズの前提: testingフェーズのsubagentTemplateに既にworkflow_capture_baseline警告が存在しており、FR-17はその直後にworkflow_record_test_result専用の警告ブロックを追加する
- 次フェーズで必要な情報: test_implフェーズではこのテスト設計に基づいてstatus.test.tsをworkflow-plugin/mcp-server/src/tools/__tests__/配下に新規作成し、FR-16・FR-17の検証はdefinitions.ts読み取りによる文字列検索テストで対応する

## テスト方針

### 全体方針

本タスクの3件の修正（FR-16・FR-17・FR-18）はそれぞれ独立した原因に起因しており、テスト設計もFR番号ごとに独立したグループで構成する。
TDDサイクルに従い、test_implフェーズでテストコードを先行作成し（Redフェーズ）、implementationフェーズで実装してテストを通過させる（Greenフェーズ）。

FR-16とFR-17はdefinitions.tsに対するテンプレート文字列の存在確認テストであり、ファイルを読み取って特定の文字列パターンが含まれているかを検証する形式を採用する。
ビジネスロジックの変更を伴わないため、外部依存のモックは不要であり、定数ファイルの内容チェックのみで十分である。

FR-18はstatus.tsのworkflowStatus関数のレスポンスにsessionTokenフィールドが追加されることを検証する。
既存のstatus-context.test.tsと同様のモック構成（stateManagerのdiscoverTasksをvi.mockで差し替え）を採用することで、テスト環境の一貫性を確保する。

### テストファイルの配置

FR-16・FR-17の検証テスト: 既存の`workflow-plugin/mcp-server/src/tools/__tests__/`配下に新規ファイルとして`fr16-fr17-template.test.ts`を作成する。
FR-18の検証テスト: 同ディレクトリに`status-session-token.test.ts`を新規作成する。
既存テストのリグレッション確認: 現在の全テストスイートを実行して合格件数を確認し、workflow_capture_baselineで記録する。

### 重要な設計制約

テストフレームワークはvitestを使用する。プロジェクトのpackage.jsonに従い、テスト実行コマンドは`npm test`または`npx vitest run`とする。
セッショントークン関連の既存テスト（session-token.test.ts）はREQ-6の検証を目的としており、FR-18のsessionToken公開とは異なる観点を持つ。既存テストに手を加えずにFR-18専用のテストファイルを追加することで、テスト間の責任分離を維持する。

## テストケース

### TC-FR16-1: e2e_testテンプレートに5つのOK例が存在することを確認

このテストはdefinitions.tsのe2e_testフェーズのsubagentTemplate文字列の中に、FR-16で追加される5つのOK例が含まれているかを検証する。
5つのOK例とはシナリオ総数・実行環境・成功失敗件数・発見事項・総合合否を示す具体的な行である。

テスト対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`
テスト種別: 静的コンテンツ検証（テンプレート文字列の内容確認）

テスト手順:
1番目のOK例検証として、e2e_testのsubagentTemplateを取得し、「シナリオ総数: 」という文字列（コロン後にスペースとコンテンツが続く形式）が含まれていることを確認する。
2番目のOK例検証として、「実行環境: Chromium」という具体的なブラウザ情報が含まれた行が存在することを確認する。
3番目のOK例検証として、「成功・失敗件数: 成功」というコロン後に件数情報が続く行が存在することを確認する。
4番目のOK例検証として、「発見事項: 」というコロン後にコンテンツが続く行が存在することを確認する。
5番目のOK例検証として、「総合合否: 合格」というコロン後に判定が続く行が存在することを確認する。

合格条件: 5つの文字列パターンがいずれもe2e_testのsubagentTemplateに含まれていること

### TC-FR16-2: 各OK例のコロン後コンテンツ長が50文字以上であることを確認

このテストはartifact-validatorの実質行判定ルール（「コロン後にコンテンツが存在する行は実質行としてカウントされる」）に適合するため、各OK例の記述がコロン後に十分なコンテンツを持つことを検証する。

テスト対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`
テスト種別: コンテンツ品質検証

テスト手順:
e2e_testのsubagentTemplateから5つのOK例の行をそれぞれ抽出する。
抽出した各行についてコロンを境界にして後半部分を取得し、後半部分のトリム済み文字列が20文字以上あることを確認する（単純な件数表示「12件」などは短いが有効なコンテンツとして認める）。

合格条件: 5行全てにおいてコロン後の文字列が空でないこと（文字数10文字以上を閾値とする）

### TC-FR16-3: NG例のコードフェンス内配置確認

このテストはFR-16で追加されるNG例の記述がコードフェンス内に配置されており、artifact-validatorの禁止パターン検出（ラベルのみ行の検出）の対象外となることを確認する。
spec.mdの説明によるとNG例として「- シナリオ総数:」（コロン後に何もない形式）を示す必要があるが、この記述がコードフェンス外に置かれると本物の成果物でバリデーションが失敗する可能性がある。

テスト対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`
テスト種別: テンプレート構造検証

テスト手順:
e2e_testのsubagentTemplateをNG例の記述箇所の前後で分割し、NG例の直前にコードフェンス開始記号（バッククォート3つ）が存在するか、またはNG例がコメント形式で記述されているかを確認する。
あるいはNG例がコードフェンス内に存在することを示す別の手段として、extractNonCodeLines関数が除外する範囲内にNG例が含まれることを確認する。

合格条件: NG例がコードフェンス外のMarkdown本文として剥き出しにならない形式で配置されていること

### TC-FR17-1: testingテンプレートに警告ブロックが存在することを確認

このテストはdefinitions.tsのtestingフェーズのsubagentTemplate文字列の中にFR-17で追加されるworkflow_record_test_result省略時の警告ブロックが含まれているかを検証する。

テスト対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`
テスト種別: 静的コンテンツ検証

テスト手順:
testingフェーズのsubagentTemplateを取得し、警告記号「⚠️ 警告」という文字列が含まれていることを確認する。
さらにその警告ブロック内にworkflow_record_test_resultという関数名が言及されていることを確認する。

合格条件: 「⚠️ 警告」という記号と「workflow_record_test_result」という文字列が両方ともtestingのsubagentTemplateに含まれていること

### TC-FR17-2: 警告ブロックの配置位置がworkflow_capture_baseline警告の直後であることを確認

このテストはFR-17の警告ブロックがspec.mdの実装内容（workflow_capture_baseline呼び出しセクションの直後）に配置されているかを検証する。
testingテンプレートには既存のworkflow_capture_baseline省略時の警告（「⚠️ 警告: ベースライン記録を省略した場合」）が存在するため、FR-17の警告がその後に続くことを確認する。

テスト対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`
テスト種別: テンプレート構造検証

テスト手順:
testingのsubagentTemplateをテキストとして解析し、「ベースライン記録を省略した場合」という既存の警告テキストの登場位置と、FR-17で追加される「workflow_record_test_resultを省略した場合」（またはそれに相当する警告テキスト）の登場位置を比較する。
FR-17の警告が既存の警告の後に配置されていることを位置関係で確認する。

合格条件: FR-17の警告テキストがベースライン警告テキストよりも後ろのインデックスに存在すること

### TC-FR17-3: 警告ブロック内にフェーズ遷移ブロックの説明が記述されていること

このテストはFR-17の警告ブロックの内容として「workflow_nextがブロックされる」「テスト結果が記録されていません」等のエラーの具体的な影響が記述されていることを確認する。

テスト対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`
テスト種別: 警告内容の充実度検証

テスト手順:
testingのsubagentTemplateからFR-17の警告ブロックを特定し、その周辺に「workflow_next」という文字列が含まれていること、またはフェーズ遷移のブロックに言及するテキストが含まれていることを確認する。
spec.mdに記載された「テスト結果が記録されていません」というエラーメッセージを示す文字列が含まれていることを確認する。

合格条件: FR-17の警告ブロックに「workflow_next」という文字列と、ブロックエラーに関する説明テキストが存在すること

### TC-FR18-1: taskId指定時のworkflow_statusにsessionTokenフィールドが含まれること

このテストはFR-18の主要な変更点として、taskIdを指定してworkflow_statusを呼び出した場合にレスポンスにsessionTokenフィールドが含まれることを検証する。

テスト対象ファイル: `workflow-plugin/mcp-server/src/tools/status.ts`
テスト種別: ユニットテスト（レスポンスフィールド検証）

テスト手順:
stateManager.discoverTasksをvi.mockで差し替え、sessionTokenフィールドを持つモックタスク状態を返すように設定する。
workflowStatus関数を有効なtaskIdを引数として呼び出す。
レスポンスオブジェクトにsessionTokenフィールドが存在し、その値がモックタスクに設定したsessionTokenと一致することを確認する。

モックタスクの設定例:
タスクIDとして「test-fr18-001」を使用し、フェーズとして「research」を設定し、sessionTokenとして64文字の英数字文字列を設定する。

合格条件: workflowStatusのレスポンスオブジェクトにsessionTokenフィールドが存在し、モックに設定した値と一致していること

### TC-FR18-2: taskState.sessionTokenがnullの場合にsessionTokenフィールドが省略されること

このテストはFR-18の仕様として、タスク状態にsessionTokenが設定されていない（nullまたはundefined）場合にworkflow_statusレスポンスからsessionTokenフィールドが省略されることを検証する。
古いstateファイルとの後方互換性を確保するための仕様である。

テスト対象ファイル: `workflow-plugin/mcp-server/src/tools/status.ts`
テスト種別: ユニットテスト（フィールド省略動作検証）

テスト手順:
stateManager.discoverTasksをvi.mockで差し替え、sessionTokenフィールドを持たないモックタスク状態を返すように設定する。
workflowStatus関数を有効なtaskIdを引数として呼び出す。
レスポンスオブジェクトにsessionTokenフィールドが存在しない、またはsessionTokenがnullであることを確認する。

合格条件: sessionTokenが設定されていないタスクのworkflowStatusレスポンスにsessionTokenフィールドが存在しないか、またはnullが設定されていること

### TC-FR18-3: taskId未指定の全タスク一覧にsessionTokenが含まれないこと

このテストはtaskIdを指定しない（全タスク一覧を返す）場合のworkflow_statusレスポンスにsessionTokenが含まれないことを検証する。
全タスク一覧レスポンスはOrchestratorが操作対象のタスクを特定するための補助情報であり、sessionTokenを露出させる必要はない。

テスト対象ファイル: `workflow-plugin/mcp-server/src/tools/status.ts`
テスト種別: ユニットテスト（全タスク一覧レスポンス検証）

テスト手順:
stateManager.discoverTasksをvi.mockで差し替え、複数のモックタスク状態を返すように設定する。
workflowStatus関数をtaskId引数なしで呼び出す。
レスポンスのtasksフィールドに含まれる各タスクオブジェクトにsessionTokenフィールドが存在しないことを確認する。

合格条件: taskId未指定のworkflowStatusレスポンスのtasksリスト内のタスクオブジェクトにsessionTokenが含まれないこと

### TC-FR18-4: taskIdが存在しない場合のエラーレスポンスにsessionTokenが含まれないこと

このテストは存在しないtaskIdを指定した場合のエラーレスポンスにsessionTokenフィールドが含まれないことを検証する。
エラーパスのセキュリティ確認として、TASK_NOT_FOUND エラーのレスポンス構造を確認する。

テスト対象ファイル: `workflow-plugin/mcp-server/src/tools/status.ts`
テスト種別: ユニットテスト（エラーパス検証）

テスト手順:
stateManager.discoverTasksをvi.mockで差し替え、空のタスク一覧または別のタスクIDを持つタスクのみを返すように設定する。
workflowStatus関数を存在しないtaskId（例：「nonexistent-task-999」）を引数として呼び出す。
レスポンスのsuccess値がfalseであり、error値が「TASK_NOT_FOUND」であることを確認する。
レスポンスオブジェクトにsessionTokenフィールドが存在しないことを確認する。

合格条件: エラーレスポンス（success: false）にsessionTokenフィールドが含まれないこと

### TC-REG-1: 既存のユニットテスト全件が継続合格すること

このテストは今回の3件の修正（FR-16・FR-17・FR-18）によって既存テストが壊れないことを確認するリグレッション防止のテストケースである。
実際の確認はtestingフェーズでnpm testコマンドを実行して行うが、テスト設計として事前に合格すべき既存テストの範囲を明記する。

対象テストファイルとその概要:
session-token.test.tsはREQ-6のsessionToken発行・検証テストを含み、workflowStartのsessionToken返却とworkflowNextのsessionToken検証を確認する。
status-context.test.tsはworkflow_statusのscope・approvals情報返却を確認するテストであり、FR-18変更後もこれらのフィールドが引き続き正常に返却されることを確認する。
start.test.tsはworkflow_startの基本的な挙動を確認するテストであり、FR-18の影響外であることを確認する。
next.test.tsはworkflow_nextのフェーズ遷移ロジックを確認するテストであり、definitions.tsのテンプレート変更（FR-16・FR-17）によって遷移ロジックに影響がないことを確認する。

合格条件: 既存のテストスイート全件がFR-16・FR-17・FR-18の実装後も引き続き合格すること

### TC-REG-2: status-context.test.tsがFR-18変更後も合格すること

このテストはFR-18のstatus.ts変更（sessionTokenフィールド追加）後に既存のstatus-context.test.tsが全件合格することを個別に確認する。

対象テストファイル: `workflow-plugin/mcp-server/src/tools/__tests__/status-context.test.ts`
確認項目:
TC-C1（scope情報の追加）がFR-18の変更後も合格すること。
TC-C2（approvals情報の追加）がFR-18の変更後も合格すること。
TC-C3（approvalsの初期状態）がFR-18の変更後も合格すること。
新たにsessionTokenフィールドが追加されることによってscopeやapprovalsの取得処理に影響がないことを確認する。

合格条件: status-context.test.tsの全テストケース（TC-C1・TC-C2・TC-C3の全アサーション）がFR-18実装後も合格すること

## 実装時の注意事項

### FR-18テストのモック構成

FR-18の新規テストファイルでは、status-context.test.tsと同様の以下のモック設定を採用すること。
stateManagerモジュール全体をvi.mockで差し替え、discoverTasksはvi.fnで返り値を制御する。
initializeSubPhasesはvi.fnで空オブジェクトを返すように設定し、並列フェーズ以外のフェーズテストで安全に呼び出せるようにする。

sessionTokenフィールドを含むモックタスクの型安全な生成方法として、TypeScriptの型アサーション（asキーワード）を用いてTaskState型にsessionTokenを追加する方式を採用する。
これはsession-token.test.tsの実装パターン（createMockTaskState関数内での`(state as any).sessionToken = ...`）に倣う。

### FR-16・FR-17テストのdefinitions.ts読み込み方法

definitions.tsのテンプレート文字列を検証するテストでは、vitestのimport文を使用してdefinitions.tsをモジュールとして読み込み、PHASES_DEFINITIONSオブジェクトからe2e_testおよびtestingのsubagentTemplateフィールドにアクセスする。
ファイル読み込みはfsモジュールを使用せずに、ESM形式のimportを使用することで型安全な検証が可能になる。

### 合格条件の優先順位

最優先で確認すべきテストはTC-FR18-1であり、これはFR-18の核心機能を検証する。
次に確認すべきはTC-FR17-1であり、警告ブロックの存在確認はtestingサブエージェントの動作改善に直結する。
TC-FR16-1はE2Eテストのバリデーション通過率向上を検証するテストであり、3つのFRの中では影響範囲が最も広い。
TC-REG-1とTC-REG-2はリグレッション防止のテストであり、全ての実装が完了した後にtestingフェーズで実行して確認する。
