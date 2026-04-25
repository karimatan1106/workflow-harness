# 調査結果: NEW-SEC-1/2/3専用テスト追加

## サマリー

セキュリティ修正NEW-SEC-1/2/3に対する専用テストを追加するための調査を実施した。
既存テストファイル（test-n1〜test-n5）はカスタムNode.jsテストフレームワークを使用しており、vitestではなくassertモジュールとファイルコンテンツ検証パターンを採用している。
NEW-SEC-1のsanitizeZeroWidthChars関数はmodule.exportsに登録されていないため、splitCommandParts経由での間接テストが必要である。
NEW-SEC-2のdetectEncodedCommand関数はmodule.exportsに登録済みであり、直接テストが可能である。
NEW-SEC-3のnormalizeFilePath関数はLoopDetectorクラス経由でアクセス可能であり、console.warn/console.errorの出力をスパイでテストできる。

## 調査結果

### テスト対象コードの構造

bash-whitelist.jsには2件のセキュリティ修正が実装されている。
NEW-SEC-1はZERO_WIDTH_CHARS_PATTERN定数（行17-18）とsanitizeZeroWidthChars関数（行25-27）で構成され、splitCommandParts（行266-267）とsplitCompoundCommand（行329-330）の先頭で呼び出される。
NEW-SEC-2はdetectEncodedCommand関数内の3箇所（行428-432、451-455、473-477）でFail-Closedロジックを実装している。
loop-detector.jsのNEW-SEC-3はnormalizeFilePath関数（行130-145）にconsole.warn（行134）とconsole.error（行141）を追加している。
これら3件の修正は互いに独立しており、個別にテスト可能である。

### テストフレームワークの分析

既存テストはNode.jsのassertモジュールを使用したカスタムフレームワークで構成されている。
テスト出力は「Test Suite: テスト名」ヘッダーに続き、各テストケースの結果を✓/✗で表示する形式である。
最終行に「RESULT: N passed, M failed, T total」の集計行が出力される。
ファイルコンテンツを読み込んで検証するパターンと、モジュールをrequireして関数を直接テストするパターンの両方が使用されている。
テストファイルはsrc/backend/tests/unit/hooks/ディレクトリに配置されている。

## 既存実装の分析

### エクスポート状況

bash-whitelist.jsのmodule.exports（行690付近）にはcheckBashWhitelist、splitCommandParts、splitCompoundCommand、detectEncodedCommandが登録されている。
sanitizeZeroWidthChars関数はmodule.exportsに含まれておらず、内部関数として扱われている。
loop-detector.jsはLoopDetectorクラスをmodule.exportsしており、normalizeFilePathはクラスメソッドとしてアクセス可能である。
テストではrequire()でモジュールを読み込み、エクスポートされた関数を直接呼び出すパターンが一般的である。
NEW-SEC-1のテストではsplitCommandPartsにゼロ幅文字を含む入力を渡し、サニタイズ後の正しい分割結果を検証する方法が最適である。
