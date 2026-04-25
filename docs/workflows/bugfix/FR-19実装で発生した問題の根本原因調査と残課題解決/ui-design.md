## サマリー

- 目的: FR-19実装後に残存した2件の問題（atomicWriteJson リトライ欠如・ルートファイル残存）を修正するための実装者インターフェース設計を定義する
- 評価スコープ: `workflow-plugin/mcp-server/src/state/lock-utils.ts` の atomicWriteJson 関数と、ルートに残存する3つの一時ファイル
- 主要な決定事項: sleepSync を lock-utils.ts 内にローカル定義し外部依存を追加しない。atomicWriteJson の関数シグネチャは変更しないため manager.ts の呼び出し元への修正は不要。ファイル削除は rm コマンドで実施する
- 検証状況: テスト設計フェーズ以降で実施予定。現時点では設計のみ
- 次フェーズで必要な情報: lock-utils.ts の115〜127行目がリトライロジック追加の対象箇所。EPERM/EBUSY の2種類のみリトライ対象。最大3回・100ms 待機。削除対象は verify-templates.js・full-template-verify.js・detailed-verify.js の3ファイル

---

## CLIインターフェース設計

このプロジェクトは MCP サーバープラグインであり、エンドユーザー向けの CLI は存在しない。
本セクションでは「実装者が操作するコマンドラインインターフェース」を定義する。

### ビルドコマンド

実装者は修正後に以下のコマンドでトランスパイルを行う。

実行ディレクトリは `workflow-plugin/mcp-server` であり、ルートから実行する場合は `cd workflow-plugin/mcp-server && npm run build` とする。
ビルド成功時は `dist/` 配下に対応する `.js` ファイルが生成される。
生成される主なファイルは `dist/state/lock-utils.js` であり、これが修正対象のコンパイル結果となる。
ビルドエラーが発生した場合は TypeScript の型エラーを優先的に修正すること。

### テスト実行コマンド

修正後のテスト実行は `workflow-plugin/mcp-server` ディレクトリで `npm test` を実行する。
既存テストと新規テストが両方合格することを確認する。
特定テストファイルのみを実行する場合は `npx vitest src/state/lock-utils.test.ts` を使用する。
テスト出力はルートに散らかさず、フレームワーク既定の出力先を使用すること。

### ファイル削除コマンド

ルート残存ファイルの削除は implementation フェーズの rm コマンドで実施する。
削除コマンドは `rm verify-templates.js full-template-verify.js detailed-verify.js` とする。
削除後の確認コマンドは `git status` であり、未追跡ファイルのリストから3ファイルが消えていることを検証する。
`git status` の出力に `verify-templates.js` が含まれなければ削除成功と判断する。

### MCP サーバー再起動コマンド

lock-utils.ts を修正後は MCP サーバーを再起動する必要がある。
Claude Desktop のサーバー再起動ボタンを使用するか、プロセスを直接終了して再起動する。
再起動後は `workflow_status` ツールを呼び出して現在のフェーズが正しく返ることを確認する。
再起動なしでテストを実行すると、キャッシュされた古いバイナリが動作し続けるため注意が必要である。

---

## エラーメッセージ設計

### EPERM エラーの扱い

EPERM は Windows 環境でウィルス対策ソフトやファイルシステムが一時的にファイルをロックした際に発生する。
このエラーは一時的な競合であるため、最大3回のリトライで解消できる可能性が高い。
リトライ中は上位への例外伝播を行わず、ループ内でエラーオブジェクトを保持する。
全リトライを消費した後も失敗した場合のエラーメッセージは「atomicWriteJson: renameSync failed after 3 retries」とし、最後のエラーを cause として付与することを推奨する。

### EBUSY エラーの扱い

EBUSY は別プロセスがファイルを使用中の状態で発生する。
EPERM と同様に一時的な競合であるためリトライ対象とする。
エラー判定は `(err as NodeJS.ErrnoException).code` が `'EPERM'` または `'EBUSY'` と等しいかで行う。
文字列比較によるエラーコード判定は NodeJS の errno モジュールに依存せず実装できる。

### リトライ対象外エラーの扱い

ENOENT（ファイル・ディレクトリ不存在）は設定ミスや論理エラーを示すためリトライしない。
EACCES（権限不足）は恒久的な問題であるためリトライしても解消しない。
ENOSPC（ディスク容量不足）も恒久的な問題のためリトライ対象外とする。
対象外エラーは catch ブロックで即座に `throw` して呼び出し元に伝播させる。

### sleepSync の設計と注意

sleepSync は Atomics.wait を使った同期スリープであり、イベントループをブロックする。
Node.js のメインスレッドで `Atomics.wait` を使用する場合、非 SharedArrayBuffer では動作しないため、SharedArrayBuffer を作成して使用する。
`const buf = new SharedArrayBuffer(4)` と `const arr = new Int32Array(buf)` で配列を作成し、`Atomics.wait(arr, 0, 0, ms)` で待機する。
待機結果の戻り値が `'timed-out'` であれば正常な待機完了を示す。
sleepSync のミリ秒単位の引数は 100 を指定する（設計値）。

---

## APIレスポンス設計

### atomicWriteJson の関数シグネチャ（変更なし）

atomicWriteJson の公開インターフェースは修正前後で一切変更しない。
引数は `filePath: string` と `data: unknown` の2つであり、戻り値は `void` を返す同期関数である。
throws が変わらないことで、manager.ts の writeTaskState と updateTaskPhase の呼び出しコードを修正不要にできる。
既存のテストも引数・戻り値の変更がないため、失敗するテストケースは発生しない。

### リトライロジックの内部構造

リトライループは `for` ループで最大3回（インデックス 0 から 2 まで）繰り返す。
各イテレーションの最初に renameSync を try-catch で囲み、成功した場合は即座に return する。
catch ブロックではエラーコードを確認し、EPERM または EBUSY でなければ即座に throw する。
EPERM または EBUSY の場合は sleepSync(100) を呼び出してから次のイテレーションに進む。
ループ終了後も成功していない場合は保持していた最後のエラーを throw する。

### 一時ファイルのクリーンアップ設計

renameSync が失敗した際の一時ファイルクリーンアップは既存実装と同様に行う。
一時ファイルのパスは `filePath + '.tmp.' + process.pid` 形式であり、unlink で削除する。
クリーンアップ処理はリトライ中には行わず、全リトライ失敗後の最終 catch ブロックで行う。
一時ファイルが存在しない場合の unlink エラーは無視してよい。

### manager.ts の呼び出しパターン（影響なし）

writeTaskState は `atomicWriteJson(stateFilePath, state)` の形式で呼び出しており、変更不要である。
updateTaskPhase も同様の形式で呼び出しており、修正後も同じコードで動作する。
どちらも atomicWriteJson の戻り値を使用しておらず、エラー時は例外として受け取る設計になっている。
EPERM/EBUSY が解消されれば例外が発生しないため、呼び出し元のエラーハンドリングにも変更は生じない。

---

## 設定ファイル設計

### リトライパラメータの設計値

本修正ではリトライ関連の設定値をハードコードで実装する方針をとる。
最大リトライ回数は 3 回であり、これは Windows 環境での実績値に基づく設計値である。
待機時間は 100ms であり、ウィルス対策ソフトのスキャン完了に十分な時間として選定された。
これらの値は将来的に環境変数で上書きできる設計に変更することも可能だが、現時点では不要である。

### package.json への影響なし

sleepSync の実装に使用する `SharedArrayBuffer` と `Atomics.wait` は Node.js 組み込みの API である。
外部パッケージの追加は不要であり、`package.json` の dependencies・devDependencies を変更しない。
既存のビルドスクリプト・テストスクリプトの設定も変更しない。
`tsconfig.json` の `lib` オプションに `ES2017` 以上が含まれていれば `SharedArrayBuffer` の型定義が利用可能である。

### lock-utils.ts の修正スコープ

修正対象は `workflow-plugin/mcp-server/src/state/lock-utils.ts` の1ファイルのみである。
追加するコードは sleepSync 関数（約5行）とリトライループのロジック（約15行）の合計約20行である。
ファイルの先頭 import 文の変更は不要であり、Node.js 組み込み API は import なしで利用できる。
修正後のファイル行数は現行の実装から約20行増加する見込みである。

### 削除対象ファイルの詳細

verify-templates.js はルートに存在する 48 行の CommonJS スクリプトであり、プロダクションコードではない。
full-template-verify.js はルートに存在する 105 行の CommonJS スクリプトであり、同様に一時検証目的で作成された。
detailed-verify.js はルートに存在する 92 行の CommonJS スクリプトであり、FR-19 実装セッション中に作成された。
3ファイルはいずれも git の未追跡ファイルであり、削除後は `git status` で追跡対象から消えることで削除完了を確認できる。
