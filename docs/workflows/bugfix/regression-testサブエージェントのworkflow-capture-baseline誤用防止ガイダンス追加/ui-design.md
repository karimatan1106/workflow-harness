# UI設計: regression_test サブエージェントの workflow_capture_baseline 誤用防止ガイダンス追加

## サマリー

- 目的: このタスクは GUI や Web フロントエンドを持たない MCP サーバー内部のテンプレート修正であるため、「UI」はサブエージェントが受け取るプロンプトメッセージ（CLIインターフェース）として定義する
- 主要な決定事項: FR-13（禁止リストへの workflow_capture_baseline 追記）と FR-14（「ベースライン前提条件」セクション新規挿入）の2つのガイダンスを regression_test テンプレート末尾に追加する
- 変更対象インターフェース: `definitions.ts` の regression_test.subagentTemplate フィールドに埋め込まれたプロンプト文字列のみ
- テスト構造: TC-FIX-1 と TC-FIX-2 の2つのテストケースを新規追加してガイダンスの存在を保証する
- 次フェーズで必要な情報: 変更後のテンプレート末尾構造の順序（workflow_record_test_result 注意 → sessionToken 制限 → ベースライン前提条件 → ★ワークフロー制御ツール禁止★）を実装者が理解していること

## CLIインターフェース設計

このタスクが対象とする「UI」は、regression_test サブエージェントが起動時に受け取るプロンプトメッセージである。
プロンプトはテキスト形式のガイダンスとして機能し、サブエージェントの振る舞いを設計レベルで制約する。

### FR-13 の禁止メッセージ形式（変更前と変更後の比較）

変更前の禁止対象行は以下の内容で終わっていた。

```
禁止対象: workflow_next, workflow_approve, workflow_complete_sub, workflow_start, workflow_reset
```

変更後の禁止対象行は以下の内容となる。

```
禁止対象: workflow_next, workflow_approve, workflow_complete_sub, workflow_start, workflow_reset, workflow_capture_baseline
```

禁止対象行に `workflow_capture_baseline` を追記した直後に、禁止の根拠を説明する1文を挿入する。
この説明文の内容は「workflow_capture_baseline は testing フェーズでのみ MCP サーバーが受け付ける設計であり、regression_test フェーズからの呼び出しはアーキテクチャ上エラーとなる」という趣旨である。
メッセージのトーンは現行の禁止セクションと統一し、断定的な禁止表現（「〜を絶対に呼び出してはならない」「〜は禁止である」）を維持する。

### FR-14 のベースライン前提条件メッセージ形式

「ベースライン前提条件」というセクション見出しを持つ新規セクションを、sessionToken 制限セクションの直後に挿入する。
セクション内に記載する4つの情報要素の表現形式は箇条書きとし、既存ガイダンスセクションのスタイルと統一する。
第1の情報要素として「ベースラインは testing フェーズで workflow_capture_baseline を呼び出して記録済みであることが前提である」という説明を記載する。
第2の情報要素として「regression_test フェーズでは workflow_capture_baseline を再度呼び出す必要はなく、呼び出した場合に MCP サーバーがエラーを返す」という説明を記載する。
第3の情報要素として「ベースライン情報の確認に workflow_get_test_info を使用できる」という案内を記載する。
第4の情報要素として「ベースライン未設定の場合は Orchestrator が workflow_back で testing フェーズへ差し戻す」という手順を記載する。

## エラーメッセージ設計

このセクションでは、ガイダンスが機能した場合と機能しなかった場合の両方のエラーメッセージ形式を定義する。

### workflow_capture_baseline を regression_test フェーズで呼び出した場合のエラー

subagent が FR-13 のガイダンスを無視して workflow_capture_baseline を呼び出した場合、MCP サーバーは以下の形式でエラーを返す。
エラーの種別は「フェーズ不一致エラー」であり、呼び出し元フェーズが testing ではないことを示すメッセージが含まれる。
エラーメッセージには呼び出したフェーズ名（regression_test）と、当該ツールが受け付けられるフェーズ名（testing）が明示される。
Orchestrator はこのエラーを受け取った後、regression_test フェーズを再実行するか、testing フェーズへ差し戻す判断を行う。
エラーコードは既存の MCP サーバーエラー体系に従い、`PHASE_MISMATCH` または同等の識別子が使用される想定である。

### ベースライン未設定でのフェーズ遷移試行時のエラーメッセージ形式

Orchestrator が testing フェーズを完了した後にベースラインが記録されていない状態で regression_test へ遷移しようとした場合、MCP サーバーは遷移をブロックするエラーを返す。
このエラーメッセージには「ベースラインが記録されていません」という趣旨の日本語文が含まれ、testing フェーズで workflow_capture_baseline を呼び出すように案内する。
Orchestrator がこのエラーを受け取った場合の対処手順として、testing フェーズに差し戻して workflow_capture_baseline を実行し、その後 regression_test フェーズへ再遷移するという流れが確立されている。
FR-14 の「ベースライン前提条件」セクションはこのエラーの発生前に subagent を教育することを目的とし、二重の安全機構を構成する。
エラーメッセージとガイダンスの両方が存在することで、subagent とOrchestratorの双方がベースライン記録の責任範囲を正しく認識できる設計となる。

## APIレスポンス設計

このセクションでは、関連する MCP ツールのレスポンス形式を定義する。

### workflow_capture_baseline を regression_test フェーズで呼び出した場合のレスポンス

regression_test フェーズで workflow_capture_baseline を呼び出した場合、MCP サーバーは成功ではなくエラーレスポンスを返す。
エラーレスポンスのフィールド構成は `success: false` と `error` フィールドを含む形式である。
`error.code` フィールドには呼び出し失敗の理由を示す識別子が格納される。
`error.message` フィールドには人間が読める形式のエラー説明文が含まれ、正しい呼び出しタイミング（testingフェーズ）が案内される。
subagent はこのエラーレスポンスを受け取った場合、FR-14 のガイダンスに従ってベースライン操作を断念し、Orchestrator に制御を返す必要がある。

### workflow_get_test_info の正常レスポンス形式（ベースライン確認用）

regression_test フェーズでベースライン情報を確認する場合、subagent は workflow_get_test_info を呼び出すことができる。
正常時のレスポンスには `baseline` フィールドが含まれ、`baseline.totalTests`（総テスト数の整数値）・`baseline.passedTests`（成功数）・`baseline.failedTests`（失敗テスト名の文字列配列）が格納されている。
ベースラインが未記録の場合、`baseline` フィールドが存在しないか、`null` が設定されたレスポンスが返される。
subagent はこのレスポンスを参照して、現在のテスト実行結果を変更前と比較する作業を行う。
workflow_get_test_info は regression_test フェーズでの読み取り専用操作として設計されており、呼び出し自体はアーキテクチャ上問題がない。

## 設定ファイル設計

このセクションでは、変更対象の definitions.ts における regression_test エントリの構造と、テストファイルのテストケース構造を定義する。

### definitions.ts の regression_test.subagentTemplate フィールドの変更前後の構造

変更前のテンプレート末尾部分の論理的な順序は以下の通りである。
第1ブロックとして「workflow_record_test_result 呼び出し時の注意」セクションがある。
第2ブロックとして「sessionToken の取得方法と使用制限」セクションがある。
第3ブロックとして「★ワークフロー制御ツール禁止★」セクションがあり、禁止対象として5つのツール名が列挙されている。

変更後のテンプレート末尾部分の論理的な順序は以下の通りである。
第1ブロックとして「workflow_record_test_result 呼び出し時の注意」セクションが変更なしで続く。
第2ブロックとして「sessionToken の取得方法と使用制限」セクションが変更なしで続く。
第3ブロックとして FR-14 で新規挿入する「ベースライン前提条件」セクションが加わる。
第4ブロックとして「★ワークフロー制御ツール禁止★」セクションが配置され、禁止対象リストに `workflow_capture_baseline` が追記されている（FR-13 の変更）。

フィールド値の型は文字列（TypeScript の `string` 型）であり、改行は `\n` エスケープシーケンスで表現される。
セクション見出しは `##` プレフィックスを使用し、テンプレート内の既存セクション見出しスタイルと統一する。

### テストファイルのテストケース構造（TC-FIX-1 / TC-FIX-2）

テストファイルのパスは `workflow-plugin/mcp-server/src/__tests__/definitions-subagent-template.test.ts` を想定する。
このファイルが存在しない場合は新規作成し、vitest 形式のテストケースを記述する。

TC-FIX-1 のテストケース構造は以下の通りである。
テスト名は「regression_test の subagentTemplate に workflow_capture_baseline が禁止対象として含まれること」とする。
検証内容は `PHASE_DEFINITIONS.regression_test.subagentTemplate` 文字列に対して `includes('workflow_capture_baseline')` が `true` を返すことを `expect` で確認する。
さらに、当該文字列が禁止の文脈（「禁止対象:」という接頭辞を持つ行）に含まれることを確認するため、正規表現または文字列操作で検証する。

TC-FIX-2 のテストケース構造は以下の通りである。
テスト名は「regression_test の subagentTemplate にベースライン前提条件セクションが含まれること」とする。
検証内容は `PHASE_DEFINITIONS.regression_test.subagentTemplate` 文字列に対して `includes('ベースライン前提条件')` が `true` を返すことを `expect` で確認する。
また、セクション内に `workflow_get_test_info` という文字列が含まれることを追加確認する。
