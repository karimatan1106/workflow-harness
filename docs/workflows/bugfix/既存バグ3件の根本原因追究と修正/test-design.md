# テスト設計: 既存バグ3件の根本原因追究と修正

## サマリー

本テスト設計書は3件の既存バグ修正に対するテストケースを定義します。
BUG-1はbash-whitelist.jsのホワイトリスト末尾スペース修正に対し、nodeコマンド許可と派生コマンド拒否の4テストを実施します。
BUG-2はloop-detector.jsのデッドコード除去に対し、内側try-catch除去確認とpath.resolve直接呼び出し確認の4テストを実施します。
BUG-3はrecord-test-result.tsのキーワード検出改善に対し、exitCode=0で受理すべき4パターンと拒否すべき4パターンの計8テストを実施します。
全テストはNode.jsのassertモジュールを使用したユニットテスト形式で、TDD Red-Green-Refactorサイクルに従います。
テストファイルはsrc/backend/tests/unit/hooks/ディレクトリに配置し、既存テスト（test-n1等）と同じパターンでコンソール出力します。
test_implフェーズでは修正未適用のため全テスト失敗（Red）が期待され、implementation完了後に全テストパス（Green）が要求されます。
合計16テストケースにより、3件のバグ修正の正確性と既存セキュリティ機能の維持を検証します。

## テスト戦略

全テストはユニットテストレベルで実施し、各バグ修正対象ファイルを静的に読み込んでコード内容を検証します。
実際のワークフロー実行やMCPサーバー起動は不要で、ファイル内容の文字列解析により修正が正しく適用されたかを判定します。
テストフレームワークは既存のtest-n1からtest-n6と同様にNode.jsのネイティブassertモジュールを使用し、外部依存は追加しません。
テストの実行はnodeコマンドで直接行い、終了コード0が成功、1が失敗、2がセットアップエラーを表します。
各テストケースはtry-catchで個別にラップし、1つのテスト失敗が他のテストの実行を妨げないようにします。

## テストファイル配置

テストファイルは以下の3ファイルをsrc/backend/tests/unit/hooks/ディレクトリに作成します。
BUG-1用はtest-bug1-bash-whitelist.test.tsで、bash-whitelist.jsのホワイトリストエントリ形式を検証します。
BUG-2用はtest-bug2-loop-detector.test.tsで、loop-detector.jsのnormalizeFilePath関数構造を検証します。
BUG-3用はtest-bug3-record-test-result.test.tsで、record-test-result.tsのバリデーションロジックを検証します。
各ファイルはプロジェクトルートを動的に探索し、workflow-plugin/配下の対象ファイルを読み込む設計です。

## BUG-1テスト設計: bash-whitelist.js末尾スペース修正

bash-whitelist.jsの行64（testingフェーズ）と行75（implementationフェーズ）に登録された'node '（末尾スペース付き）を'node'に修正する変更を検証します。
修正後もREQ-R6境界チェック（行665-671）により派生コマンドは拒否される設計であり、セキュリティ機能の維持も確認対象です。
以下の4テストケースでホワイトリストエントリの形式修正、旧形式の完全除去、REQ-R6コードの維持を網羅的に検証します。

### テストケースBUG1-01: testingフェーズのnodeエントリ修正確認

bash-whitelist.jsのtestingフェーズホワイトリスト配列に'node'（末尾スペースなし）が含まれることを確認します。
ファイル内容を文字列として読み込み、testingフェーズの配列定義部分を正規表現で抽出します。
抽出した文字列内に引用符で囲まれた'node'エントリが存在することをassert.okで検証します。
修正前は'node '（スペース付き）のため'node'（スペースなし）の検索にマッチせずテスト失敗（Red）となります。
修正後は'node'にマッチしテスト成功（Green）となります。

### テストケースBUG1-02: implementationフェーズのnodeエントリ修正確認

bash-whitelist.jsのimplementationフェーズホワイトリスト配列にも'node'が含まれることを確認します。
testingフェーズと同様にファイル内容からimplementationフェーズの配列定義部分を抽出して検証します。
行75のエントリが行64と同様に修正されていることを保証し、修正漏れを防止します。
修正前は行75に'node 'が残存しておりテスト失敗、修正後は'node'に変更されテスト成功となります。
2つのフェーズで一貫した修正が適用されていることがこのテストの目的です。

### テストケースBUG1-03: 旧形式'node '（末尾スペース付き）の完全除去確認

bash-whitelist.jsのファイル全体から'node '（末尾スペース付き）のホワイトリストエントリが完全に除去されたことを確認します。
ファイル内容を文字列として読み込み、クォートで囲まれた'node '（末尾スペース付き）パターンの出現回数をカウントします。
出現回数がゼロであることをassert.strictEqualで検証し、修正漏れの箇所がないことを保証します。
修正前は行64と行75に2箇所存在するためテスト失敗、修正後は0箇所となりテスト成功です。
コメント内の言及は検査対象外とし、実際のホワイトリスト配列エントリのみを対象とします。

### テストケースBUG1-04: REQ-R6境界チェックコード維持確認

bash-whitelist.jsのREQ-R6境界チェックロジック（行665-671付近）が修正により変更されていないことを確認します。
ファイル内容からnextCharの取得行（normalizedPart[allowedCommand.length]）と空白文字テスト（/\s/.test(nextChar)）の存在を検証します。
この境界チェックがあることでnodejsやnodemonなどの派生コマンドが正しく拒否されるため、セキュリティ上極めて重要です。
修正前後共にREQ-R6コードは存在するためテスト成功となりますが、万が一の誤削除を検出するためのガードレールテストです。
このテストはTDD Redフェーズでも成功することが期待される唯一のテストケースです。

## BUG-2テスト設計: loop-detector.jsデッドコード除去

loop-detector.jsのnormalizeFilePath関数（行125-145）内の内側try-catch（行136-143）を除去する変更を検証します。
path.resolveはNode.jsの純粋な文字列処理関数であり例外をスローしないため、内側catchは到達不能なデッドコードです。
外側のtry-catch（fs.realpathSync用）は維持する必要があるため、過剰な除去がないことも検証します。
以下の4テストケースで構造変更の正確性とフォールバック機能の維持を網羅的に検証します。

### テストケースBUG2-01: 内側try-catch除去確認

normalizeFilePath関数内のtryブロック数が1つ（外側のみ）であることを確認します。
ファイル内容からnormalizeFilePath関数の定義範囲を抽出し、tryキーワードの出現回数をカウントします。
修正前はtryが2回（外側と内側）出現するためテスト失敗、修正後は1回（外側のみ）でテスト成功となります。
同様にcatchキーワードの出現回数も1回であることを検証し、内側catchブロックが除去されたことを確認します。
関数範囲の抽出には正規表現でfunction normalizeFilePath以降の次の関数定義開始までを対象とします。

### テストケースBUG2-02: path.resolve直接呼び出し確認

外側catchブロック内でpath.resolveが内側try-catchなしで直接呼び出されていることを確認します。
ファイル内容からnormalizeFilePath関数の外側catchブロック内容を抽出して検証します。
path.resolve(filePath)の呼び出しが存在し、その周囲に内側tryブロックの開始行が存在しないことをassert.okで確認します。
修正前はpath.resolveが内側try内に存在するためテスト失敗、修正後は直接呼び出しとなりテスト成功です。
この検証により、デッドコード除去後の正しいコード構造が保証されます。

### テストケースBUG2-03: 外側try-catch維持確認

fs.realpathSync呼び出しを保護する外側try-catchが正しく維持されていることを確認します。
ファイル内容からnormalizeFilePath関数内にfs.realpathSync(filePath)呼び出しが存在することを検証します。
また外側catchブロック内にconsole.warnによる警告ログ出力が含まれることも確認し、フォールバック動作の維持を保証します。
修正前後共に外側try-catchは存在するため両方でテスト成功が期待されますが、過剰な除去を検出するためのガードレールテストです。
BUG1-04と同様にTDD Redフェーズでも成功することが期待されるテストケースです。

### テストケースBUG2-04: path.resolve仕様コメント追記確認

path.resolveが例外をスローしない旨のコメントが関数内に追記されたことを確認します。
ファイル内容からnormalizeFilePath関数内にpath.resolveの性質に関するコメント文が存在することを検証します。
コメント内容は「path.resolve」「例外」「スロー」「文字列処理」等のキーワードを含むことを確認します。
修正前はこのコメントが存在しないためテスト失敗、修正後はコメント追記によりテスト成功となります。
将来の保守担当者がデッドコード除去の理由を理解できることを保証するためのテストです。

## BUG-3テスト設計: record-test-result.tsキーワード検出改善

record-test-result.tsのvalidateTestOutputConsistency関数内の大文字キーワード検出ロジック（行99-110）に2つの修正を検証します。
修正3aはisKeywordNegated関数を大文字キーワードにも適用し「0 Failed」や「no Error」を除外する変更です。
修正3bはマッチ位置の次の文字がハイフンでないことを確認し「Fail-Closed」等のハイフン結合語を除外する変更です。
以下の8テストケースで受理すべき4パターンと拒否すべき4パターンを網羅的に検証します。

### テストケースBUG3-01: isKeywordNegated呼び出し追加確認

大文字キーワード検出のisUpperCase分岐内にisKeywordNegated関数の呼び出しが追加されたことを確認します。
ファイル内容からisUpperCase分岐のコードブロックを抽出し、isKeywordNegated(output, kw.toLowerCase())の呼び出しが含まれることを検証します。
この修正により「All tests passed. 0 failed, 42 passed.」のような出力がexitCode=0で正しく受理されるようになります。
修正前はisKeywordNegatedの呼び出しが大文字分岐に存在しないためテスト失敗となります。
NEGATION_WORDSに含まれる'0'により、"0 failed"パターンが否定語として正しく認識されます。

### テストケースBUG3-02: ハイフン結合語除外ロジック追加確認

大文字キーワード検出のmatches.someブロック内にハイフン判定ロジックが追加されたことを確認します。
ファイル内容からmatches.someのコールバック関数を抽出し、output[idx + match.length] === '-'の判定が含まれることを検証します。
この修正により「Security Mode: Fail-Closed」のようなセキュリティ用語がexitCode=0で正しく受理されるようになります。
修正前はハイフン判定ロジックが存在しないためテスト失敗、修正後はロジック追加によりテスト成功です。
ハイフン結合語はセキュリティ分野で頻繁に使用される用語パターンであり、この除外は誤検出防止に不可欠です。

### テストケースBUG3-03: NEGATION_WORDS配列に'0'が含まれることの確認

isKeywordNegated関数が使用するNEGATION_WORDS配列に'0'（数字のゼロ文字列）が含まれることを確認します。
ファイル内容からNEGATION_WORDSの定義を抽出し、'0'が配列要素として存在することをassert.okで検証します。
これは修正3aが正しく機能するための前提条件であり、「0 Failed」の「0」が否定語として認識される基盤です。
修正前後共にNEGATION_WORDSに'0'は含まれているためテスト成功が期待されるガードレールテストです。
「Test Suites: 1 passed, 0 Failed, 1 total」のような大文字Failedでも正しく動作することを間接的に保証します。

### テストケースBUG3-04: kw.toLowerCase()による小文字化呼び出し確認

isKeywordNegated呼び出し時にキーワードがkw.toLowerCase()で小文字化されていることを確認します。
大文字キーワード（FAIL, FAILED等）はisKeywordNegatedに渡す前に小文字化する必要があり、この変換が実装されていることを検証します。
ファイル内容からisKeywordNegated呼び出しの引数にkw.toLowerCase()が含まれることをassert.okで確認します。
修正前はisKeywordNegated呼び出し自体が存在しないためテスト失敗、修正後はkw.toLowerCase()付きの呼び出しでテスト成功です。
「Tests: 5 passed, 0 failed, 5 total」のJest形式出力が正しく処理されることを間接的に保証します。

### テストケースBUG3-05: 明確な失敗表現の検出維持確認（小文字failed）

修正後も「Test failed」のような明確な失敗表現がexitCode=0で検出され拒否されることを確認します。
小文字の「failed」は小文字キーワード検出パスで処理されるため、修正3aの大文字キーワード変更の影響を受けないことを検証します。
ファイル内容からBLOCKING_FAILURE_KEYWORDSに'FAILED'が含まれ、小文字パスでのisKeywordNegated呼び出しが維持されていることを確認します。
修正前後共に小文字キーワード検出は変更されないためテスト成功が期待されるガードレールテストです。
真の矛盾（exitCode=0なのにTest failedを含む出力）を見逃さないことがこのテストの目的です。

### テストケースBUG3-06: 大文字FAILの検出維持確認

修正後も「FAIL src/test.ts」のようなJest形式の大文字FAILがexitCode=0で検出され拒否されることを確認します。
大文字FAILの前に否定語（0, no等）がなく、後にハイフンも続かない場合は修正3aと修正3bの除外対象にならないことを検証します。
ファイル内容からBLOCKING_FAILURE_KEYWORDSに'FAIL'が含まれ、大文字キーワード検出パスの基本構造が維持されていることを確認します。
修正前後共にFAILは検出対象であるためテスト成功が期待されるガードレールテストです。
否定語チェックとハイフンチェックの追加が基本的な検出機能を損なわないことの保証が目的です。

### テストケースBUG3-07: ERRORキーワードの検出維持確認

修正後も「Error: assertion failed」のようなエラーメッセージがexitCode=0で検出され拒否されることを確認します。
大文字ERRORの前に否定語がなく後にハイフンも続かない場合は、修正による除外対象にならないことを検証します。
ファイル内容からBLOCKING_FAILURE_KEYWORDSに'ERROR'と'ERRORS'が含まれていることをassert.okで確認します。
修正前後共にERRORは検出対象であるためテスト成功が期待されるガードレールテストです。
エラーメッセージを含む出力の矛盾検出が修正後も正しく機能することの保証が目的です。

### テストケースBUG3-08: 失敗件数1以上のFailed検出維持確認

修正後も「1 test Failed」のような失敗件数が1以上の場合にexitCode=0で検出され拒否されることを確認します。
「1」はNEGATION_WORDSに含まれないため、isKeywordNegatedでは除外されないことを検証します。
NEGATION_WORDSの定義を確認し、'0', 'no', 'zero', 'without'のみが含まれ'1'が含まれないことをassert.okで検証します。
修正前後共にNEGATION_WORDSに'1'は含まれないためテスト成功が期待されるガードレールテストです。
「0 Failed」は受理されるが「1 test Failed」は拒否されるという境界条件の正確性を保証することが目的です。

## テスト実行コマンド

BUG-1テストはnode src/backend/tests/unit/hooks/test-bug1-bash-whitelist.test.tsで実行します。
BUG-2テストはnode src/backend/tests/unit/hooks/test-bug2-loop-detector.test.tsで実行します。
BUG-3テストはnode src/backend/tests/unit/hooks/test-bug3-record-test-result.test.tsで実行します。
全テストを順次実行する場合は上記3コマンドをシェルの&&演算子で連結して実行します。
各テストファイルの終了コードが0であることが成功基準であり、1つでも失敗があれば連結実行は途中で停止します。

## テスト成功基準

test_implフェーズでは修正未適用のため、BUG1-01からBUG1-03、BUG2-01からBUG2-02、BUG2-04、BUG3-01からBUG3-04の計10テストが失敗（Red）することが成功基準です。
ガードレールテスト（BUG1-04、BUG2-03、BUG3-05からBUG3-08）の計6テストは修正前後共に成功が期待されます。
implementationフェーズ後は全16テストがパス（Green）することが成功基準です。
refactoringフェーズ後もテストが引き続きパスし続けることが成功基準です。
regression_testフェーズでは既存のtest-n1からtest-n6も合わせて実行し、リグレッションがないことを確認します。

## 回帰テストの考慮事項

BUG-1修正後はtest-n1テストスイートを実行してREQ-R6境界チェックの既存テストがパスすることを確認します。
BUG-2修正後はtest-n6 SEC3テストスイートを実行してnormalizeFilePathの基本動作が維持されることを確認します。
BUG-3修正後はtest-n3テストスイートを実行してテスト真正性バリデーションの基本機能が維持されることを確認します。
3件の修正は相互に独立しており、いずれかの修正が他のバグ修正に干渉しないことを統合的に確認します。
既存のテストスイートに新規テストケースを追加することは避け、独立したテストファイルとして作成します。
