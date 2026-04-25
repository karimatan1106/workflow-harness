## サマリー

- 目的: FR-A〜FR-Eの修正に関するCLI/APIインターフェース設計を定義し、Orchestratorとsubagentの正しい操作フローを明確にする。
- 主要な決定事項: workflow_statusはtaskId指定必須とし、taskIdなし呼び出しではsessionTokenが返されない仕様を前提とした設計とする。
- 修正対象のAPIレスポンス: `workflow_status` のtaskId有無による2モードの差異をOrchestratorへ明示的に示す。
- definitions.tsのテンプレート変更: FR-A/B/C1/C2の各ガイダンスセクション追加内容と配置位置を設計する。
- 次フェーズで必要な情報: implementationフェーズではこのui-design.mdの設計に従い、definitions.tsとCLAUDE.mdを変更すること。

---

## CLIインターフェース設計

本タスクの対象はCLIベースのMCPサーバーであり、Orchestratorがワークフロー制御ツールを呼び出す際の操作インターフェースを設計する。

### workflow_status の正しい呼び出し方

Orchestratorがセッション再開後にsessionTokenを取得する際の正しい手順は以下の通りである。

正しい呼び出し方（taskId指定あり）:
```
workflow_status({ taskId: "20260228_153407" })
```
この形式では、指定されたタスクの詳細情報（currentPhase, sessionToken, scopeInfo等）が返される。sessionTokenを取得するには必ずこの形式を使用すること。

誤った呼び出し方（taskId指定なし）:
```
workflow_status({})
```
この形式では `allTasks` リストのみが返され、個別タスクのsessionTokenは含まれない。セッション再開後にこの形式でworkflow_statusを呼び出してもsessionTokenを取得できないため、workflow_record_test_resultが認証エラーになる原因となる。

### workflow_list によるtaskId事前確認手順

taskIdが不明の場合は以下の2ステップで取得する。

ステップ1: `workflow_list({})` を呼び出してアクティブなタスクの一覧を取得する。一覧にはtaskId・taskName・currentPhaseが含まれる。

ステップ2: 目的のタスクのtaskIdを確認後、`workflow_status({ taskId: "確認したtaskId" })` を呼び出してsessionTokenを取得する。

この2ステップの手順はCLAUDE.mdの厳命23番（FR-D修正後）に明記される設計となっている。Orchestratorがこの手順を省略してtaskIdなしでworkflow_statusを呼び出した場合は、sessionTokenが返されずに後続の処理が失敗する。

### subagentの禁止操作

subagentはworkflow_next・workflow_approve・workflow_complete_sub・workflow_start・workflow_resetを呼び出してはならない。これらのワークフロー制御ツールへのアクセスを技術的に制限することは現行の設計では難しいため、テンプレート文字列へのガイダンス追記によって確率的失敗を低減する方針をとっている。

---

## エラーメッセージ設計

### sessionToken未取得エラーのパターン

「sessionTokenが必要です」というエラーが発生する原因は、Orchestratorがworkflow_statusをtaskId指定なしで呼び出した場合である。このエラーが発生した場合の対処方法は以下の通り。

対処手順1: workflow_listでアクティブなタスクのtaskIdを確認する。
対処手順2: workflow_status({ taskId: "取得したID" })を呼び出してsessionTokenを再取得する。
対処手順3: 取得したsessionTokenをworkflow_record_test_resultの引数として渡す。

このエラーはCLAUDE.mdの厳命23番にtaskId必須の記載がなかったことが根本原因である（FR-D）。

### バリデーション失敗メッセージのフォーマット

artifact-validatorがsubagentの成果物を検証し、失敗した場合に返すメッセージの形式は以下の通りである。

重複行エラーのメッセージ形式: 「同一行が3回以上出現しました: 'エラーになった行の内容'」。このメッセージを受け取ったOrchestratorは、問題の行の内容をリトライプロンプトに含め、subagentを再起動して修正を依頼すること。

セクション密度不足エラーのメッセージ形式: 「セクション '## セクション名' の実質行数が不足しています（現在N行、必要5行）」。このメッセージを受け取ったOrchestratorは、該当セクションに実質行を追加するよう修正指示をsubagentに渡すこと。

禁止語検出エラーのメッセージ形式: 「禁止語 '検出された語句' が成果物に含まれています」。このメッセージを受け取ったOrchestratorは、禁止語を間接参照（「バリデーターが検出した語句」等）で示しつつ、具体的な言い換え例をリトライプロンプトに含めること。

### ビルドエラーのフォーマット

TypeScriptコンパイルエラーが発生した場合は、`npm run build` コマンドの出力にエラーの場所（ファイルパス・行番号）と理由が表示される。definitions.tsのテンプレート文字列変更後にビルドエラーが発生した場合、最も可能性が高い原因はシングルクォートのエスケープ漏れや、テンプレートリテラルの誤混入である。

---

## APIレスポンス設計

### workflow_status の2モード設計

`workflow_status` APIは呼び出し時のtaskId有無によって返却内容が異なる。

**モード1: taskId指定あり（詳細モード）**

```json
{
  "taskId": "20260228_153407",
  "taskName": "修正プロセス中の問題根本原因調査2",
  "currentPhase": "ui_design",
  "sessionToken": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "scopeInfo": { "files": [...], "dirs": [...] },
  "phaseGuide": { "allowedBashCategories": [...] }
}
```

taskId指定ありの場合、sessionTokenが必ず含まれる。sessionTokenはHMAC-SHA256で保護されており、workflow_record_test_result呼び出しの認証に使用される。Orchestratorはセッション再開後に必ずこのモードでworkflow_statusを呼び出すこと。

**モード2: taskId指定なし（一覧モード）**

```json
{
  "allTasks": [
    {
      "taskId": "20260228_153407",
      "taskName": "修正プロセス中の問題根本原因調査2",
      "currentPhase": "ui_design"
    }
  ]
}
```

taskId指定なしの場合、sessionTokenは含まれない。一覧モードはtaskIdを確認する目的にのみ使用し、sessionToken取得目的には使用しないこと。このモードを誤ってsessionToken取得目的に使用することがFR-Dで報告された障害の根本原因である。

### workflow_list APIレスポンス

```json
{
  "tasks": [
    {
      "taskId": "20260228_153407",
      "taskName": "修正プロセス中の問題根本原因調査2",
      "currentPhase": "ui_design"
    }
  ]
}
```

workflow_listはtaskIdの一覧確認に特化したAPIであり、sessionTokenを含まない。workflow_statusとの使い分けとして、taskId確認にはworkflow_listを、sessionToken取得にはtaskId指定のworkflow_statusを使用する。

workflow_statusとworkflow_listの2つのAPIを適切に使い分けることで、Orchestratorはsessionトークンを正しく取得でき、workflow_record_test_resultの認証エラーを未然に防ぐことができる。

---

## 設定ファイル設計

### definitions.ts のサブエージェントテンプレート文字列構造

`workflow-plugin/mcp-server/src/phases/definitions.ts` のsubagentTemplateはシングルクォートで囲まれた文字列として定義されており、改行は `\n` でエスケープされている。各フェーズのテンプレートには以下の標準セクションが含まれる。

テンプレートの標準セクション構成は以下の通りである。

サマリーセクション必須化（REQ-4）セクション: 全フェーズ共通で含まれる。成果物の先頭にサマリーセクションを配置するよう指示する。

Bashコマンド制限セクション: フェーズごとに許可されるコマンドカテゴリが異なる。各テンプレートに埋め込まれる。

成果物品質要件セクション: バリデーター要件（行数・密度・禁止語・重複行・必須セクション）を記述する。

ワークフロー制御ツール禁止セクション（FR-19追加済み）: 全25フェーズのテンプレートに含まれる。subagentがworkflow_nextなどを呼び出すことを禁止する指示である。

フェーズ固有ガイダンスセクション: 各フェーズで発生しやすいバリデーション失敗を防ぐための特化ガイダンス。FR-A/B/C1/C2はこの部分への追記として実装される。

### FR-A/B/C1/C2 の追記位置設計

FR-Aの追記位置（manual_test）: テンプレート内の「## 実行日時・環境情報行の一意化（FR-1）」セクションのMT-N形式説明部分の後に2行追加し、同セクションの末尾段落に1文追記する。この位置はmanual_testフェーズ特有のガイダンスが集約されている箇所であり、追記による既存ガイダンスへの干渉が最小化される。

FR-Bの追記位置（performance_test）: テンプレート内の「## 評価結論フレーズの重複回避（特化ガイダンス）」セクションの直後に「## 任意セクション追加時の行数要件（FR-B）」という新規セクションを挿入する。この位置はperformance_testフェーズ固有のガイダンスが集約されている箇所であり、新規セクションの追加が自然な文書構造となる。

FR-C1の挿入位置（e2e_test）: テンプレート内の「## テスト文書固有の角括弧禁止パターン（FR-3）」セクションの直前に「## 禁止語の部分一致検出に注意（FR-C1）」を挿入する。禁止語ガイダンスが集約される箇所に配置することで、subagentが関連するガイダンスをまとめて参照できる。

FR-C2の追記位置（e2e_test）: 「## テスト文書固有の角括弧禁止パターン（FR-3）」セクションの後、「## 出力」セクションの前に「## 総合評価セクションの記述指針（FR-C2）」を挿入する。manual_testのFR-11と対応する位置関係とすることで、両フェーズのガイダンス構造の一貫性を維持する。

### CLAUDE.md の厳命23番設計（FR-D）

CLAUDE.mdのAIへの厳命23番は、セッション再開後のsessionToken再取得手順を記述するセクションである。FR-D修正後の構成は以下の設計とする。

現行の4行構成から7行程度に拡張し、taskId指定の必須性を明示する。3行目にtaskId明示指定の例示（`workflow_status({ taskId: 'タスクID' })`）を追加する。4行目にtaskIdなし呼び出しではsessionTokenが返されない仕様の説明を追加する。5行目にworkflow_listを使ったtaskId事前確認手順を追加する。既存の6行目・7行目の記述は変更せず維持する。

このCLAUDE.mdの設計変更により、OrchestratorがsessionToken未取得エラーに遭遇する確率を低減することが目的である。技術的な強制ではなくガイダンス追記による確率的失敗低減の方針はFR-A/B/C1/C2と同様である。
