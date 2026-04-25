# ワークフロー実行時問題の根本原因修正 - 仕様書

## サマリー

本仕様書は、前回ワークフロー実行中に発生した5つの問題の根本原因修正に関する実装仕様を定義する。
修正対象ファイルは `workflow-plugin/mcp-server/src/phases/definitions.ts` 1ファイルと `CLAUDE.md` 1ファイルである。
主要な決定事項として、FR-1はCLAUDE.mdのドキュメントを実装の事実（4フェーズが承認必要）に合わせて更新する。
FR-2・FR-3はtestingフェーズのsubagentTemplateにsessionToken取得方法と生出力要件を追記する。
FR-4・FR-5はtesting・regression_testの両テンプレートにワークフロー制御ツール禁止指示を追加する。
次フェーズ（test_design）では、本仕様書に記載した各FRの変更内容をテストケースとして具体化すること。
既存テスト912件のリグレッション確認を実施し、全件パスを検証することが必須要件である。

---

## 概要

### 修正の背景と根本原因

前回のワークフロー実行において、以下の5つの問題が発生した。各問題はコードの動作と文書・テンプレートの記述の乖離、あるいはテンプレートへの制約記述の欠落が原因であることをresearch・requirementsフェーズで特定済みである。

問題1の根本原因は、test_designフェーズで `workflow_approve` の呼び出しが必要だったにもかかわらず、CLAUDE.mdが「design_reviewとcode_reviewのみ承認必要」と示唆する記述になっていたことである。コードレベルでは `REVIEW_PHASES` 配列（definitions.ts 358行目）に4フェーズが一貫して定義されているが、ドキュメントがその実態を反映していなかった。

問題2の根本原因は、testingフェーズのsubagentTemplateに `sessionToken` の正しい取得経路の説明が欠落していたことである。subagentはOrchestratorからプロンプト引数として `sessionToken` を受け取るべきだが、そのガイダンスが存在しなかった。

問題3の根本原因は、`workflow_record_test_result` に加工・要約した出力を渡すことが許容されないという要件がテンプレートに明記されていなかったことである。真正性検証（validateTestAuthenticity）は100文字以上の生の標準出力を必要とする。

問題4の根本原因は、testingフェーズのsubagentTemplateにワークフロー制御ツール（workflow_next等）の呼び出し禁止指示が存在しなかったことである。sessionTokenを保有したsubagentが技術的にフェーズ制御を実行できてしまう状態だった。

問題5の根本原因は、regression_testフェーズのsubagentTemplateにも同様のワークフロー制御ツール禁止指示が存在しなかったことである。前回の障害では、regression_testサブエージェントがworkflow_nextを連続して呼び出し、parallel_verificationの全4サブフェーズを実行してしまった。

### 修正方針の概要

5つの問題に対応する5つの修正（FR-1からFR-5）を実施する。修正の性質はテンプレート文字列の追記とドキュメントの更新のみであり、実行ロジックへの変更は行わない。この方針により、既存テスト912件に対するリグレッションリスクを最小化する。

FR-1はCLAUDE.mdのドキュメント更新であり、他のFRと独立して実施可能である。FR-2からFR-5はdefinitions.tsのテンプレート文字列への追記であり、ビルドおよびMCPサーバー再起動が必要となる。

---

## 実装計画

### FR-1: CLAUDE.mdの承認フェーズ記述修正

**修正ファイル:** `C:\ツール\Workflow\CLAUDE.md`

**変更箇所1 - 必須コマンド一覧（627行目）**

現状の627行目の記述は `/workflow approve design` コマンドの説明が「design_reviewフェーズのみ」となっており、requirements・test_design・code_reviewの3フェーズへの言及がない。この1行を4行に展開して変更する。

変更前（627行目）:
```
| `/workflow approve design` | 設計レビューを承認（design_reviewフェーズのみ） |
```

変更後（627行目を以下の4行に置き換える）:
```
| `/workflow approve requirements` | 要件定義レビューを承認（requirementsフェーズ） |
| `/workflow approve design` | 設計レビューを承認（design_reviewフェーズ） |
| `/workflow approve test_design` | テスト設計レビューを承認（test_designフェーズ） |
| `/workflow approve code_review` | コードレビューを承認（code_reviewフェーズ） |
```

**変更箇所2 - AIへの厳命セクション（643行目）**

現状の7番目の厳命は「design_reviewフェーズでは必ずユーザー承認を待つ」のみであり、他の3フェーズへの言及がない。この1行を複数行の指示に変更する。

変更前（643行目）:
```
7. **design_reviewフェーズでは必ずユーザー承認を待つ**
```

変更後（643行目を以下の内容に置き換える）:
```
7. **requirements/design_review/test_design/code_reviewの4フェーズでは必ずworkflow_approveを呼び出してユーザー承認を待つ**
   - requirementsフェーズ: `workflow_approve type="requirements"` を呼び出す
   - design_reviewフェーズ: `workflow_approve type="design"` を呼び出す
   - test_designフェーズ: `workflow_approve type="test_design"` を呼び出す
   - code_reviewフェーズ: `workflow_approve type="code_review"` を呼び出す
```

### FR-2: testingフェーズのsubagentTemplateにsessionToken取得方法を追記

**修正ファイル（FR-2対象）:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`

**変更箇所:** 878行目の `subagentTemplate` プロパティ値（文字列末尾への追記）

現在のtestingテンプレート末尾文字列:
```
- 同一の出力テキストを重複して送信した場合もブロックエラーとなる'
```

この末尾のシングルクォート終端の直前に、以下のセクションを `\n\n` で区切って追記する:

```
\n\n## sessionTokenの取得方法と使用制限\n- sessionTokenはOrchestratorからプロンプトの引数として渡される値であり、このsubagent自身がMCPツールを呼び出して取得するものではない\n- Orchestratorがプロンプト内にsessionTokenを記載している場合はその値を使用する\n- sessionTokenを受け取らなかった場合は、workflow_record_test_resultのsessionToken引数を省略して呼び出す\n- sessionTokenは workflow_record_test_result 呼び出し時のみ使用し、他のいかなるMCPツール呼び出しにも使用しないこと
```

### FR-3: testingフェーズのsubagentTemplateに生出力要件を追記

**修正ファイル（FR-3対象）:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`

**変更箇所:** FR-2の追記内容の直後に連続して追記する

FR-2の追記内容末尾（sessionToken制限の最終行）の後に以下を連結する:

```
\n- workflow_record_test_result の output パラメータには100文字以上の生の標準出力が必要である\n- テストフレームワーク（vitest/jest/pytest等）が出力する集計行・パス結果・失敗詳細を含む完全な出力をそのまま貼り付けること\n- 出力を要約したり短縮したりした文字列ではなく、コマンド実行の完全な標準出力をそのまま使用すること\n- validateTestAuthenticity検証が実施されるため、加工・編集・要約した出力はエラーとなる
```

### FR-4: testingフェーズのsubagentTemplateにワークフロー制御ツール禁止指示を追加

**修正ファイル（FR-4対象）:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`

**変更箇所:** FR-2・FR-3の追記内容の直後に連続して追記する

FR-3の追記内容末尾の後に以下を連結する（testingテンプレートの最終部分となる）:

```
\n\n## ★ワークフロー制御ツール禁止★\nこのsubagentは以下のワークフロー制御ツールを絶対に呼び出してはならない。\n禁止対象: workflow_next, workflow_approve, workflow_complete_sub, workflow_start, workflow_reset\nsessionTokenを保有している場合であっても、これらのワークフロー制御ツールへのsessionTokenの使用は禁止である。\nこのsubagentの責任範囲はテスト実行と workflow_record_test_result による結果記録のみである。\nフェーズ遷移の制御はOrchestratorの専権事項であり、subagentが行ってはならない。\nテスト実行とworkflow_record_test_result呼び出しが完了した後は、速やかに処理を終了してOrchestratorに制御を返すこと。
```

### FR-5: regression_testフェーズのsubagentTemplateにワークフロー制御ツール禁止指示を追加

**修正ファイル（FR-5対象）:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`

**変更箇所:** 887行目の `subagentTemplate` プロパティ値（文字列末尾への追記）

現在のregression_testテンプレート末尾文字列:
```
- regression_testフェーズでは、同一の出力テキストを再送信した場合も記録が許可されている（他フェーズでは重複送信がブロックされるが、このフェーズは例外として扱われる）'
```

この末尾のシングルクォート終端の直前に、以下の2セクションを連続して追記する（NFR-2の一貫性要件に従い、FR-4と同一の禁止対象・文言を使用する）:

```
\n\n## sessionTokenの取得方法と使用制限\n- sessionTokenはOrchestratorからプロンプトの引数として渡される値であり、このsubagent自身がMCPツールを呼び出して取得するものではない\n- sessionTokenを受け取らなかった場合は、workflow_record_test_resultのsessionToken引数を省略して呼び出す\n- sessionTokenは workflow_record_test_result 呼び出し時のみ使用し、他のいかなるMCPツール呼び出しにも使用しないこと\n\n## ★ワークフロー制御ツール禁止★\nこのsubagentは以下のワークフロー制御ツールを絶対に呼び出してはならない。\n禁止対象: workflow_next, workflow_approve, workflow_complete_sub, workflow_start, workflow_reset\nsessionTokenを保有している場合であっても、これらのワークフロー制御ツールへのsessionTokenの使用は禁止である。\nこのsubagentの責任範囲はリグレッションテスト実行と workflow_record_test_result による結果記録のみである。\nフェーズ遷移の制御はOrchestratorの専権事項であり、subagentが行ってはならない。\nテスト実行とworkflow_record_test_result呼び出しが完了した後は、速やかに処理を終了してOrchestratorに制御を返すこと。
```

### 実装の順序と依存関係

FR-1（CLAUDE.md更新）は他の要件と独立しており、単独で実施可能である。implementationフェーズではFR-1を最初に実施することを推奨する。ビルド不要で即座に効果が確認できる変更であるため、先行実施することでその他の変更との混同を防げる。

FR-2・FR-3・FR-4は同一ファイル（definitions.ts）の同一テンプレート（testingフェーズのsubagentTemplate）への追記であり、一度の編集操作でまとめて実施することが効率的である。3つの追記内容を連続した文字列として一括追加し、編集回数を最小化する。

FR-5はdefinitions.tsのregression_testテンプレートへの追記であり、FR-2〜FR-4と同一ファイルの別箇所への変更となる。FR-2〜FR-4と同じ編集セッション内で連続して実施する。

全修正完了後に `npm run build` を実行してコンパイルエラーがないことを確認し、その後MCPサーバーを再起動する。再起動後に既存テスト912件の全件パスを確認する。

---

## 変更対象ファイル

### 変更ファイル1: CLAUDE.md

**絶対パス:** `C:\ツール\Workflow\CLAUDE.md`

**変更種別:** ドキュメント更新（FR-1対応）

**変更箇所の説明:** 必須コマンド一覧の `/workflow approve` 行（627行目）と、AIへの厳命の7番目の項目（643行目）を更新する。2箇所の変更により、Orchestratorが4つの承認フェーズ（requirements・design_review・test_design・code_review）それぞれで `workflow_approve` を呼び出す必要があることを正しく認識できるようになる。

**変更後の期待される状態:** 必須コマンド一覧に4行の `workflow_approve` コマンド行が存在し、AIへの厳命7番目が4フェーズの承認必要性を明記している状態になること。コードのREVIEW_PHASES定義（4フェーズ）とドキュメントの記述が一致していること。

**影響範囲の評価（FR-1固有）:** ドキュメントのみの変更であり、MCPサーバーの再起動は不要である。変更後のCLAUDE.mdはClaudeのセッション開始時に読み込まれるため、次回のセッションから効果が発揮される。

**リグレッションリスクの評価（FR-1固有）:** 実行ロジックへの影響がないためリスクは存在しない。

### 変更ファイル2: definitions.ts

**絶対パス:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`

**変更種別:** TypeScriptソースファイルの文字列リテラル追記（FR-2・FR-3・FR-4・FR-5対応）

**変更箇所1の説明（FR-2・FR-3・FR-4）:** 878行目の `testing` フェーズ定義内の `subagentTemplate` プロパティ値。現在は `'...- 同一の出力テキストを重複して送信した場合もブロックエラーとなる'` で終わっているテンプレート文字列の末尾に、sessionToken使用説明・生出力要件強調・ワークフロー制御ツール禁止指示の3セクションを追記する。

**変更箇所2の説明（FR-5）:** 887行目の `regression_test` フェーズ定義内の `subagentTemplate` プロパティ値。現在は `'...このフェーズは例外として扱われる）'` で終わっているテンプレート文字列の末尾に、sessionToken使用説明とワークフロー制御ツール禁止指示の2セクションを追記する。

**変更後に必要な作業の手順:**

1番目に `C:\ツール\Workflow\workflow-plugin\mcp-server\` ディレクトリで `npm run build` を実行してTypeScriptをトランスパイルする。2番目にコンパイルエラーがないことを確認する。3番目にMCPサーバーを再起動する（Claude Desktopのサーバー再起動ボタン使用）。4番目に再起動後に `workflow_status` で現在のフェーズを確認する。

**リグレッションリスクの評価（FR-2〜FR-5共通）:** テンプレート文字列への追記のみであり、実行ロジックの変更はない。ただし文字列の連結ミスによるJavaScript構文エラーが発生する可能性があるため、`npm run build` でコンパイルエラーがないことを確認することが必須である。

---

## 非機能要件の整理

本タスクに関連する非機能要件を4項目に整理して示す。各項目はFRに横断的に影響し、実装フェーズの作業手順設計において考慮が必要な事項である。

### NFR-1: 既存テスト912件のリグレッション防止

definitions.tsおよびCLAUDE.mdの修正後、既存のテストスイート912件が全件パスすることを確認する。修正はテンプレート文字列の追記とドキュメント更新のみであり、実行ロジックの変更は行わない。リグレッションリスクは低いが、`npm run build` および `npm test` を実行して全件パスを確認する手順を実装フェーズに含めることを必須とする。テスト実行はtestingフェーズで行い、結果を workflow_capture_baseline で記録しておくこと。

### NFR-2: FR-4とFR-5の禁止指示の一貫性維持

testing（FR-4）とregression_test（FR-5）の禁止指示は同一の文言・禁止対象リストとする。将来のメンテナンス時に両テンプレートの記述が乖離することを防ぐため、禁止ツールのリストを変更する場合は必ず両テンプレートを同時に更新すること。sessionTokenの使用制限に関する説明文も両テンプレートで同一の表現を使用すること。両テンプレートの禁止指示が一致していることをコードレビュー時に確認すること。

### NFR-3: テンプレートの可読性維持

追記内容は既存のテンプレート構造（`##` セクション見出し・Markdownフォーマット・箇条書き）に合わせること。追記後のテンプレート全体が整合的な文書として読めることを確認すること。新しいセクションは末尾に追記する形式を採用し、既存の注意事項セクションの内容を変更しないこと。

### NFR-4: MCPサーバー再起動後の動作検証

definitions.tsを修正してビルドした後、MCPサーバーを再起動することで変更が有効になることを確認する。Node.jsのモジュールキャッシュにより、再起動前は変更が反映されない点を考慮して検証手順を設計すること。再起動後は `workflow_status` で現在のフェーズを確認し、同フェーズから作業を再開すること。

---

## 受け入れ基準

以下の条件が全て満たされた時点で本タスクの実装フェーズが完了となる。

CLAUDE.mdの「必須コマンド」セクションに `workflow_approve requirements`・`workflow_approve design`・`workflow_approve test_design`・`workflow_approve code_review` の4コマンドが記載されていること。

CLAUDE.mdの「AIへの厳命」7番目の項目が4フェーズの承認必要性を明記しており、test_designフェーズでも `workflow_approve` の呼び出しが必要であることが明確であること。

definitions.tsのtestingテンプレートに `sessionToken` の取得方法（Orchestratorからプロンプト引数として受け取る）が明記されていること。また `workflow_record_test_result` に完全な標準出力（100文字以上）を渡す必要性が記載されていること。さらに workflow_next 等5つのワークフロー制御ツールの呼び出し禁止指示が含まれていること。

definitions.tsのregression_testテンプレートに workflow_next 等5つのワークフロー制御ツールの呼び出し禁止指示が含まれていること。前回の障害（regression_testサブエージェントがparallel_verificationを自律実行した問題）の再発防止が期待されること。

`npm run build` が成功しコンパイルエラーが存在しないこと。既存テスト912件が全件パスすること。
