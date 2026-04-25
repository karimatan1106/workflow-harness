# 仕様書: regression_test サブエージェントの workflow_capture_baseline 誤用防止ガイダンス追加

## サマリー

- 目的: definitions.ts の regression_test.subagentTemplate に FR-13 と FR-14 の2つのガイダンスを追加し、subagent が workflow_capture_baseline を誤用するケースを設計レベルで防止する
- 主要な決定事項: 禁止ツールリストへの追記（FR-13）と新規セクションの挿入（FR-14）を、既存テンプレートの末尾付近に追加する形で実装する
- 変更対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts` の regression_test エントリの subagentTemplate フィールドのみ
- 次フェーズで必要な情報: 現在の regression_test テンプレートの末尾文字列は「テスト実行とworkflow_record_test_result呼び出しが完了した後は、速やかに処理を終了してOrchestratorに制御を返すこと。」で終わっている。この末尾の直前に FR-14 のセクション、同行の禁止対象リストに FR-13 の追記を行う
- NF-3 に従い、実装後は npm run build でトランスパイルし MCP サーバーを再起動することが必要となる

## 概要

regression_test フェーズの subagentTemplate に存在するガイダンスの欠落を補うための修正仕様である。
現在のテンプレートには「ワークフロー制御ツール禁止」セクションがあるが、workflow_capture_baseline がリストに含まれておらず、subagent が誤用する可能性がある。
また、ベースラインの前提条件（testing フェーズで記録済みであること）が明記されていないため、subagent が regression_test フェーズで再度ベースラインを記録しようとするリスクがある。
この修正は definitions.ts の regression_test エントリの subagentTemplate フィールドのみを対象とし、他のフェーズテンプレートへの変更は行わない。
修正後は既存のワークフロー制御ツール禁止セクションと整合した記述スタイルを保つ必要がある。
修正範囲が最小限であることから、既存テストが全て通過することが期待される。

## 実装計画

### FR-13: 禁止ツールリストへの workflow_capture_baseline 追加

現在のテンプレートの「★ワークフロー制御ツール禁止★」セクションに変更を加える。
変更の内容は、禁止対象のカンマ区切りリストの末尾に `workflow_capture_baseline` を追記することである。
この追記により、subagent はプロンプト参照時点で当該ツールが禁止されていることを認識できる。

変更前の禁止対象行の内容は以下の通りである（現在の文字列）:

```
禁止対象: workflow_next, workflow_approve, workflow_complete_sub, workflow_start, workflow_reset
```

変更後の禁止対象行の内容は以下の通りとなる（追加後の文字列）:

```
禁止対象: workflow_next, workflow_approve, workflow_complete_sub, workflow_start, workflow_reset, workflow_capture_baseline
```

禁止対象リストに `workflow_capture_baseline` を追加した直後に、禁止の根拠を説明する1文を追加する必要がある。
この説明文は subagent が「なぜ禁止なのか」を理解し、意図的な誤用を防ぐために重要である。
追加する説明文の内容は、workflow_capture_baseline は testing フェーズでのみ MCP サーバーが受け付ける設計であり、regression_test フェーズからの呼び出しはアーキテクチャ上エラーとなるという趣旨とする。

### FR-14: 「ベースライン前提条件」セクションの追加

「★ワークフロー制御ツール禁止★」セクションの直前に新規セクションを挿入する。
挿入位置は「sessionTokenの取得方法と使用制限」セクションの直後であり、かつ「★ワークフロー制御ツール禁止★」セクションの直前である。
このセクションを追加する理由は、subagent がベースライン記録の責任範囲を正しく把握するためである。
testing フェーズと regression_test フェーズの役割分担を明確にすることで、ベースライン関連ツールの誤用を防止できる。

追加するセクション見出しは「ベースライン前提条件」とし、以下の4点を記載する:

1点目として、ベースラインは testing フェーズで workflow_capture_baseline を呼び出して記録済みであることが前提条件であるという説明を記載する。

2点目として、regression_test フェーズでは workflow_capture_baseline を再度呼び出す必要はなく、呼び出してもMCPサーバーがアーキテクチャ上エラーを返すという説明を記載する。

3点目として、ベースライン情報の確認手段として workflow_get_test_info を使用できるという案内を記載する。このツールは regression_test フェーズでも使用可能であるため、確認操作自体は問題ない。

4点目として、ベースラインが未設定の状態で regression_test フェーズに遷移してきた場合は、Orchestrator が workflow_back を使用して testing フェーズへ差し戻す必要があるという手順を記載する。

### テストケースの追加（TC-FIX-1・TC-FIX-2）

definitions.ts の変更に合わせて、テストスイートに2つのテストケースを追加する。
テストファイルのパスは `workflow-plugin/mcp-server/src/__tests__/definitions-subagent-template.test.ts` を想定する。
追加するテストケースの内容と目的は以下の通りである。

TC-FIX-1 の目的は、regression_test の subagentTemplate に「workflow_capture_baseline」が禁止対象として含まれることを検証することである。
具体的には、subagentTemplate 文字列の中に「workflow_capture_baseline」という文字列が出現し、かつその文脈が禁止を示す内容であることを確認する。

TC-FIX-2 の目的は、regression_test の subagentTemplate に「ベースライン前提条件」セクションが含まれることを検証することである。
具体的には、subagentTemplate 文字列の中に「ベースライン前提条件」という文字列が出現することを確認する。

### 変更後のテンプレート末尾構造

変更後の regression_test.subagentTemplate の末尾部分がどのような構造になるかを散文で説明する。
まず既存の「workflow_record_test_result 注意セクション」が続き、その後に既存の「sessionTokenの取得方法と使用制限」セクションが来る。
続いて、FR-14 で新規追加する「ベースライン前提条件」セクションが挿入される。
最後に、FR-13 で `workflow_capture_baseline` を追記済みの「★ワークフロー制御ツール禁止★」セクションが配置される構造となる。
この順序により、subagent はまずセッショントークンの制約を把握し、次にベースライン操作の前提を把握し、最後に禁止ツールの全リストを確認する流れとなる。

## 変更対象ファイル

変更対象ファイルは1つのみであり、パスは `workflow-plugin/mcp-server/src/phases/definitions.ts` である。
このファイルの regression_test エントリの subagentTemplate フィールドのみを変更対象とする。
変更の性質は文字列テンプレートへの追記（既存セクションのカンマ区切りリストへの要素追加と、新規セクションの挿入）であり、既存ロジックの書き換えは行わない。
テストファイルとして `workflow-plugin/mcp-server/src/__tests__/definitions-subagent-template.test.ts` に2テストケースを追加する。
変更後にビルド手順として `cd workflow-plugin/mcp-server && npm run build` を実行してトランスパイルすることが必要であり、この手順を省略すると変更が MCP サーバーに反映されない。
MCP サーバープロセスの再起動は CLAUDE.md のルール22に従い必須であり、再起動後に workflow_status でフェーズ確認を行う。

## 受入条件の確認方法

FR-13 の確認は、変更後の definitions.ts の regression_test.subagentTemplate フィールドに文字列「workflow_capture_baseline」が禁止対象として含まれていることを Grep または Read ツールで確認することで実施する。
FR-13 の追加確認として、「testing フェーズでのみ MCP サーバーが受け付ける」という趣旨の説明文が禁止対象行の直後に存在することを Read ツールで確認する。
FR-14 の確認は、変更後の subagentTemplate に「ベースライン前提条件」というセクション見出しが含まれていることを Grep ツールで確認することで実施する。
FR-14 の追加確認として、「workflow_get_test_info」という文字列がベースライン前提条件セクション内に存在することを Grep ツールで確認する。
既存テストの通過確認は `cd workflow-plugin/mcp-server && npm test` を実行し、変更前と同数以上のテストが通過することで確認する。
TC-FIX-1 と TC-FIX-2 の新規テストケースも合わせてパスすることを確認する。
