# 調査結果: 既存バグ3件の根本原因追究

## サマリー

3件の既存バグについてコード調査により根本原因を特定しました。
バグ1はbash-whitelist.jsのtestingフェーズホワイトリストに末尾スペース付きで登録された'node 'エントリが原因です。
REQ-R6厳格境界チェックとの相互作用により、nodeコマンド実行時にマッチ失敗が発生します。
バグ2はloop-detector.jsのnormalizeFilePath関数内のpath.resolve失敗時のcatchブロックがデッドコードである問題です。
path.resolveは文字列引数に対して例外をスローしないため、このブランチに到達することがありません。
バグ3はテスト結果バリデータのキーワード検出が単語境界を考慮せず文脈無視で検出する問題です。
"0 failed"や"Fail-Closed"のような文字列が誤検出されます。

## 調査結果

3件のバグについて、それぞれのソースコードを読み込み根本原因を特定しました。
バグ1はホワイトリストエントリの形式ミスで、末尾スペースがstartsWith判定を妨げています。
バグ2はNode.js APIの仕様理解不足で、path.resolveが例外をスローしない事実が見落とされています。
バグ3はキーワード検出の正規表現設計ミスで、単語境界と文脈を考慮していません。
3件とも影響範囲が限定的で、修正は小規模なコード変更で完了可能です。

## 既存実装の分析

bash-whitelist.jsのホワイトリストマッチングはstartsWith判定とREQ-R6境界チェックの2段階構成です。
loop-detector.jsのnormalizeFilePathはfs.realpathSync → path.resolveの2段フォールバック構成です。
テスト結果バリデータはexitCodeと出力テキスト内のキーワードの整合性を検証する構成です。
いずれも防御的プログラミングの意図で実装されていますが、エッジケースへの対応が不十分でした。
修正対象ファイルはbash-whitelist.js、loop-detector.js、およびMCPサーバーのテスト結果記録モジュールの3ファイルです。

## バグ1: Bashホワイトリストのnodeコマンドブロック

bash-whitelist.jsの行54-65のtestingフェーズホワイトリストに'node '（末尾スペース付き5文字）が登録されています。
行665-671のマッチングロジックではnormalizedPart.startsWith(allowedCommand)で判定しています。
'node src/backend/...'に対して'node '（末尾スペース）のstartsWith判定はfalseとなります。
なぜなら入力の5文字目は's'であり、ホワイトリストの5文字目のスペースと一致しないためです。
回避策のスペース2つは'node  src/...'の5文字目がスペースとなりマッチが成立するために機能します。
根本修正は'node 'を'node'に変更し、REQ-R6の境界チェックに任せることです。

## バグ2: normalizeFilePathのデッドコード

loop-detector.jsの行125-145のnormalizeFilePath関数にはtry-catchのネスト構造があります。
外側のtryでfs.realpathSyncを試行し、失敗時にconsole.warnを出力してpath.resolveにフォールバックします。
内側のtryでpath.resolveを実行し、失敗時にconsole.errorを出力する設計です。
しかしpath.resolveはNode.jsの純粋な文字列処理関数であり、ファイルシステムにアクセスしません。
文字列引数に対してpath.resolveが例外をスローするケースは存在しません。
したがって内側のcatchブロック（console.error出力）は到達不能なデッドコードです。

## バグ3: テスト結果バリデータの過剰検出

テスト結果記録のバリデーションロジックがFAIL、FAILED等のキーワードを検出する際に単語境界チェックが不十分です。
exitCode=0の場合に出力テキスト内の"failed"を検出すると矛盾として拒否します。
しかし"0 failed"のように失敗件数が0であることを示す文脈でも誤検出が発生します。
また"Fail-Closed"のようなハイフン結合の技術用語もFailとして検出されます。
正規表現にiフラグ（大文字小文字不問）が設定されているため小文字の"failed"もマッチします。
