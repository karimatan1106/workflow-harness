# テスト設計書: NEW-SEC-1/2/3専用テスト追加

## サマリー

本テスト設計書は、セキュリティ修正NEW-SEC-1（ゼロ幅文字サニタイズ）、NEW-SEC-2（Fail-Closedロジック）、NEW-SEC-3（エラーログ出力）の動作を検証する専用テストファイルtest-n6-security-new.test.tsの詳細設計を定義します。
テストファイルは既存テスト（test-n1〜n5）と同じカスタムNode.jsフレームワークを採用し、assertモジュールによる検証とconsole.logベースの出力形式で統一します。
合計13件のテストケース（Suite1: 6件、Suite2: 4件、Suite3: 3件）を実装し、各セキュリティ修正の正確性とリグレッション防止を保証します。
NEW-SEC-1のsanitizeZeroWidthChars関数はmodule.exportsに含まれていないため、splitCommandParts経由で間接的にテストする戦略を採用します。
NEW-SEC-2のdetectEncodedCommand関数はmodule.exportsに登録されているため、直接呼び出しでテストします。
NEW-SEC-3のnormalizeFilePathメソッドはLoopDetectorクラスのインスタンスメソッドとして直接テストし、console.warn/console.errorのスパイパターンで検証します。

テスト実行は`node src/backend/tests/unit/hooks/test-n6-security-new.test.ts`で行い、全テストが1秒以内に完了します。
テスト出力形式は既存テストと完全に一致し、test-authenticity.tsバリデーションを通過します。
各テストケースは独立して実行可能であり、スパイの復元処理により他のテストケースに影響を与えません。

次フェーズ（test_impl）では、本設計書のテストケース定義、アサーション仕様、スパイ実装パターンに基づいて実際のテストコードを実装します。

## テスト戦略

### テスト目的と範囲

本テスト設計の主目的は、セキュリティ修正NEW-SEC-1/2/3の動作を直接的かつ独立的に検証することです。
これらの修正は前回ワークフローで実装されましたが、既存のテストファイル（test-n1〜n5）にはこれらの修正を直接検証するテストケースが含まれていません。
そのため、新規テストファイルtest-n6-security-new.test.tsを作成し、セキュリティ修正の動作を明示的にテストします。

テスト対象モジュールは以下の2つです。
第一に、workflow-plugin/mcp-server/dist/hooks/bash-whitelist.jsモジュールに実装されたNEW-SEC-1（sanitizeZeroWidthChars関数）とNEW-SEC-2（detectEncodedCommand関数のFail-Closedロジック）を検証します。
第二に、workflow-plugin/mcp-server/dist/hooks/loop-detector.jsモジュールに実装されたNEW-SEC-3（normalizeFilePath関数のconsole.warn/console.error出力）を検証します。

テスト範囲は以下の3つのセキュリティ修正に限定します。
その他の機能（ホワイトリスト検証、ループ検出ロジック等）は既存テストでカバーされているため、本テストでは対象外とします。

### テストアプローチ

本テスト設計では、カスタムNode.jsテストフレームワークを採用します。
これは既存テスト（test-n1〜n5）と同じアプローチであり、vitestやjest等の外部フレームワークに依存せず、Node.jsスクリプトとして直接実行可能な形式です。
assertモジュールを使用してアサーションを実装し、テスト結果はconsole.logで出力します。

テスト手法は以下の3つを組み合わせます。
第一に、ホワイトボックステスト手法を採用し、内部実装の詳細（sanitizeZeroWidthChars関数の存在、エンコード検出処理の内部ロジック）を理解した上でテストケースを設計します。
第二に、境界値分析を適用し、正常入力と異常入力の境界を明確にテストします（ゼロ幅文字あり/なし、エンコード成功/失敗、パス存在/非存在）。
第三に、モック/スパイパターンを使用し、console.warn/console.errorの呼び出しを検証します。

テストデータは以下の方針で設計します。
ゼロ幅文字はユニコードエスケープシーケンス（\u200B、\u200C、\u200D、\uFEFF）を使用して明示的に記述し、ソースコード上で可視化します。
不正なエンコード文字列は構文レベルのエラーを引き起こすデータを使用し、実際に危険なペイロードは含めません。
存在しないパスは/nonexistent/path/file.txt等の明らかに存在しないパスを使用し、テスト環境の依存性を排除します。

### テスト環境

テスト実行環境はNode.js v18以上を前提とします。
workflow-plugin/mcp-server/dist/ディレクトリにコンパイル済みのJavaScriptファイルが存在することを前提とします。
テストファイルの配置場所はsrc/backend/tests/unit/hooks/であり、プロジェクトルートからの相対パスで動的にモジュールを読み込みます。

テスト実行に必要な外部依存はありません。
Node.jsの標準モジュール（fs、path、assert）のみを使用し、追加のnpmパッケージインストールは不要です。
テスト実行はCI環境でも実行可能であり、環境変数や外部リソースに依存しません。

テストデータの準備は不要です。
全てのテストケースはハードコードされたテストデータを使用し、外部ファイルからのデータ読み込みは行いません。
唯一の例外はNEW-SEC-3の正常パステストであり、既存ファイル（loop-detector.js自身）のパスを使用します。

### テストフレームワーク詳細

本テストは既存テストと完全に同じフレームワーク構造を採用します。
テストファイルの先頭で必要なモジュール（fs、path、assert）をrequireし、プロジェクトルートを動的に解決します。
プロジェクトルート解決ロジックは、現在のディレクトリから親ディレクトリを順に辿り、workflow-pluginディレクトリが見つかるまで探索を続けます。

テスト結果の管理には、passedとfailedの2つのカウンター変数を使用します。
各テストケースはtry-catchブロックで囲み、アサーション成功時にpassed++、失敗時にfailed++を実行します。
最終行でTests: N passed, M failed, T total形式の集計結果を出力し、failed > 0の場合はprocess.exit(1)で異常終了します。

テスト出力形式は以下の通りです。
各テストスイートの開始時に「Test Suite: [スイート名]」ヘッダーと区切り線（=====）を表示します。
各テストケースの結果は「  ✓ テストケース名」または「  ✗ テストケース名: エラーメッセージ」形式で出力します。
テストスイート終了後に空行を1行挿入し、視覚的な区切りを明確にします。

## テストケース

### Test Suite 1: NEW-SEC-1: ゼロ幅文字サニタイズ

本テストスイートは、bash-whitelist.jsモジュールのsanitizeZeroWidthChars機能を検証します。
sanitizeZeroWidthChars関数自体はmodule.exportsに含まれていないため、splitCommandParts関数経由で間接的にテストします。
splitCommandParts関数はコマンド文字列を空白で分割する前にsanitizeZeroWidthCharsを呼び出すため、この関数の戻り値を検証することでサニタイズ処理の正しさを確認できます。

#### TC-N6-SEC1-01: U+200Bゼロ幅スペースのサニタイズ

テストID: N6-SEC1-01
テスト名: U+200Bゼロ幅スペースのサニタイズ
テスト目的: ゼロ幅スペース（U+200B）がsplitCommandParts関数により正しく除去されることを検証します。

入力値:
- コマンド文字列: `'git\u200Bstatus'`（gitとstatusの間にU+200Bが挿入されている）

期待結果:
- splitCommandPartsの戻り値: `['git', 'status']`
- ゼロ幅文字が除去され、正しく2つの要素に分割される

テスト手順:
1. bashWhitelist.splitCommandParts('git\u200Bstatus')を呼び出す
2. 戻り値をresult変数に格納する
3. assert.deepStrictEqual(result, ['git', 'status'])で配列の等価性を検証する
4. アサーション成功時にpassed++、失敗時にfailed++と✗出力を行う

検証ポイント:
- U+200Bが完全に除去され、'gitstatus'という連結文字列にならないこと
- 分割結果が['git', 'status']という2要素配列であること
- 既存の空白による分割機能が正常に動作していること

#### TC-N6-SEC1-02: U+200Cゼロ幅非接合子のサニタイズ

テストID: N6-SEC1-02
テスト名: U+200Cゼロ幅非接合子のサニタイズ
テスト目的: ゼロ幅非接合子（U+200C）がsplitCommandParts関数により正しく除去されることを検証します。

入力値:
- コマンド文字列: `'ls\u200C-la'`（lsと-laの間にU+200Cが挿入されている）

期待結果:
- splitCommandPartsの戻り値: `['ls', '-la']`
- ゼロ幅文字が除去され、正しく2つの要素に分割される

テスト手順:
1. bashWhitelist.splitCommandParts('ls\u200C-la')を呼び出す
2. 戻り値をresult変数に格納する
3. assert.deepStrictEqual(result, ['ls', '-la'])で配列の等価性を検証する
4. アサーション成功時にpassed++、失敗時にfailed++と✗出力を行う

検証ポイント:
- U+200Cが完全に除去されること
- ハイフンで始まるオプション引数が正しく分割されること
- オプション文字列の内容が破壊されていないこと

#### TC-N6-SEC1-03: U+200Dゼロ幅接合子のサニタイズ

テストID: N6-SEC1-03
テスト名: U+200Dゼロ幅接合子のサニタイズ
テスト目的: ゼロ幅接合子（U+200D）がsplitCommandParts関数により正しく除去されることを検証します。

入力値:
- コマンド文字列: `'echo\u200Dhello'`（echoとhelloの間にU+200Dが挿入されている）

期待結果:
- splitCommandPartsの戻り値: `['echo', 'hello']`
- ゼロ幅文字が除去され、正しく2つの要素に分割される

テスト手順:
1. bashWhitelist.splitCommandParts('echo\u200Dhello')を呼び出す
2. 戻り値をresult変数に格納する
3. assert.deepStrictEqual(result, ['echo', 'hello'])で配列の等価性を検証する
4. アサーション成功時にpassed++、失敗時にfailed++と✗出力を行う

検証ポイント:
- U+200Dが完全に除去されること
- 引数文字列の内容が保持されること
- 通常の英数字文字列が正しく扱われること

#### TC-N6-SEC1-04: U+FEFFバイトオーダーマークのサニタイズ

テストID: N6-SEC1-04
テスト名: U+FEFFバイトオーダーマークのサニタイズ
テスト目的: バイトオーダーマーク（U+FEFF）がsplitCommandParts関数により正しく除去されることを検証します。

入力値:
- コマンド文字列: `'cat\uFEFFfile.txt'`（catとfile.txtの間にU+FEFFが挿入されている）

期待結果:
- splitCommandPartsの戻り値: `['cat', 'file.txt']`
- BOMが除去され、正しく2つの要素に分割される

テスト手順:
1. bashWhitelist.splitCommandParts('cat\uFEFFfile.txt')を呼び出す
2. 戻り値をresult変数に格納する
3. assert.deepStrictEqual(result, ['cat', 'file.txt'])で配列の等価性を検証する
4. アサーション成功時にpassed++、失敗時にfailed++と✗出力を行う

検証ポイント:
- U+FEFFが完全に除去されること
- ファイル名（ドット含む）が正しく扱われること
- ファイルパスとして有効な文字列が保持されること

#### TC-N6-SEC1-05: 複数ゼロ幅文字の同時サニタイズ

テストID: N6-SEC1-05
テスト名: 複数ゼロ幅文字の同時サニタイズ
テスト目的: 複数種類のゼロ幅文字が混在する場合に、全て正しく除去されることを検証します。

入力値:
- コマンド文字列: `'git\u200B\u200Cstatus\u200D\uFEFF-s'`（4種類のゼロ幅文字が混在）

期待結果:
- splitCommandPartsの戻り値: `['git', 'status', '-s']`
- 全てのゼロ幅文字が除去され、正しく3つの要素に分割される

テスト手順:
1. bashWhitelist.splitCommandParts('git\u200B\u200Cstatus\u200D\uFEFF-s')を呼び出す
2. 戻り値をresult変数に格納する
3. assert.deepStrictEqual(result, ['git', 'status', '-s'])で配列の等価性を検証する
4. アサーション成功時にpassed++、失敗時にfailed++と✗出力を行う

検証ポイント:
- 連続する複数のゼロ幅文字が全て除去されること
- 離れた位置にある異なるゼロ幅文字も全て除去されること
- 複雑な攻撃パターンに対しても正しく動作すること

#### TC-N6-SEC1-06: 正常入力の非破壊性検証

テストID: N6-SEC1-06
テスト名: 正常入力の非破壊性検証
テスト目的: ゼロ幅文字を含まない通常の入力が、サニタイズ処理により変更されないことを検証します。

入力値:
- コマンド文字列: `'git status -s'`（通常の空白区切りコマンド）

期待結果:
- splitCommandPartsの戻り値: `['git', 'status', '-s']`
- サニタイズ処理が入力を変更しない

テスト手順:
1. bashWhitelist.splitCommandParts('git status -s')を呼び出す
2. 戻り値をresult変数に格納する
3. assert.deepStrictEqual(result, ['git', 'status', '-s'])で配列の等価性を検証する
4. アサーション成功時にpassed++、失敗時にfailed++と✗出力を行う

検証ポイント:
- 既存の正常な動作が保持されていること
- サニタイズ処理の追加による副作用がないこと
- パフォーマンス劣化が発生していないこと

### Test Suite 2: NEW-SEC-2: Fail-Closedロジック

本テストスイートは、bash-whitelist.jsモジュールのdetectEncodedCommand関数のFail-Closedロジックを検証します。
detectEncodedCommand関数はmodule.exportsに登録されているため、直接呼び出してテストします。
Fail-Closedロジックとは、エンコード検出処理で例外が発生した場合に、安全側（実行拒否）に倒すロジックです。

#### TC-N6-SEC2-01: 不正base64エンコードの検出

テストID: N6-SEC2-01
テスト名: 不正base64エンコードの検出
テスト目的: base64デコード処理で例外が発生した場合に、Fail-Closedロジックにより実行が拒否されることを検証します。

入力値:
- コマンド文字列: `'echo $(echo "invalid!!!" | base64 -d)'`
- "invalid!!!"は不正なbase64文字列であり、デコード時にエラーが発生する

期待結果:
- detectEncodedCommandの戻り値: `{allowed: false, reason: 'エラーメッセージ'}`
- result.allowedがfalseであること
- result.reasonに'base64'が含まれること

テスト手順:
1. bashWhitelist.detectEncodedCommand('echo $(echo "invalid!!!" | base64 -d)')を呼び出す
2. 戻り値をresult変数に格納する
3. assert.strictEqual(result.allowed, false)でallowedフィールドを検証する
4. assert.ok(result.reason.includes('base64'))でreasonフィールドに'base64'が含まれることを検証する
5. アサーション成功時にpassed++、失敗時にfailed++と✗出力を行う

検証ポイント:
- デコード例外発生時にFail-Closedで拒否されること
- エラー理由が適切に返されること
- セキュリティ上安全側に倒れること

#### TC-N6-SEC2-02: 不正printf hexの検出

テストID: N6-SEC2-02
テスト名: 不正printf hexの検出
テスト目的: printf hex形式のデコード処理で例外が発生した場合に、Fail-Closedロジックにより実行が拒否されることを検証します。

入力値:
- コマンド文字列: `"printf '\\x%s' \"ZZ\""`
- "ZZ"は不正な16進数文字列であり、デコード時にエラーが発生する

期待結果:
- detectEncodedCommandの戻り値: `{allowed: false, reason: 'エラーメッセージ'}`
- result.allowedがfalseであること
- result.reasonに'printf'または'hex'が含まれること

テスト手順:
1. bashWhitelist.detectEncodedCommand("printf '\\x%s' \"ZZ\"")を呼び出す
2. 戻り値をresult変数に格納する
3. assert.strictEqual(result.allowed, false)でallowedフィールドを検証する
4. assert.ok(result.reason.includes('printf') || result.reason.includes('hex'))でreasonフィールドを検証する
5. アサーション成功時にpassed++、失敗時にfailed++と✗出力を行う

検証ポイント:
- printf hexデコード例外発生時にFail-Closedで拒否されること
- エラー理由にprintf/hexが含まれること
- 攻撃パターンが適切にブロックされること

#### TC-N6-SEC2-03: 不正echo octalの検出

テストID: N6-SEC2-03
テスト名: 不正echo octalの検出
テスト目的: echo octal形式のデコード処理で例外が発生した場合に、Fail-Closedロジックにより実行が拒否されることを検証します。

入力値:
- コマンド文字列: `"echo $'\\999'"`
- 999は不正な8進数文字列であり、デコード時にエラーが発生する

期待結果:
- detectEncodedCommandの戻り値: `{allowed: false, reason: 'エラーメッセージ'}`
- result.allowedがfalseであること
- result.reasonに'echo'または'octal'が含まれること

テスト手順:
1. bashWhitelist.detectEncodedCommand("echo $'\\999'")を呼び出す
2. 戻り値をresult変数に格納する
3. assert.strictEqual(result.allowed, false)でallowedフィールドを検証する
4. assert.ok(result.reason.includes('echo') || result.reason.includes('octal'))でreasonフィールドを検証する
5. アサーション成功時にpassed++、失敗時にfailed++と✗出力を行う

検証ポイント:
- echo octalデコード例外発生時にFail-Closedで拒否されること
- エラー理由にecho/octalが含まれること
- 不正な8進数パターンが検出されること

#### TC-N6-SEC2-04: 正常エンコードの非破壊性検証

テストID: N6-SEC2-04
テスト名: 正常エンコードの非破壊性検証
テスト目的: Fail-Closedロジックの追加により、正常なコマンドの処理が妨げられていないことを検証します。

入力値:
- コマンド文字列: `'echo hello'`（エンコードを含まない通常のコマンド）

期待結果:
- detectEncodedCommandの戻り値: エンコード未検出（エラーなし）
- result.allowedがfalseではないこと（trueまたはundefined）

テスト手順:
1. bashWhitelist.detectEncodedCommand('echo hello')を呼び出す
2. 戻り値をresult変数に格納する
3. assert.ok(result.allowed !== false)で正常処理されることを検証する
4. アサーション成功時にpassed++、失敗時にfailed++と✗出力を行う

検証ポイント:
- 正常なコマンドが誤って拒否されないこと
- Fail-Closedロジックが既存機能を破壊していないこと
- エンコード未検出時の動作が正常であること

### Test Suite 3: NEW-SEC-3: エラーログ出力

本テストスイートは、loop-detector.jsモジュールのnormalizeFilePath関数のエラーログ出力を検証します。
normalizeFilePath関数はLoopDetectorクラスのインスタンスメソッドであり、ファイルパスの正規化処理を行います。
この関数内でfs.realpathSync.nativeとfs.realpathSyncが順番に試行され、失敗時にconsole.warn/console.errorが呼ばれます。

#### TC-N6-SEC3-01: fs.realpathSync.native失敗時のconsole.warn

テストID: N6-SEC3-01
テスト名: fs.realpathSync.native失敗時のconsole.warn
テスト目的: normalizeFilePath関数でfs.realpathSync.nativeが失敗した際に、console.warnが適切に呼び出されることを検証します。

入力値:
- ファイルパス: `/nonexistent/path/file.txt`（存在しないパス）
- LoopDetectorインスタンス（新規作成）

期待結果:
- console.warnが1回以上呼ばれること
- console.warnのメッセージに'realpathSync.native'が含まれること

テスト手順:
1. console.warnの元の参照をoriginalWarnに保存する
2. スパイ関数でconsole.warnを上書きし、呼び出しフラグとメッセージを記録する
3. new LoopDetector()でインスタンスを作成する
4. loopDetector.normalizeFilePath('/nonexistent/path/file.txt')を呼び出す
5. console.warnを元の参照に復元する
6. assert.ok(warnCalled, 'console.warnが呼ばれなかった')でフラグを検証する
7. assert.ok(warnMessage.includes('realpathSync.native'), 'メッセージに"realpathSync.native"が含まれていない')でメッセージ内容を検証する
8. アサーション成功時にpassed++、失敗時にfailed++と✗出力を行う

検証ポイント:
- console.warnが確実に呼ばれること
- エラーメッセージに適切なキーワードが含まれること
- スパイが正しく機能し、呼び出しを検出できること

#### TC-N6-SEC3-02: fs.realpathSync失敗時のconsole.error

テストID: N6-SEC3-02
テスト名: fs.realpathSync失敗時のconsole.error
テスト目的: normalizeFilePath関数でfs.realpathSync（非native）も失敗した際に、console.errorが適切に呼び出されることを検証します。

入力値:
- ファイルパス: `/nonexistent/path/file.txt`（存在しないパス）
- LoopDetectorインスタンス（新規作成）

期待結果:
- console.errorが1回以上呼ばれること
- console.errorのメッセージに'realpathSync'が含まれること

テスト手順:
1. console.errorの元の参照をoriginalErrorに保存する
2. スパイ関数でconsole.errorを上書きし、呼び出しフラグとメッセージを記録する
3. new LoopDetector()でインスタンスを作成する
4. loopDetector.normalizeFilePath('/nonexistent/path/file.txt')を呼び出す
5. console.errorを元の参照に復元する
6. assert.ok(errorCalled, 'console.errorが呼ばれなかった')でフラグを検証する
7. assert.ok(errorMessage.includes('realpathSync'), 'メッセージに"realpathSync"が含まれていない')でメッセージ内容を検証する
8. アサーション成功時にpassed++、失敗時にfailed++と✗出力を行う

検証ポイント:
- console.errorが確実に呼ばれること
- エラーメッセージに適切なキーワードが含まれること
- 両方のrealpathSync呼び出しが失敗した際のフォールバック動作が正しいこと

#### TC-N6-SEC3-03: 正常パス処理の非破壊性検証

テストID: N6-SEC3-03
テスト名: 正常パス処理の非破壊性検証
テスト目的: 存在するパスを渡した際に、console.warn/console.errorが呼ばれないことを検証します。

入力値:
- ファイルパス: loop-detector.jsファイルの絶対パス（テスト対象自身のパス）
- LoopDetectorインスタンス（新規作成）

期待結果:
- console.warnが呼ばれないこと
- console.errorが呼ばれないこと
- 正常にパスが正規化されること

テスト手順:
1. console.warnとconsole.errorの元の参照を保存する
2. スパイ関数で両方を上書きし、呼び出しフラグを記録する
3. new LoopDetector()でインスタンスを作成する
4. const testFile = path.join(rootDir, 'workflow-plugin/mcp-server/dist/hooks/loop-detector.js')でテストパスを構築する
5. loopDetector.normalizeFilePath(testFile)を呼び出す
6. console.warnとconsole.errorを元の参照に復元する
7. assert.ok(!warnCalled, 'console.warnが予期せず呼ばれた')でwarn未呼び出しを検証する
8. assert.ok(!errorCalled, 'console.errorが予期せず呼ばれた')でerror未呼び出しを検証する
9. アサーション成功時にpassed++、失敗時にfailed++と✗出力を行う

検証ポイント:
- 正常なパス処理でエラーログが出力されないこと
- エラーログ出力の追加が既存動作を破壊していないこと
- 存在するファイルに対する処理が正しく動作すること

## テスト計画

### テスト用ヘルパー関数の設計

本テストファイルではヘルパー関数を明示的に定義しませんが、以下のパターンを繰り返し使用します。

プロジェクトルート解決パターン:
現在のディレクトリ（__dirname）から開始し、親ディレクトリを順に探索してworkflow-pluginディレクトリを見つけます。
見つからない場合はエラーメッセージを出力してexit code 2で終了します。
このロジックは既存テスト（test-n1）と完全に同一です。

スパイパターン（console.warn/error用）:
元のconsole.warn/errorへの参照を保存し、カスタム関数で上書きします。
カスタム関数内で呼び出しフラグ（warnCalled/errorCalled）とメッセージ内容（warnMessage/errorMessage）を記録します。
テストケース終了時に必ず元の参照に復元し、次のテストケースへの影響を防ぎます。

アサーションパターン:
assert.deepStrictEqual()は配列やオブジェクトの深い比較に使用します（NEW-SEC-1のテスト）。
assert.strictEqual()は厳密等価（===）比較に使用します（NEW-SEC-2のallowedフィールド検証）。
assert.ok()はtruthyチェックに使用します（NEW-SEC-2のreason検証、NEW-SEC-3のフラグ検証）。

エラーハンドリングパターン:
各テストケースをtry-catchブロックで囲み、例外をキャッチします。
catch句内でfailed++を実行し、console.logで✗とエラーメッセージを出力します。
テスト実行を継続し、全テストケースを実行した後にプロセスを終了します。

### 前提条件

テスト実行前の前提条件は以下の通りです。

Node.js環境:
Node.js v18以上がインストールされていること。
node コマンドがPATHに含まれていること。

プロジェクト構造:
workflow-pluginディレクトリが存在し、mcp-server/dist/hooks/以下にbash-whitelist.jsとloop-detector.jsが配置されていること。
これらのファイルはTypeScriptソースからコンパイルされた最新のJavaScriptファイルであること。

テストファイル配置:
test-n6-security-new.test.tsファイルがsrc/backend/tests/unit/hooks/ディレクトリに配置されていること。

外部依存なし:
追加のnpmパッケージインストールは不要。
データベース接続やネットワーク通信は不要。
環境変数の設定は不要。

### クリーンアップ手順

各テストケース終了時のクリーンアップは以下の通りです。

スパイ復元:
console.warnとconsole.errorのスパイは必ず元の参照に復元します。
これによりテストケース間の独立性を保証し、次のテストケースや他のテストファイルへの影響を防ぎます。

モジュールキャッシュ:
requireしたモジュールはNode.jsのモジュールキャッシュに保持されますが、これは問題ありません。
各テストケースは純粋関数のテストであり、モジュールの状態を変更しないため、キャッシュのクリアは不要です。

LoopDetectorインスタンス:
各テストケースで新規にnew LoopDetector()でインスタンスを作成します。
インスタンスはテストケース終了後にガベージコレクションで回収されるため、明示的なクリーンアップは不要です。

ファイルシステム:
テストはファイルの読み込みのみを行い、書き込みや削除は行いません。
そのため、ファイルシステムのクリーンアップは不要です。

### テスト実行順序

テストスイートは以下の順序で実行されます。

1. モジュール読み込みとプロジェクトルート解決（1回のみ）
2. Test Suite 1: NEW-SEC-1: ゼロ幅文字サニタイズ（6テストケース）
3. Test Suite 2: NEW-SEC-2: Fail-Closedロジック（4テストケース）
4. Test Suite 3: NEW-SEC-3: エラーログ出力（3テストケース）
5. 結果集計と出力

各テストスイート内のテストケースは定義順に実行されます。
テストケース間に依存関係はなく、任意の順序で実行可能です。
全テストケースは独立しており、並列実行にも対応できる設計です（ただし本実装では順次実行）。

### テストデータ管理

テストデータは全てハードコードします。
外部ファイルからのデータ読み込みは行いません。

ゼロ幅文字データ:
`\u200B`、`\u200C`、`\u200D`、`\uFEFF`の4種類をテストコード内に直接記述します。
これによりソースコード上で可視化され、メンテナンス性が向上します。

不正エンコード文字列:
`'invalid!!!'`、`"ZZ"`、`$'\\999'`等の構文レベルのエラーを引き起こす文字列を使用します。
実際に危険なペイロードは含めず、テストの安全性を確保します。

存在しないパス:
`/nonexistent/path/file.txt`を使用します。
このパスはどの環境でも存在しないと想定され、テスト結果の再現性を保証します。

存在するパス:
テスト対象モジュール自身のパス（loop-detector.js）を使用します。
このパスは確実に存在するため、正常系のテストに最適です。

### テスト実行時間

全テストケースは1秒以内に完了します。
各テストケースの実行時間は以下の通りです。

NEW-SEC-1（6件）: 各10ms程度、合計60ms
- splitCommandParts関数の呼び出しとアサーションのみ

NEW-SEC-2（4件）: 各20ms程度、合計80ms
- detectEncodedCommand関数の呼び出しと複数フィールドのアサーション

NEW-SEC-3（3件）: 各30ms程度、合計90ms
- LoopDetectorインスタンス作成、normalizeFilePath呼び出し、スパイ検証

モジュール読み込み: 50ms程度
- requireによるモジュール読み込みとキャッシュ

合計: 約300ms程度（1秒以内に完了）

### テストカバレッジ目標

本テストファイルはセキュリティ修正NEW-SEC-1/2/3の動作検証に特化しており、以下のカバレッジを目標とします。

NEW-SEC-1（sanitizeZeroWidthChars）:
- 4種類のゼロ幅文字の個別除去: 100%カバー（4/4テストケース）
- 複数ゼロ幅文字の同時除去: 100%カバー（1テストケース）
- 正常入力の非破壊性: 100%カバー（1テストケース）

NEW-SEC-2（Fail-Closedロジック）:
- 3種類のエンコード形式のFail-Closed: 100%カバー（3/3テストケース）
- 正常エンコードの非破壊性: 100%カバー（1テストケース）

NEW-SEC-3（エラーログ出力）:
- fs.realpathSync.native失敗時のconsole.warn: 100%カバー（1テストケース）
- fs.realpathSync失敗時のconsole.error: 100%カバー（1テストケース）
- 正常パス処理の非破壊性: 100%カバー（1テストケース）

その他のbash-whitelist.jsとloop-detector.jsの機能は既存テスト（test-n1〜n5）でカバーされているため、本テストでは対象外とします。

### テスト失敗時の対応

テスト失敗時の対応フローは以下の通りです。

テスト実行結果の確認:
`Tests: N passed, M failed, T total`の出力を確認し、failedが0より大きい場合は失敗と判断します。
✗マークのついたテストケース名とエラーメッセージを確認します。

失敗原因の特定:
アサーションのエラーメッセージから、期待値と実際の値の差異を確認します。
NEW-SEC-1の失敗: ゼロ幅文字が除去されていない、または誤った分割結果になっている。
NEW-SEC-2の失敗: Fail-Closedロジックが動作していない、またはエラー理由が不適切。
NEW-SEC-3の失敗: console.warn/errorが呼ばれていない、またはメッセージ内容が不適切。

修正方針の決定:
プロダクションコード（bash-whitelist.js/loop-detector.js）の実装不備の場合: implementationフェーズに戻り修正。
テストケースの設計不備の場合: test_implフェーズで修正。
テスト環境の問題の場合: 環境設定を確認し修正。

リグレッションテスト:
修正後、全テストケース（既存42件 + 新規13件 = 55件）を実行し、リグレッションが発生していないことを確認します。

## 次フェーズへの引き継ぎ事項

### test_implフェーズへの指示

test_implフェーズでは、本テスト設計書に基づいてsrc/backend/tests/unit/hooks/test-n6-security-new.test.tsファイルを実装してください。

実装時の重要ポイント:

ファイル構造:
既存テスト（test-n1-scope-validator.test.ts）と同じ基本構造を採用してください。
requireによるモジュール読み込み、プロジェクトルート解決、passed/failedカウンター、テストスイート実行、結果集計の順序で実装してください。

テストケース実装:
本設計書の各テストケース（TC-N6-SEC1-01〜TC-N6-SEC3-03）を順番に実装してください。
try-catchブロックで各テストケースを囲み、例外時の適切なエラーハンドリングを実装してください。

スパイ実装:
NEW-SEC-3のテストケースでは、console.warn/errorのスパイを実装してください。
元の参照の保存、スパイ関数の定義、復元処理を必ず実装してください。

出力形式:
既存テストと完全に一致する出力形式を実装してください。
ユニコード文字U+2713（✓）とU+2717（✗）を使用してください。
最終行は`Tests: N passed, M failed, T total`と`Time:  0.01s`の2行で構成してください。

終了コード:
failed === 0の場合はprocess.exit(0)、failed > 0の場合はprocess.exit(1)で終了してください。

### regression_testフェーズへの指示

regression_testフェーズでは、新規テストファイルの追加により既存テスト42件が影響を受けていないことを確認してください。

確認項目:
既存テスト（test-n1〜n5）が全て合格すること。
新規テスト（test-n6）の13件が全て合格すること。
合計55件のテストが全て合格すること。

リグレッション発生時の対応:
既存テストが失敗した場合、新規テストファイルの影響を調査してください。
console.warn/errorのスパイ復元漏れがないか確認してください。
モジュールキャッシュの汚染がないか確認してください。

### ドキュメント更新への指示

docs_updateフェーズでは、以下のドキュメントを更新してください。

README.md:
テストファイルが55件に増加したことを記載してください。
新規テストファイルtest-n6-security-new.test.tsの目的と実行方法を追加してください。

CHANGELOG.md:
セキュリティ修正NEW-SEC-1/2/3に対する専用テストの追加を記載してください。
テストケース数の増加（42件→55件）を記載してください。
