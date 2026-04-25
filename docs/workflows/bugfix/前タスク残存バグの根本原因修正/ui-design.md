## サマリー

本ドキュメントは、BUG-1〜BUG-4の修正後におけるMCPサーバーのインターフェース設計を定義する。
対象は `workflow_set_scope` ツールのAPIレスポンス形式（BUG-2）、`workflow_next` ツールのスキップ理由通知（BUG-4）、`resolvePhaseGuide` のプレースホルダー置換動作（BUG-1）、および `semantic-checker.ts` の関数名規約（BUG-3）の4点である。

- 目的: 各バグ修正後の外部インターフェース・エラーメッセージ・APIレスポンス・関数名規約を確定し、実装フェーズへの引き継ぎ情報とする。
- 主要な決定事項: `workflow_set_scope` 返却値の `scope` オブジェクトに `moduleName` フィールドを追加する。スコープ未設定時のスキップ理由メッセージは3種類（`test_impl`、`implementation`、`refactoring`）を日本語で付与する。`validateLLMSemanticTraceability` 関数は `validateKeywordSemanticTraceability` に改名する。
- 次フェーズで必要な情報: test_implフェーズでは `scope.moduleName` フィールドの存在確認テスト、スキップ理由メッセージの内容検証テスト、関数名変更後のビルド成功確認テスト、および `replaceAll` による複数置換のテストを設計すること。

---

## CLIインターフェース設計

### workflow_set_scope ツールの引数仕様

`workflow_set_scope` ツールはタスクの影響範囲を設定するMCPツールである。
パラメータとして `taskId`（文字列、省略可）、`files`（文字列配列）、`dirs`（文字列配列）、`glob`（文字列）、`addMode`（真偽値）を受け付ける。
BUG-2修正後は、返却値の `scope` オブジェクトに `moduleName` フィールドが含まれるようになる。

呼び出し例として、`dirs: ["workflow-plugin/mcp-server/src/"]` を指定した場合、
先頭ディレクトリのbasename（末尾スラッシュを除いた最後のパス要素）が自動推定され、`moduleName: "src"` が設定される。
`dirs` を空配列または未指定で呼び出した場合、`moduleName` フィールドは `undefined` となる。

### workflow_next ツールのスキップ通知動作（BUG-4修正後）

BUG-4修正前は、`scope.affectedFiles` が空配列のとき `workflow_next` を呼び出しても
どのフェーズがスキップされるかの理由メッセージが付与されなかった。
修正後は、スコープ未設定の早期リターン時に3種類のスキップ理由メッセージが `phaseSkipReasons` に設定され、
`workflow_next` の応答に含まれるようになる。

スキップ通知の対象フェーズは `test_impl`、`implementation`、`refactoring` の3つである。
ただし `userIntent` にテスト関連キーワードが含まれる場合は `test_impl` のスキップが解除され、
実装関連キーワードが含まれる場合は `implementation` と `refactoring` のスキップが解除される。

### resolvePhaseGuide のプレースホルダー動作（BUG-1修正後）

BUG-1修正後は、`resolvePhaseGuide` 関数内の文字列置換が `replaceAll` によるグローバル置換に変更される。
この変更により、同一パス文字列内に `{docsDir}` または `{moduleDir}` が2回以上登場する場合も
全ての出現箇所が正しく置換されるようになる。
現時点では実害が発生している事例はないが、将来の拡張でパス文字列の組み合わせが複雑になった際の
置換漏れを予防する目的の修正である。

---

## エラーメッセージ設計

### BUG-4修正後のスキップ理由メッセージ形式

スコープが未設定の状態（`scope.affectedFiles` が空かつ `scope.files` が空）で `workflow_next` を呼び出した際、
`phaseSkipReasons` オブジェクトの各キーに以下のメッセージが設定される。

`test_impl` キーのメッセージは「スコープが未設定のためテスト実装フェーズをスキップ」という文字列である。
`implementation` キーのメッセージは「スコープが未設定のため実装フェーズをスキップ」という文字列である。
`refactoring` キーのメッセージは「スコープが未設定のためリファクタリングフェーズをスキップ」という文字列である。

これら3つのメッセージはオーケストレーターに返却され、ユーザーへの通知やログ出力に使用される。

### BUG-1修正後のプレースホルダー置換失敗時の挙動

BUG-1の修正は `replace` から `replaceAll` への変更のみであり、置換失敗時の追加エラーメッセージは定義しない。
プレースホルダーが文字列内に存在しない場合でも `replaceAll` は安全に動作し、元の文字列をそのまま返す。
プレースホルダー展開エラーの検出は `resolvePhaseGuide` の呼び出し元が担当し、
展開後のパスが有効かどうかをファイルシステムアクセス時に確認する設計を維持する。

### workflow_set_scope の入力バリデーションエラーメッセージ

`taskId` が存在しないか、現在アクティブでないタスクに対してスコープを設定しようとした場合、
エラーメッセージ「タスクが見つかりません」が返却される。
`files` と `dirs` の両方が空配列で、かつ `addMode` が指定されていない場合、
警告として「影響範囲が空です。フェーズスキップが発生する可能性があります」が `warnings` 配列に含まれる。

---

## APIレスポンス設計

### BUG-2修正後の workflow_set_scope 成功レスポンス形式

BUG-2修正前の返却値 `scope` オブジェクトは `affectedFiles` と `affectedDirs` の2フィールドのみを含んでいた。
修正後は `moduleName` フィールドが追加され、3フィールド構成となる。

修正後の成功レスポンス構造は以下の通りである。トップレベルに `success`（真偽値）、`taskId`（文字列）、`scope`（オブジェクト）、`message`（文字列）が含まれる。
`scope` オブジェクトは `affectedFiles`（文字列配列）、`affectedDirs`（文字列配列）、`moduleName`（文字列またはundefined）の3フィールドで構成される。
`warnings` フィールドは警告がある場合のみ配列として含まれる（省略可能）。

`dirs` パラメータに値が指定された場合の `message` フィールドの例として、モジュール名が `"src"` の場合は
「影響範囲を設定しました（ファイル: 3件, ディレクトリ: 1件, モジュール: src）」のように
モジュール名が末尾に条件付きで追記される形式となる。
`dirs` が空または `moduleName` が `undefined` の場合は従来通り「影響範囲を設定しました（ファイル: 0件, ディレクトリ: 0件）」の形式を維持する。

### workflow_set_scope のエラーレスポンス形式

エラー発生時のレスポンスはトップレベルに `success: false`、`error`（文字列）を含む。
タスクが見つからない場合は `error: "タスクが見つかりません"` が返却される。
フェーズが対応外の場合は `error: "このフェーズではスコープを設定できません"` が返却される。

### workflow_next のスキップ理由を含む応答形式

BUG-4修正後、`workflow_next` の応答にはスキップされたフェーズの情報が含まれる場合がある。
スキップされたフェーズが存在する場合、応答に `skippedPhases` フィールドが追加される。
`skippedPhases` フィールドはフェーズ名をキー、スキップ理由文字列を値とするオブジェクトである。

---

## 設定ファイル設計

### BUG-3修正後の semantic-checker.ts 関数名規約

BUG-3修正により、`semantic-checker.ts` における関数名とインターフェース名の命名規約が実装実態に合わせて変更される。
変更前の関数名 `validateLLMSemanticTraceability` は「LLM APIを使ったセマンティック検証」を示す名称だったが、
実態はキーワードマッチングによるトレーサビリティ検証であったため、名称と実装の間に乖離があった。

修正後の関数名は `validateKeywordSemanticTraceability` となり、キーワードマッチング方式であることが明示される。
インターフェース名は `LLMSemanticTraceabilityResult` から `KeywordSemanticTraceabilityResult` に変更される。
JSDocは「キーワードマッチング方式による検証」「SDK可用性チェックは将来のLLM統合への拡張ポイント」「現時点ではAPI呼び出しを行わない」を明示する内容に書き直される。

### tsconfig.json の lib 設定要件

BUG-1の `replaceAll` 使用に際し、`workflow-plugin/mcp-server` の `tsconfig.json` における
`compilerOptions.lib` が `ES2021` 以上に設定されていることを実装フェーズで確認する必要がある。
`ES2021` 未満の設定では `String.prototype.replaceAll` の型定義が提供されず、TypeScriptコンパイルエラーが発生する。
設定が不足している場合は `lib` に `"ES2021"` または `"ESNext"` を追加することで対応する。

### MCP ツール定義ファイルのスキーマ

`workflow_set_scope` のツール定義（`set-scope.ts` 内の `setScopeToolDefinition`）は
MCPのJSONスキーマ形式で入力パラメータを定義しており、BUG-2修正後も入力スキーマの変更は行わない。
変更はツールの返却値（実行時オブジェクト）のみに限定され、外部からのツール呼び出し仕様は後方互換性を維持する。
`semantic-checker.ts` の関数名変更（BUG-3）は `semantic-checker.ts` 単体の内部変更であり、
外部ファイルからの参照が存在しないため、他の設定ファイルやスキーマへの影響はない。
