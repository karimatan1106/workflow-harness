## サマリー

workflow-pluginのテスト基盤に存在する3つの構造的問題を修正する要件を定義する。
BUG-001はworkflow-pluginルートにvitest.config.tsを作成しhooksテストの実行環境を整備する。
BUG-002はtsconfig.jsonのexcludeにテストパターンを追加しdist/からテストファイルを除外する。
BUG-003はDesignValidatorモックのアロー関数をクラス構文に変更しコンストラクタとして使用可能にする。
全修正適用後にworkflow-pluginルートから全テストが成功することを受け入れ基準とする。

## 機能要件

REQ-1: workflow-pluginルートにvitest.config.tsを新規作成し、globals: true、environment: node、includeパターンにmcp-server/src/**とhooks/__tests__/**を含める。
REQ-2: mcp-server/tsconfig.jsonのexclude配列に「**/__tests__/**」と「**/*.test.ts」を追加してテストファイルのビルド除外を設定する。
REQ-3: session-token.test.ts、skip-env-removal.test.ts、next.test.tsの3ファイルでDesignValidatorモックをvi.fn(() => ({}))からclass構文またはfunction式に変更する。
REQ-4: hooks/__tests__の5つのテストファイルがvitestのglobals環境で正常に動作するようCommonJSのrequire(assert)をvitestのexpectに置換するか互換性を確保する。
REQ-5: dist/ディレクトリ内の既存テストファイルを再ビルドにより削除し、以降のビルドでテストファイルが生成されないことを確認する。

## 非機能要件

NFR-1: 既存の732テスト（mcp-serverスコープ）が全て合格し続けること。
NFR-2: workflow-pluginルートからnpx vitest runを実行した場合も全テストが合格すること。
NFR-3: npm run build実行時にdist/内にテストファイルが含まれないこと。
NFR-4: テスト実行時間が現状の3秒以内を維持すること。
NFR-5: hooks/__tests__のテストがvitestフレームワークで実行可能であること。

## 受け入れ基準

AC-1: mcp-server/ディレクトリから「npx vitest run」実行で全テスト合格。
AC-2: workflow-plugin/ディレクトリから「npx vitest run」実行で全テスト合格（hooks含む）。
AC-3: 「npm run build」実行後のdist/ディレクトリに__tests__フォルダや.test.jsファイルが存在しないこと。
AC-4: DesignValidatorを使用する3つのテストファイルでnew演算子が正常に動作すること。
AC-5: hooks/__tests__の5つのテストファイルがdescribeやtestのReferenceErrorなく実行されること。

## 影響範囲

修正対象ファイルは合計で8-9ファイルであり、テスト基盤の設定変更とモック修正に限定される。
プロダクションコードへの影響はtsconfig.jsonのexclude追加のみであり、機能的な変更は発生しない。
新規ファイル作成はworkflow-plugin/vitest.config.tsの1ファイルのみである。
既存のmcp-server/vitest.config.tsの設定は変更せず、ルートレベルの設定が上位互換として機能する。
hooks/__tests__のテストファイルは内部ロジックの変更は最小限にとどめ、インポート追加のみで対応する。
