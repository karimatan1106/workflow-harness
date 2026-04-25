# テスト設計書 - 今回のワークフロー実行で発生した問題の根本原因調査と修正

## サマリー

本テスト設計書はFR-6・FR-7・FR-8の3つの修正要件に対応するテストケースを定義する。
修正対象は `workflow-plugin/mcp-server/src/phases/definitions.ts` の1ファイルのみであり、変更内容はtesting・test_impl・docs_updateの3フェーズのsubagentTemplate文字列への追記に限定される。

主要な決定事項として、テストの対象は以下の3点に集約される。
第1にFR-6（testingフェーズへのworkflow_capture_baseline追記）のテストでは、テンプレート文字列に`workflow_capture_baseline`の呼び出し手順が含まれているかを文字列検索で検証する。
第2にFR-7（test_implフェーズへの出力先明記と`workflow_record_test`追記）のテストでは、テンプレート文字列に`__tests__`ディレクトリと`workflow_record_test`の記述が含まれているかを検証する。
第3にFR-8（docs_updateフェーズへの更新スコープ追記）のテストでは、テンプレート文字列に`MEMORY.md`禁止と`.claude/state/`禁止の記述が含まれているかを検証する。

次フェーズ（test_impl）では本書で定義したテストケースをコードとして実装する。
実装するテストファイルは `workflow-plugin/mcp-server/src/phases/__tests__/definitions-subagent-template.test.ts` に配置する。
テストフレームワークはvitestを使用し、既存の `definitions.test.ts` と同じインポート構成を採用する。

## テスト方針

### 全体方針

本タスクのテスト対象はTypeScriptのソースファイル（`definitions.ts`）の文字列プロパティへの追記である。
テストの目的は「追記した内容がsubagentTemplateに正しく含まれているか」を自動的に検証することであり、テストが成功することで追記が正しく行われたことを機械的に確認できる状態にする。

テストの種類はすべてユニットテストであり、実際のMCPサーバーの起動や外部プロセスへの依存は不要である。
`resolvePhaseGuide` 関数を使用してテンプレート文字列を取得し、文字列の内容を検証する方針を採用する。
テストはTDD Redフェーズ（test_implフェーズ）で作成するため、実装前は必ず失敗する状態で作成すること。
実装フェーズで追記が完了した後にテストがPassする（Green）ことを確認することが目標である。

### テストスコープ

テストの対象範囲は以下のとおりである。
検証対象として含めるのは「testing・test_impl・docs_updateの3フェーズのsubagentTemplateプロパティへの追記内容」である。
検証対象から除外するのは「フェーズ遷移ロジック・HMAC検証コード・バリデーションロジック・allowedBashCategories・editableFileTypes」であり、これらは今回の変更で触れないため既存テストが担保する。

### テストフレームワークと配置

テストフレームワークとしてvitestを採用する（既存テストと統一する）。
テストファイルの配置先は `workflow-plugin/mcp-server/src/phases/__tests__/definitions-subagent-template.test.ts` とする。
インポートパスは `../definitions.js` を使用し、`resolvePhaseGuide` と `PHASE_GUIDES` をインポートする。
既存テストへの影響は最小限とし、新規テストファイルの追加のみで対応する。

### 検証戦略

文字列検証には `toContain` を使用し、部分一致で追記内容の存在を確認する。
各テストケースは独立して実行可能とし、セットアップ・ティアダウン処理は不要とする。
テストの命名規則は「FR番号 - 確認内容」形式とし、失敗時にどの要件が未充足かを明確に示す。

## テストケース

### FR-6: testingフェーズのsubagentTemplate検証

FR-6に対応するテストは、testingフェーズの`subagentTemplate`プロパティに`workflow_capture_baseline`の呼び出し手順が追記されているかを検証するものである。
全テストケースで使用する共通セットアップとして、`resolvePhaseGuide('testing', 'docs/workflows/test')` を呼び出してsubagentTemplateを取得する。

#### TC-6-1: workflow_capture_baselineセクションの存在確認

確認観点はtestingフェーズのsubagentTemplateに`workflow_capture_baseline`という文字列が含まれていることである。
期待結果として `expect(template).toContain('workflow_capture_baseline')` がPassすることを確認する。
この確認が失敗する状況は、implementations.tsへの追記を行う前のRedフェーズである。

#### TC-6-2: totalTestsパラメータの説明の存在確認

確認観点はテンプレートに`totalTests`というパラメータ名が含まれていることである。
期待結果として `expect(template).toContain('totalTests')` がPassすることを確認する。
このパラメータ名が含まれていない場合、サブエージェントがAPI呼び出し時に必須引数を把握できない恐れがある。

#### TC-6-3: passedTestsパラメータの説明の存在確認

確認観点はテンプレートに`passedTests`というパラメータ名が含まれていることである。
期待結果として `expect(template).toContain('passedTests')` がPassすることを確認する。
4つの必須パラメータ（taskId・totalTests・passedTests・failedTests）がすべて含まれていることをTCごとに確認することで、どのパラメータが欠落したかを個別に特定できる。

#### TC-6-4: failedTestsパラメータの説明の存在確認

確認観点はテンプレートに`failedTests`というパラメータ名が含まれていることである。
期待結果として `expect(template).toContain('failedTests')` がPassすることを確認する。
このパラメータは文字列配列の型であるため、サブエージェントが型を誤解すると呼び出しが失敗する可能性がある。

#### TC-6-5: ベースライン記録省略時の警告の存在確認

確認観点はテンプレートに`regression_test`という文字列が含まれており、省略時の警告文脈で登場していることである。
期待結果として `expect(template).toContain('regression_test')` がPassすることを確認する。
この文字列が含まれていることで、サブエージェントがベースライン記録と後続フェーズの関係を理解できるようになる。

#### TC-6-6: 既存のworkflow_record_test_resultセクションが保持されていることの確認（リグレッション防止）

確認観点はFR-6の追記後も、既存の`workflow_record_test_result`の記述がテンプレート内に残存していることである。
期待結果として `expect(template).toContain('workflow_record_test_result')` がPassすることを確認する。
このテストは既存機能のリグレッション防止を目的としており、追記によって既存コンテンツが削除・上書きされていないことを保証する。

### FR-7: test_implフェーズのsubagentTemplate検証

FR-7に対応するテストは、test_implフェーズの`subagentTemplate`プロパティにテストファイルの出力先と`workflow_record_test`の呼び出し手順が追記されているかを検証するものである。
全テストケースで使用する共通セットアップとして、`resolvePhaseGuide('test_impl', 'docs/workflows/test')` を呼び出してsubagentTemplateを取得する。

#### TC-7-1: __tests__ディレクトリの記述の存在確認

確認観点はtest_implフェーズのsubagentTemplateに`__tests__`という文字列が含まれていることである。
期待結果として `expect(template).toContain('__tests__')` がPassすることを確認する。
このプロジェクトのテストディレクトリ命名規則（`__tests__`サブディレクトリ方式）が明示されていることで、サブエージェントが正しいパスにテストファイルを配置できるようになる。

#### TC-7-2: workflow_record_testの呼び出し手順の存在確認

確認観点はテンプレートに`workflow_record_test`という文字列が含まれていることである。
期待結果として `expect(template).toContain('workflow_record_test')` がPassすることを確認する。
このMCPツール名が含まれていることで、サブエージェントがテストファイル作成後に登録手順を実行できるようになる。

#### TC-7-3: testFileパラメータの説明の存在確認

確認観点はテンプレートに`testFile`というパラメータ名が含まれていることである。
期待結果として `expect(template).toContain('testFile')` がPassすることを確認する。
`workflow_record_test`の引数として`testFile`が必須であることをサブエージェントが認識できることが重要である。

#### TC-7-4: 既存のTDD Red指示が保持されていることの確認（リグレッション防止）

確認観点はFR-7の追記後も、既存の`TDD Red`という記述がテンプレート内に残存していることである。
期待結果として `expect(template).toContain('TDD Red')` がPassすることを確認する。
この確認により、追記が既存の1行指示（テストコードを実装してください（TDD Red）。）を削除・置換していないことを保証する。

#### TC-7-5: プロジェクト固有テストディレクトリの具体例の存在確認

確認観点はテンプレートに`src/phases/__tests__`というパスが含まれていることである。
期待結果として `expect(template).toContain('src/phases/__tests__')` がPassすることを確認する。
汎用的なディレクトリ説明ではなく、このプロジェクト固有の具体的なパスが含まれていることで、サブエージェントがより正確な配置判断を行えるようになる。

### FR-8: docs_updateフェーズのsubagentTemplate検証

FR-8に対応するテストは、docs_updateフェーズの`subagentTemplate`プロパティに更新許可ファイルと禁止ファイルのリストが追記されているかを検証するものである。
全テストケースで使用する共通セットアップとして、`resolvePhaseGuide('docs_update', 'docs/workflows/test')` を呼び出してsubagentTemplateを取得する。

#### TC-8-1: MEMORY.mdの禁止記述の存在確認

確認観点はdocs_updateフェーズのsubagentTemplateに`MEMORY.md`という文字列が含まれていることである。
期待結果として `expect(template).toContain('MEMORY.md')` がPassすることを確認する。
MEMORY.mdが明示的に禁止対象として記述されていることで、サブエージェントが誤ってユーザーのプロジェクトメモリファイルを編集することを防止できる。

#### TC-8-2: .claude/state/の禁止記述の存在確認

確認観点はテンプレートに`.claude/state/`という文字列が含まれていることである。
期待結果として `expect(template).toContain('.claude/state/')` がPassすることを確認する。
HMAC整合性チェックが設定されているこのディレクトリを直接編集するとワークフロー全体が動作不能になるため、禁止対象として明示することは極めて重要である。

#### TC-8-3: docs/spec/の更新許可記述の存在確認

確認観点はテンプレートに`docs/spec/`という文字列が含まれていることである。
期待結果として `expect(template).toContain('docs/spec/')` がPassすることを確認する。
更新が許可されているディレクトリを明示することで、サブエージェントが更新の上限範囲を正しく理解できるようになる。

#### TC-8-4: docs/workflows/の禁止記述の存在確認

確認観点はテンプレートに`docs/workflows/`という文字列が含まれていることである。
期待結果として `expect(template).toContain('docs/workflows/')` がPassすることを確認する。
一時的な作業フォルダである`docs/workflows/`を更新対象に含めることは設計上の誤りであり、この記述によりサブエージェントが除外対象として認識できることが必要である。

#### TC-8-5: 既存のドキュメント更新指示が保持されていることの確認（リグレッション防止）

確認観点はFR-8の追記後も、既存の「ドキュメントを更新してください」という記述がテンプレート内に残存していることである。
期待結果として `expect(template).toContain('ドキュメントを更新してください')` がPassすることを確認する。
この確認により、追記が既存の1行指示を削除・置換していないことを保証する。

#### TC-8-6: 更新対象が存在しない場合の取り扱い記述の存在確認

確認観点はテンプレートに「更新対象が存在しない」または「永続ドキュメント」に関する文字列が含まれていることである。
期待結果として `expect(template).toContain('永続')` がPassすることを確認する。
永続ドキュメントへの反映という本フェーズの目的がテンプレートに明記されていることで、サブエージェントが更新対象の優先順位を正しく把握できるようになる。

### リグレッション検証: 既存フェーズプロパティの不変性確認

FR-6・FR-7・FR-8の修正は文字列追記のみであり、他のプロパティを変更してはならない。
以下のテストケースは変更によって既存プロパティが壊れていないことを確認するリグレッション防止テストである。

#### TC-R-1: testingフェーズのphaseName不変性

確認観点はtestingフェーズの`phaseName`が`'testing'`のままであることである。
期待結果として `expect(phaseGuide?.phaseName ?? 'testing').toBe('testing')` に相当する検証がPassすることを確認する。
subagentTemplateの追記によりphaseName等の構造プロパティが変化していないことを確認する。

#### TC-R-2: test_implフェーズのphaseName不変性

確認観点はtest_implフェーズの`phaseName`が`'test_impl'`のままであることである。
期待結果として対応する検証がPassすることを確認し、追記によるプロパティ破損がないことを保証する。

#### TC-R-3: docs_updateフェーズのphaseName不変性

確認観点はdocs_updateフェーズの`phaseName`が`'docs_update'`のままであることである。
期待結果として対応する検証がPassすることを確認し、追記によるプロパティ破損がないことを保証する。

## 実装対象ファイル

### ソースファイル（修正対象）

修正対象のソースファイルは1件のみであり、絶対パスは以下のとおりである。
`C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`

このファイルのtesting・test_impl・docs_updateの3フェーズの`subagentTemplate`プロパティに追記を行う。
追記後は `workflow-plugin/mcp-server` ディレクトリで `npm run build` を実行してTypeScriptをコンパイルすること。

### テストファイル（新規作成対象）

新規作成するテストファイルの絶対パスは以下のとおりである。
`C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\__tests__\definitions-subagent-template.test.ts`

このファイルにTR-6・FR-7・FR-8・リグレッション防止に関する全テストケースを実装する。
既存の `definitions.test.ts` と同じ `import` 構成を使用し、依存関係を最小限に抑える。

### 既存テストファイル（回帰確認対象）

修正後に以下の既存テストファイルの全テストがPassすることを確認する。
`C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\__tests__\definitions.test.ts`
`C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\__tests__\next-artifact-check.test.ts`

これらのテストはフェーズ遷移ロジックと成果物チェックロジックを検証しており、今回の修正で影響を受けないことが前提であるが、回帰確認として実行することでsubagentTemplate以外の変更がないことを保証する。

## テスト実行コマンド

テストの実行はimplementationフェーズが完了した後、以下の順序で行う。
第1ステップはビルドの実行であり、`workflow-plugin/mcp-server`ディレクトリで`npm run build`を実行して修正をdist配下に反映する。
第2ステップは新規テストの実行であり、`workflow-plugin/mcp-server`ディレクトリで `npx vitest run src/phases/__tests__/definitions-subagent-template.test.ts` を実行する。
第3ステップは回帰テストの実行であり、`workflow-plugin/mcp-server`ディレクトリで `npx vitest run src/phases/__tests__/definitions.test.ts` を実行する。
第4ステップは全テストスイートの実行であり、`workflow-plugin/mcp-server`ディレクトリで `npx vitest run` を実行して全テストがPassすることを確認する。
