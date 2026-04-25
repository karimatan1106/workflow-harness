# UI設計書

## サマリー

本タスク「既知バグ3件の根本原因修正」はworkflow-pluginのテスト基盤設定修正であり、ユーザーインターフェースの変更は一切含まない。
修正対象はvitest.config.ts、tsconfig.json、およびDesignValidatorモック・hooksテストコードの合計5ファイルである。
これらの変更はCLI上のテスト実行出力にのみ影響を与え、エンドユーザーが操作するWebUIは変更されない。
バックエンドのMCP APIレスポンス形式も従来通りであるため、フロントエンドクライアントへの影響はゼロである。
本ドキュメントはワークフロー要件として ui_design フェーズの成果物を記録するとともに、テスト基盤観点での設計情報を提供するものである。

## CLIインターフェース設計

テスト実行コマンドは `npx vitest run` であり、ルートディレクトリから直接実行できるようになることが本タスクの主要な改善点である。
修正前はworkflow-pluginサブディレクトリに移動してからテストを実行する必要があり、開発者のCLI体験が煩雑であった。
修正後はプロジェクトルートで `npx vitest run --reporter=verbose` を実行するだけで全テストスイートが起動する。
vitest.config.ts に `include: ['workflow-plugin/src/**/*.test.ts']` を明示的に設定したため、ルートからの解決パスが確定する。
テスト結果の出力フォーマットは `verbose` レポーターにより、各テストケースのPass/Fail状態がインデント付きで表示される。
修正前にテスト実行時に発生していた `TypeError: DesignValidator is not a constructor` はコンソール出力から完全に消える。
修正前に表示されていた `ReferenceError: describe is not defined` もグローバル設定の有効化により解消される。
テスト終了時のサマリー行は「Tests: X passed, Y failed」から「Tests: X passed」へと変化し、全件グリーンになることを示す。

## エラーメッセージ設計

`TypeError: DesignValidator is not a constructor` はDesignValidatorクラスの`vi.mock`実装が誤っていたことに起因するエラーである。
このエラーはモック関数がクラスとして呼び出されているにも関わらず、ファクトリが通常の関数を返していたために発生した。
修正後のモック定義では `vi.fn().mockImplementation(() => ({ validate: vi.fn().mockResolvedValue([]) }))` の形式を採用する。
これによりコンストラクタ呼び出しが正常に機能し、インスタンスメソッド `validate` が `Promise<[]>` を返すモックとして動作する。
`ReferenceError: describe is not defined` はvitestのグローバルAPIが有効化されていないためにテストファイルが `describe` を認識できずに発生したエラーである。
vitest.config.ts の `globals: true` オプションを設定することで `describe`、`it`、`expect`、`beforeEach` などがグローバルスコープで利用可能になる。
修正後はテストファイル先頭に `import { describe, it, expect } from 'vitest'` を記述しなくても各APIが利用可能となる。
将来的に新しいテストファイルを追加する際も、グローバル設定が継承されるためインポート漏れによるエラーが発生しにくい。

## APIレスポンス設計

本タスクで修正するファイルはすべてテスト設定・テストコードに限定されており、MCP APIサーバーのソースコードは変更しない。
workflow_start、workflow_next、workflow_approve など各MCPエンドポイントのリクエスト・レスポンス仕様は現状を完全に維持する。
MCPサーバーが返すJSONオブジェクトの構造（taskId、phase、status フィールドなど）は変更されない。
HTTPステータスコードの体系（200 OK、400 Bad Request、500 Internal Server Error）も従来通りである。
エラーレスポンスの `code` フィールドと `message` フィールドの命名規則に変更はない。
テスト基盤の修正によりMCPサーバーのユニットテストが正常に実行できるようになるが、これはサーバーの動作仕様変更ではなくテスト検証能力の回復である。
統合テスト環境でMCPサーバーに対して発行されるHTTPリクエストのヘッダー形式も変更がない。
クライアント側のTypeScriptSDKや curl コマンドによるAPIテストスクリプトも修正不要である。

## 設定ファイル設計

vitest.config.ts はworkflow-pluginのテスト実行環境を定義する中心的な設定ファイルである。
`globals: true` の設定によりvitestのグローバルAPIが全テストファイルで自動的に利用可能になる。
`environment: 'node'` を明示的に指定することでブラウザ環境のモックが適用されずNode.js固有のAPIが正常に動作する。
`include: ['workflow-plugin/src/**/*.test.ts']` を設定することでルートディレクトリからの実行時にテストファイルの検出パスが確定する。
`coverage.provider: 'v8'` を設定することでコードカバレッジをNode.js標準のV8エンジンで計測できる。
tsconfig.json の `exclude` 配列にはビルド対象から除外すべきパスを列挙する必要がある。
`"exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]` の形式で記述することでテストファイルが本番ビルドに含まれなくなる。
`strict: true` を維持することでモックオブジェクトの型整合性がコンパイル時に検証される。
`moduleResolution: 'bundler'` またはNode16を指定することでESモジュールとCJSの混在環境での解決精度が向上する。
設定ファイルの変更はGitの差分として記録され、将来のコードレビューで設定意図を追跡できる。

## 次フェーズへの引き継ぎ

本UIデザインドキュメントが確認するとおり、本タスクにおけるUI変更対象はゼロである。
test_design フェーズでは UI関連のテストケース（E2Eテスト、ビジュアルリグレッション）の追加は不要である。
テスト設計書では vitest.config.ts の `globals`・`environment`・`include` 設定に基づくテストケース構成を記述する。
implementation フェーズでは DesignValidator モック定義の修正と vitest.config.ts の設定追記の2点に集中して実装を進める。
コードレビューフェーズでは設定変更がビルドプロセスに悪影響を与えないことを確認するチェック項目を設ける。
