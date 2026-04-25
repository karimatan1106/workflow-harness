# ワークフロー実行時問題の根本原因修正 - 要件定義

## サマリー

本要件定義は、前回のワークフロー実行中に発生した5つの問題の根本原因に対する修正要件を定義する。
修正対象の中心は `workflow-plugin/mcp-server/src/phases/definitions.ts` であり、テンプレート不備とドキュメント記述の乖離を解消する。

主要な決定事項は以下の通りである。

- 問題1（test_design承認問題）については CLAUDE.md をコードの実装に合わせて更新する方針を採用する。コードの `REVIEW_PHASES` には4フェーズが一貫して定義されており、この実装を正として扱う。
- 問題2・3（testingテンプレート不備）については `sessionToken` の取得方法・使用方法・生出力要件をテンプレートに明記する。
- 問題4・5（ワークフロー制御ツール禁止指示の欠落）については `testing` および `regression_test` 両テンプレートに禁止指示セクションを追加する。

次フェーズ（planning）で必要な情報として、修正対象ファイルは `definitions.ts` 1ファイルと `CLAUDE.md` 1ファイルであることを確認している。テスト件数は912件であり、修正後のリグレッション確認が必要である。

---

## 機能要件

### FR-1: CLAUDE.md の承認フェーズ記述を実態に合わせて更新する

CLAUDE.md の「design_review と code_review のみ承認必要」という趣旨の記述を、コード実装の事実（4フェーズが承認必要）に合わせて修正すること。
具体的には `requirements`・`design_review`・`test_design`・`code_review` の4フェーズが承認を必要とすることを CLAUDE.md に明記する。
REVIEW_PHASES のコード（definitions.ts 358行目）は変更しない。既存の実装が設計意図に沿っていることを確認済みであるため、ドキュメント側を現実に合わせる。
この修正により Orchestrator が `test_design` フェーズで `workflow_approve` の呼び出しが必要であることを正しく認識できるようになる。
修正箇所は CLAUDE.md のフェーズ詳細説明セクションおよびワークフロー操作コマンド一覧の `workflow_approve` に関する説明行である。

### FR-2: testingフェーズのsubagentTemplateにsessionToken取得方法を追記する

`definitions.ts` 内の `testing` フェーズの subagentTemplate（878行目付近）に、以下の内容を追記すること。
`sessionToken` は MCP ツールを使って自分で取得するのではなく、Orchestrator からプロンプト引数として受け取るものであることを明示する。
受け取った `sessionToken` は `workflow_record_test_result` 呼び出し時のみ使用し、他の MCP ツール呼び出しには使用しないことを明示する。
`sessionToken` を受け取らなかった場合は、引数を省略して `workflow_record_test_result` を呼び出すことを明示する。
この要件により subagent が sessionToken エラーで失敗するケースを防止する。

### FR-3: testingフェーズのsubagentTemplateに生出力要件を明記する

`definitions.ts` 内の `testing` フェーズの subagentTemplate において、`workflow_record_test_result` の `output` パラメータにはテストコマンドの生の標準出力をそのまま渡す必要があることを強調する。
出力は100文字以上必要であること、テストフレームワーク（vitest/jest/pytest等）が出力する集計行・パス結果・失敗詳細を含む完全な出力をそのまま貼り付けることを記載する。
要約したり短縮したりした出力ではなく、コマンド実行の完全な標準出力を使用することを必須要件として明記する。
`validateTestAuthenticity` 検証が実施されるため、加工・編集・要約した出力はエラーとなる旨も併せて記載する。

### FR-4: testingフェーズのsubagentTemplateにワークフロー制御ツール禁止指示を追加する

`definitions.ts` 内の `testing` フェーズの subagentTemplate に、以下の内容を含む「ワークフロー制御禁止」セクションを追加すること。
禁止対象ツールとして `workflow_next`・`workflow_approve`・`workflow_complete_sub`・`workflow_start`・`workflow_reset` を明示する。
`sessionToken` を保有している場合でも、これらのワークフロー制御ツールへの使用は禁止であることを明記する。
このサブエージェントの責任範囲はテスト実行と結果記録のみであり、フェーズ遷移の制御は Orchestrator の専権事項であることを記載する。
テスト実行と `workflow_record_test_result` 呼び出しが完了した後は、速やかに処理を終了してOrchestratorに制御を返すことを明記する。

### FR-5: regression_testフェーズのsubagentTemplateにワークフロー制御ツール禁止指示を追加する

`definitions.ts` 内の `regression_test` フェーズの subagentTemplate（887行目付近）に、FR-4 と同様の「ワークフロー制御禁止」セクションを追加すること。
禁止対象ツールは FR-4 と同一とする（`workflow_next`・`workflow_approve`・`workflow_complete_sub`・`workflow_start`・`workflow_reset`）。
`sessionToken` を使用できるのは `workflow_record_test_result` のみであることを明示する。
前回の障害では regression_test サブエージェントが `workflow_next` を連続して呼び出し `parallel_verification` の全4サブフェーズを実行した。この再発防止のため、テンプレートレベルで明示的な禁止指示を設ける。
テスト実行と結果記録が完了した後は、速やかに処理を終了してOrchestratorに制御を返すことを明記する。

---

## 非機能要件

### NFR-1: 既存テストのリグレッションを発生させない

`definitions.ts` および `CLAUDE.md` の修正後、既存のテストスイート912件が全件パスすることを確認すること。
修正はテンプレート文字列の追記と CLAUDE.md のドキュメント更新のみであり、実行ロジックの変更は行わない。
リグレッションリスクは低いが、念のためテスト実行による確認を必須とする。
`npm run build` および `npm test` を実行し、全件パスを確認する手順を実装フェーズに含める。

### NFR-2: 修正内容の一貫性を保つ

FR-4 と FR-5 の禁止指示は同一の文言・構成とし、将来のメンテナンス時の混乱を避けること。
両テンプレートで異なる禁止ツールリストを記載することは禁止とする。
禁止ツールのリストを変更する場合は testing と regression_test の両テンプレートを必ず同時に更新することをコメントとして記載することが望ましい。
sessionToken の使用制限に関する説明文も両テンプレートで同一とする。

### NFR-3: テンプレートの可読性を維持する

追記内容は既存のテンプレート構造（セクション区切り・Markdownフォーマット）に合わせること。
既存の注意事項セクションに追加するか、新しいセクションとして末尾に追記するかは、実装フェーズで判断する。
追記後のテンプレート全体が整合的な文書として読めることを確認すること。
箇条書き・セクション見出しの形式は既存部分と揃えること。

### NFR-4: MCPサーバー再起動後に変更が有効になること

`definitions.ts` を修正してビルド（`npm run build`）した後、MCPサーバーを再起動することで変更が有効になることを確認すること。
Node.js のモジュールキャッシュにより、再起動前は変更が反映されない点を考慮してテスト・検証の手順を設計すること。
CLAUDE.md の変更は再起動不要であるが、definitions.ts の変更は必ずビルド・再起動セットで検証すること。
再起動後は `workflow_status` で現在のフェーズを確認し、同フェーズから作業を再開すること。

---

## 修正対象ファイル一覧

以下のファイルが本タスクの修正対象である。

- `workflow-plugin/mcp-server/src/phases/definitions.ts`: testing テンプレート（878行目付近）と regression_test テンプレート（887行目付近）の2箇所に追記（FR-2, FR-3, FR-4, FR-5）
- `CLAUDE.md`: 承認フェーズの記述（design_review と code_review のみという記述）を4フェーズに更新（FR-1）

---

## 修正の優先順位と依存関係

5つの機能要件の優先順位と依存関係を以下に示す。

FR-1（CLAUDE.md 更新）は他の要件と独立しており、単独で実施可能である。
FR-2（sessionToken 追記）と FR-3（生出力要件）は同一ファイルの同一テンプレートへの追記であり、同時に実施することが効率的である。
FR-4（testing 制御禁止）と FR-5（regression_test 制御禁止）も同一ファイルへの追記であり、同時実施が望ましい。
全ての修正完了後に NFR-1 のリグレッション確認を実施する。

---

## 受け入れ基準

本タスクの完了条件は以下の通りである。

- CLAUDE.md の承認フェーズ一覧に requirements・design_review・test_design・code_review の4フェーズが明記されていること
- testing の subagentTemplate に sessionToken の取得方法（Orchestrator から引数として受け取る）が明記されていること
- testing の subagentTemplate に workflow_record_test_result への完全な標準出力の渡し方が明記されていること
- testing の subagentTemplate に workflow_next 等のワークフロー制御ツール禁止指示が含まれていること
- regression_test の subagentTemplate に workflow_next 等のワークフロー制御ツール禁止指示が含まれていること
- 全修正後に既存テスト912件が全件パスすること
