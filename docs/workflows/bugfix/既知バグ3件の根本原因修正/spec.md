## サマリー

3つの既知バグを修正する仕様書。
修正対象はvitest設定、tsconfig設定、テストモック。
修正順序はBUG-002→BUG-001→BUG-003の順番で実施する。
全修正後にルートから全テスト合格を確認することが完了条件。
各バグは独立しているため、個別に検証しながら進める。

## 概要

workflow-pluginのテスト基盤に存在する3つの構造的問題（BUG-001、BUG-002、BUG-003）を修正する。
BUG-001はvitestグローバル設定の欠如によりhooksテストが実行不可能な問題である。
BUG-002はTypeScriptコンパイル設定がテストファイルを除外していないことによるdist/汚染の問題である。
BUG-003はDesignValidatorモックがアロー関数を使用しておりnew演算子で失敗する問題である。
修正はテスト基盤の設定とモックコードに限定されプロダクションコードへの影響は最小限である。

## 変更対象ファイル

workflow-plugin/mcp-server/tsconfig.jsonのexclude配列にテストファイルパターンを追加する（BUG-002修正）。
workflow-plugin/vitest.config.tsを新規作成しルートレベルのvitest設定を提供する（BUG-001修正）。
workflow-plugin/mcp-server/src/tools/__tests__/session-token.test.tsのDesignValidatorモックをコンストラクタ互換に修正する（BUG-003修正）。
workflow-plugin/mcp-server/src/tools/__tests__/skip-env-removal.test.tsのDesignValidatorモックを同様に修正する（BUG-003修正）。
workflow-plugin/mcp-server/src/tools/__tests__/next.test.tsのDesignValidatorモックおよびmockImplementation呼び出しを修正する（BUG-003修正）。

## 機能仕様

### BUG-002修正: tsconfig.jsonテストファイル除外

対象ファイルはworkflow-plugin/mcp-server/tsconfig.jsonである。
変更内容はexcludeフィールドに"**/__tests__/**"と"**/*.test.ts"を追加することである。
この修正によりnpm run build後にdist/内にテストファイルが生成されなくなる。
副作用はなく、ソースコードのビルドには一切影響しない。
確認方法はnpm run build後にfind dist -name "*.test.js"で0件であることをチェックする。

### BUG-001修正: ルートvitest.config.ts作成

対象ファイルはworkflow-plugin/vitest.config.ts（新規作成）である。
設定内容はglobals: true、environment: 'node'を基本とする。
includeパターンは['mcp-server/src/**/*.test.ts', 'mcp-server/tests/**/*.test.ts', 'hooks/__tests__/*.test.js']とする。
mcp-server/vitest.config.tsは残して後方互換性を維持し、サブディレクトリ単体実行を可能にする。
hooks/__tests__のテストファイルはvitestのglobals: trueによりdescribe/test/expectがインポート不要で使用可能になる。

### BUG-003修正: DesignValidatorモックのコンストラクタ修正

修正対象ファイルは以下の3つである。
1つ目はmcp-server/src/tools/__tests__/session-token.test.tsである。
2つ目はmcp-server/src/tools/__tests__/skip-env-removal.test.tsである。
3つ目はmcp-server/src/tools/__tests__/next.test.tsである。
変更内容はアロー関数によるモック生成をmockImplementation形式に変更することで、new演算子との互換性を確保する。

変更後のモックコードはvitestのmockImplementation形式を採用しアロー関数をコンストラクタ互換の形式に変換する。
具体的にはDesignValidatorプロパティにmockImplementation付きのモック関数を設定しvalidateAllメソッドを持つオブジェクトを返す構造にする。
mockImplementation形式は直接のコールバック引数とは異なりnew演算子で呼び出された際にprototypeチェーンを正しく構築する。

## 技術設計

vitest workspace機能は使わずルートvitest.config.tsで全テスト統合管理する方針を採用する。
mcp-server/vitest.config.tsは残して後方互換性を維持し、サブディレクトリ単体実行を可能にする。
ルートconfigのincludeパターンはsrc/とtests/のTypeScriptテストおよびhooks/のJavaScriptテストをカバーする。
tsconfig修正はビルド対象のみに影響し、エディタのTypeScript解析には影響しない。
DesignValidatorモック修正はmockImplementationパターンを採用しnew演算子互換性を確保する。
各修正は独立しており、修正後に個別のビルド・テスト実行で検証可能である。

## 実装計画

Step 1はmcp-server/tsconfig.jsonのexcludeを修正する（BUG-002対応）。
Step 2はnpm run buildを実行しdist/を再生成してテストファイルが除外されることを確認する。
Step 3はworkflow-plugin/vitest.config.tsを新規作成する（BUG-001対応）。
Step 4は3つのテストファイルのDesignValidatorモックをmockImplementation形式に修正する（BUG-003対応）。
Step 5はmcp-server/からnpx vitest runで732テスト全合格を確認する。
Step 6はworkflow-plugin/からnpx vitest runで全テスト合格を確認し、完了とする。
