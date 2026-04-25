## サマリー

3つの既知バグの根本原因を調査した結果を報告する。
BUG-001はworkflow-pluginルートにvitest.config.tsが存在しないことが原因である。
BUG-002はmcp-server/tsconfig.jsonが__tests__を除外していないことが原因である。
BUG-003はDesignValidatorのモックがアロー関数を使用しておりコンストラクタとして使えないことが原因である。
3つの問題は相互に関連しており、BUG-002を修正するとBUG-003も部分的に解消される。

## 調査結果

workflow-pluginのテスト基盤に3つの構造的問題が存在することを確認した。
第一にルートレベルのvitest設定が欠如しておりhooksテストがグローバル関数にアクセスできない。
第二にTypeScriptビルド設定がテストファイルを除外していないためdist/にテストコードが混入している。
第三にDesignValidatorのモック実装がJavaScriptのコンストラクタ制約に違反しているためnew演算子で失敗する。
これら3つの問題は個別には軽微に見えるが組み合わさることでテスト実行の信頼性を大きく損なっている。

## 既存実装の分析

mcp-server/vitest.config.tsではglobals: trueが設定されtest環境がnode指定でincludeパターンがsrc以下のテストファイルに限定されている。
一方でworkflow-pluginルートにはvitest.config.tsが存在せずルートからの実行時にはvitestのデフォルト設定が適用される。
tsconfig.jsonのexcludeはnode_modulesとdistのみであり__tests__ディレクトリや.test.tsファイルパターンは含まれていない。
hooks/__tests__のテストファイルはCommonJS形式でrequireを使用しvitestグローバルに依存する設計となっている。
DesignValidatorモックは3つのテストファイルで同一パターンのvi.fn(() => ({}))が使われており修正は一括で行える。

## BUG-001の根本原因

workflow-pluginルートディレクトリにはvitest.config.tsが存在しない状態である。
mcp-server/vitest.config.tsにはglobals: trueが設定されているが、ルートから実行する場合はこの設定が適用されない。
hooks/__tests__のテストファイルはdescribe、test、expectなどのグローバル関数をインポートなしで使用している。
package.jsonのtest:hooksスクリプトは「node --test」を使用しておりvitestではなくNode.jsネイティブテストランナーを用いる設定になっている。
解決策はworkflow-pluginルートにvitest.config.tsを作成してglobals: trueを設定し、hooks/__tests__をテスト対象に含めることである。

## BUG-002の根本原因

mcp-server/tsconfig.jsonのexcludeフィールドにはnode_modulesとdistしか含まれていない。
src/__tests__ディレクトリやsrc/**/*.test.tsファイルは除外されていないため、tscビルド時にdist/にテストファイルがコピーされている。
dist/audit/__tests__/logger.test.js、dist/phases/__tests__/definitions.test.js等が不適切に生成されている。
本番ビルドにテストコードが含まれることで、dist/のサイズが不必要に肥大化している。
vitestがルートから実行された際にsrc/とdist/の両方のテストを検出する問題を引き起こす原因となっている。
解決策はtsconfig.jsonのexcludeに「**/__tests__/**」と「**/*.test.ts」を追加することである。

## BUG-003の根本原因

session-token.test.ts、skip-env-removal.test.ts、next.test.tsではDesignValidatorのモックにvi.fn(() => ({}))を使用している。
JavaScriptのアロー関数にはprototypeプロパティが存在しない。
new演算子で呼び出すとTypeErrorが発生する仕様になっている。
mcp-server/ディレクトリから実行した場合はvitest.config.tsのモジュール解決設定によりモックが正しく適用される。
workflow-pluginルートから実行した場合はdist/のテストファイルも読み込まれ、モジュール解決パスが変わるためモックが正しく適用されない。
解決策はアロー関数の代わりにclassまたは通常のfunction式を使用してコンストラクタとして呼び出し可能にすることである。

## 3つの問題の相互関連性

BUG-002（tsconfig除外不足）を修正するとdist/にテストファイルが生成されなくなる。
この修正によりBUG-003のルート実行時のモジュール解決衝突が解消される。
BUG-001（vitest設定不足）を修正するとhooksテストもvitestのglobals環境で実行可能になる。
BUG-003（モック問題）はJavaScript言語仕様に起因する根本的な問題である。
dist/の問題が解消されても個別修正が必要な状況である。
修正順序はBUG-002→BUG-001→BUG-003が最適である。
前の修正が後の修正の前提条件を整える構造になっている。
全ての修正を適用した後、workflow-pluginルートからnpx vitest runを実行して全テストが成功することを確認する必要がある。
