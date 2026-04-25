## サマリー

- 目的: FR-19実装後に残存した2件の問題（atomicWriteJson のリトライ欠如と検証スクリプトのルート残存）を解消し、Windows 環境での安定性とリポジトリの清潔さを回復する
- 主要な決定事項: atomicWriteJson 関数に sleepSync と Atomics.wait ベースの同期リトライを3回追加する。sleepSync は lock-utils.ts 内にローカル定義し、外部依存を追加しない
- 変更対象: `workflow-plugin/mcp-server/src/state/lock-utils.ts` の atomicWriteJson 関数（115〜127行目）のみを修正する
- 削除対象: ルートに残存する `verify-templates.js`, `full-template-verify.js`, `detailed-verify.js` の3ファイルを削除する
- 後方互換性: atomicWriteJson の関数シグネチャは変更しない。manager.ts の呼び出し元コードへの修正は不要である
- 次フェーズで必要な情報: lock-utils.ts の 115〜127 行目がリトライロジック追加の対象。既存テストスイートのベースライン合格数は testing フェーズで取得する

---

## 概要

FR-19（全フェーズへのワークフロー制御ツール禁止指示追加）は 2026-02-24 に実装完了したが、その作業過程で2件の副次的問題が発生した。

第1の問題は Windows 環境固有の EPERM エラーである。`workflow-plugin/mcp-server/src/state/lock-utils.ts` の atomicWriteJson 関数は一時ファイルへの書き込み後に renameSync を1回だけ試行する実装になっており、ウィルス対策ソフトや Windows ファイルシステムが一時的にファイルをロックした瞬間に rename が重なると EPERM エラーが発生する。このエラーは一時的な競合であるため、短時間待機後のリトライで解消できる。FR-19 実装中の ci_verification から deploy への遷移で実際にこの現象が発生し、2回目の呼び出しで成功した事実が一時的競合であることを裏付けている。

第2の問題はルートディレクトリへの一時ファイル残存である。FR-19 実装時の refactoring フェーズで subagent がフック制限を回避するため .js ファイルをルートに作成したが、その後の削除操作もフックでブロックされ未追跡状態のまま残存している。残存しているのは `verify-templates.js`、`full-template-verify.js`、`detailed-verify.js` の3ファイルである。

本タスクはこの2件を修正し、Windows 環境での安定性向上とリポジトリの清潔さを回復させることを目的とする。なお、両問題は独立しており、リトライ追加とファイル削除をそれぞれ別の修正として実施できる。

両問題は同一の FR-19 実装セッション内で発生しており、実装完了直後に root の git status と MCP サーバーログを確認することで早期発見できた。

---

## 実装計画

### 計画1: atomicWriteJson へのリトライロジック追加

対象ファイルは `workflow-plugin/mcp-server/src/state/lock-utils.ts` の atomicWriteJson 関数（115〜127行目）である。

現在の実装は writeFileSync で一時ファイルに書き込み、renameSync で目的ファイルに置き換えるシンプルな構造になっている。catch ブロックでは一時ファイルの cleanup のみ行い、エラーをそのまま上位に throw している。renameSync の失敗はリトライなしで即座に伝播するため、Windows 環境の一時的なファイルロック競合に対処できない。

修正後の実装方針は以下の通りである。lock-utils.ts 内に sleepSync 関数をローカル定義する。Atomics.wait を利用した同期スリープで、引数にミリ秒を指定して待機する。外部パッケージを追加せず既存の Node.js/V8 API のみで実装できる点が選定理由である。

atomicWriteJson のリトライループを実装する。最大リトライ回数は3回に固定し、リトライ対象エラーコードは EPERM および EBUSY の2種類のみとする。それ以外のエラーコード（ENOENT、EACCES 等）はリトライせず即座に上位へ伝播する。リトライ前には sleepSync(100) を呼び出して100ms 待機する。全リトライ失敗後は最後のエラーを throw する。

関数のシグネチャ（引数・戻り値の型）は変更しない。既存の呼び出し元である manager.ts の writeTaskState と updateTaskPhase は修正不要である。

### 計画2: ルート残存ファイルの削除

削除対象は以下の3ファイルである。

- `C:/ツール/Workflow/verify-templates.js`（48行のNode.js CommonJS スクリプト）
- `C:/ツール/Workflow/full-template-verify.js`（105行のNode.js CommonJS スクリプト）
- `C:/ツール/Workflow/detailed-verify.js`（92行のNode.js CommonJS スクリプト）

これらはいずれも git の未追跡ファイルとして存在している。プロダクションコードではなく、FR-19 実装時の検証目的で一時的に作成されたスクリプトである。implementation フェーズで rm コマンドにより削除する。

---

## 変更対象ファイル

### 修正するファイル

| ファイルパス | 変更種別 | 変更内容 |
|-------------|---------|---------|
| `workflow-plugin/mcp-server/src/state/lock-utils.ts` | 修正 | atomicWriteJson 関数にリトライロジックを追加、sleepSync 関数をローカル定義 |

### 削除するファイル

| ファイルパス | 変更種別 | 備考 |
|-------------|---------|------|
| `verify-templates.js`（ルート） | 削除 | FR-19実装時に作成された一時検証スクリプト |
| `full-template-verify.js`（ルート） | 削除 | FR-19実装時に作成された一時検証スクリプト |
| `detailed-verify.js`（ルート） | 削除 | FR-19実装時に作成された一時検証スクリプト |

### 変更しないファイル

manager.ts（writeTaskState, updateTaskPhase の呼び出し元）は変更不要である。atomicWriteJson の関数シグネチャが変わらないため、呼び出し側のコードを修正する必要はない。既存のテストファイルについても、リトライロジックは正常パスに影響を与えないため既存テストへの追加修正は不要である。テスト追加は test_impl フェーズで行う。

---

## テスト方針

### 単体テスト方針

`atomicWriteJson` のリトライ動作を検証する新規テストケースを `workflow-plugin/mcp-server/src/state/lock-utils.test.ts` に追加する。既存の `atomicWriteJson` テスト（正常系）は全て合格し続けることが前提となる。

追加するテストケースの概要は以下の通り。EPERM エラー発生時にリトライして成功するシナリオを確認するテストを追加する。EBUSY エラー発生時にリトライして成功するシナリオも同様に確認する。3回のリトライを全て消費してもエラーが解消しない場合は最後のエラーをスローすることを検証するテストを追加する。EPERM でも EBUSY でもないエラー（例えば ENOENT）は即座にスローされリトライを行わないことも確認する。

### ビルドと既存テストの確認

修正後に `workflow-plugin/mcp-server` ディレクトリで npm run build を実行し、TypeScript のトランスパイルが成功することを確認する。その後 npm test を実行し、全テストが合格することを確認する。修正は atomicWriteJson の内部実装のみであり呼び出し元の manager.ts は変更しないため、リグレッションのリスクは低い。

### ファイル削除の確認

`git status` コマンドで3ファイルが未追跡ファイルのリストから消えていることを確認する。これにより削除が正しく行われたことを検証できる。ルートディレクトリに他の新規ファイルが生じていないことも合わせて確認する。削除確認はビルドと既存テストの合格確認と合わせて implementation フェーズの完了基準として扱う。

なお、lock-utils.ts の修正後は MCP サーバーを再起動することで変更が反映される点に注意し、testing フェーズではリスタート後の状態でテストを実行する。
